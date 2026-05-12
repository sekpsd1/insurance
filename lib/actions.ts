"use server";

import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getOrderStatusLabel, getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/status-labels';
import {
  deleteInsuranceCampaignByCode,
  importInsuranceCampaignFromCsv
} from '@/lib/insurance-import';

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'PAID'
  | 'SENT_TO_INSURER'
  | 'INSURER_REVIEWING'
  | 'POLICY_APPROVED'
  | 'POLICY_ISSUED'
  | 'REJECTED'
  | 'CANCELLED';

export type PaymentMethod = 'BANK_TRANSFER' | 'CARD_GATEWAY';

function formatOrderNumber(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 900000 + 100000);
  return `IN-${ymd}-${suffix}`;
}

function hashMagicToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function createRawMagicToken() {
  return randomBytes(32).toString('base64url');
}

function getRequiredFormValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function getOptionalFormValue(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? '').trim();
  return value || null;
}

function parseOptionalInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function createOrderStatusHistory(input: {
  orderId: string;
  status: string;
  message?: string | null;
  actorType?: string;
  actorName?: string | null;
}) {
  await prisma.orderStatusHistory.create({
    data: {
      orderId: input.orderId,
      status: input.status,
      message: input.message ?? null,
      actorType: input.actorType ?? 'SYSTEM',
      actorName: input.actorName ?? null
    }
  });
}

async function createMagicLinkTokenForOrder(orderId: string) {
  const token = createRawMagicToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prisma.magicLinkToken.create({
    data: {
      orderId,
      tokenHash: hashMagicToken(token),
      expiresAt
    }
  });

  return token;
}

function buildProviderEmail(input: {
  order: {
    orderNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    carBrand: string | null;
    carModel: string | null;
    carYear: number | null;
    plateNumber: string | null;
    plateProvince: string | null;
    paymentMethod: string | null;
    paymentStatus: string;
    slipUrl: string | null;
    gatewayUrl: string | null;
    user: {
      name: string | null;
      phone: string | null;
    };
    pkg: {
      name: string;
      company: string;
      providerName: string | null;
      providerContactName: string | null;
      providerPhone: string | null;
      providerEmail: string | null;
      netPrice: number;
    };
  };
  magicLinkPath: string;
}) {
  const { order, magicLinkPath } = input;
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const car = [order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / ') || '-';
  const plate = [order.plateNumber, order.plateProvince].filter(Boolean).join(' ') || '-';
  const providerName = order.pkg.providerName ?? order.pkg.company;
  const subject = `New policy request ${order.orderNumber}`;
  const body = [
    `Hello ${order.pkg.providerContactName ?? providerName},`,
    '',
    `A new policy request is ready for review.`,
    '',
    `Order: ${order.orderNumber}`,
    `Customer: ${customerName}`,
    `Customer phone: ${customerPhone}`,
    `Vehicle: ${car}`,
    `Plate: ${plate}`,
    `Package: ${order.pkg.name}`,
    `Payment method: ${getPaymentMethodLabel(order.paymentMethod)}`,
    `Payment status: ${getPaymentStatusLabel(order.paymentStatus)}`,
    order.slipUrl ? `Payment slip: ${order.slipUrl}` : null,
    order.gatewayUrl ? `Gateway URL: ${order.gatewayUrl}` : null,
    '',
    `Update policy status here: ${magicLinkPath}`,
    '',
    'This is an automated broker system message.'
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return {
    recipient: order.pkg.providerEmail,
    subject,
    body
  };
}

async function createProviderEmailOutbox(input: {
  orderId: string;
  token: string;
  message?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: true,
      pkg: true
    }
  });

  if (!order) {
    throw new Error('Order was not found');
  }

  const magicLinkPath = `/insurance/update/${input.token}`;
  const email = buildProviderEmail({
    order,
    magicLinkPath
  });
  const status = email.recipient ? 'QUEUED' : 'MISSING_RECIPIENT';
  const existingOutbox = await prisma.emailOutbox.findFirst({
    where: {
      orderId: order.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (existingOutbox?.status === 'SENT') {
    console.log('[Email Outbox Reuse]', {
      id: existingOutbox.id,
      orderNumber: order.orderNumber,
      status: existingOutbox.status
    });

    return existingOutbox;
  }

  if (existingOutbox) {
    const outbox = await prisma.emailOutbox.update({
      where: {
        id: existingOutbox.id
      },
      data: {
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        magicLinkPath,
        status,
        sentAt: null,
        errorAt: status === 'MISSING_RECIPIENT' ? new Date() : null,
        errorMessage:
          status === 'MISSING_RECIPIENT'
            ? 'Provider email is missing for the selected campaign/package.'
            : null
      }
    });

    await createOrderStatusHistory({
      orderId: order.id,
      status: order.status,
      message:
        input.message ??
        (status === 'QUEUED'
          ? 'อัปเดตคิวอีเมลบริษัทประกันแล้ว'
          : 'ยังเพิ่มอีเมลเข้าคิวไม่ได้ เพราะไม่มีอีเมลบริษัทประกัน'),
      actorType: 'SYSTEM',
      actorName: 'System'
    });

    console.log('[Email Outbox Updated]', {
      id: outbox.id,
      orderNumber: order.orderNumber,
      recipient: outbox.recipient ?? '-',
      status: outbox.status,
      magicLinkPath: outbox.magicLinkPath
    });

    return outbox;
  }

  const outbox = await prisma.emailOutbox.create({
    data: {
      orderId: order.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      magicLinkPath,
      status,
      errorAt: status === 'MISSING_RECIPIENT' ? new Date() : null,
      errorMessage:
        status === 'MISSING_RECIPIENT'
          ? 'Provider email is missing for the selected campaign/package.'
          : null
    }
  });

  await createOrderStatusHistory({
    orderId: order.id,
    status: order.status,
      message:
        input.message ??
        (status === 'QUEUED'
        ? 'เพิ่มอีเมลบริษัทประกันเข้าคิวส่งแล้ว'
        : 'ยังเพิ่มอีเมลเข้าคิวไม่ได้ เพราะไม่มีอีเมลบริษัทประกัน'),
    actorType: 'SYSTEM',
    actorName: 'System'
  });

  console.log('[Email Outbox]', {
    id: outbox.id,
    orderNumber: order.orderNumber,
    recipient: outbox.recipient ?? '-',
    status: outbox.status,
    magicLinkPath: outbox.magicLinkPath
  });

  return outbox;
}

async function sendProviderEmailMock(input: {
  recipient: string;
  subject: string;
  body: string;
  magicLinkPath: string | null;
}) {
  console.log('[Mock Provider Email Send]', {
    recipient: input.recipient,
    subject: input.subject,
    magicLinkPath: input.magicLinkPath ?? '-',
    bodyPreview: input.body.slice(0, 160),
    timestamp: new Date().toISOString()
  });
}

async function deliverEmailOutboxItem(emailOutboxId: string) {
  const email = await prisma.emailOutbox.findUnique({
    where: {
      id: emailOutboxId
    },
    include: {
      order: true
    }
  });

  if (!email) {
    throw new Error('Email outbox item was not found');
  }

  if (!email.recipient) {
    await prisma.emailOutbox.update({
      where: {
        id: email.id
      },
      data: {
        status: 'MISSING_RECIPIENT',
        errorAt: new Date(),
        errorMessage: 'Provider email is missing. Update the campaign provider contact before sending.'
      }
    });

    if (email.orderId) {
      await createOrderStatusHistory({
        orderId: email.orderId,
        status: email.order?.status ?? 'SENT_TO_INSURER',
        message: 'ส่งอีเมลไม่ได้ เพราะไม่มีอีเมลบริษัทประกัน',
        actorType: 'SYSTEM',
        actorName: 'System'
      });
    }

    return;
  }

  if (email.status === 'SENT') {
    return;
  }

  try {
    await sendProviderEmailMock({
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      magicLinkPath: email.magicLinkPath
    });

    await prisma.emailOutbox.update({
      where: {
        id: email.id
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        errorAt: null,
        errorMessage: null
      }
    });

    if (email.orderId) {
      await createOrderStatusHistory({
        orderId: email.orderId,
        status: email.order?.status ?? 'SENT_TO_INSURER',
        message: 'ส่งอีเมลบริษัทประกันแล้ว',
        actorType: 'SYSTEM',
        actorName: 'System'
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown email send error';

    await prisma.emailOutbox.update({
      where: {
        id: email.id
      },
      data: {
        status: 'ERROR',
        errorAt: new Date(),
        errorMessage
      }
    });

    if (email.orderId) {
      await createOrderStatusHistory({
        orderId: email.orderId,
        status: email.order?.status ?? 'SENT_TO_INSURER',
        message: `ส่งอีเมลบริษัทประกันไม่สำเร็จ: ${errorMessage}`,
        actorType: 'SYSTEM',
        actorName: 'System'
      });
    }
  }
}

async function saveUploadFile(file: File, options: { directory: string; publicPath: string; prefix: string }) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Upload file must be an image');
  }

  const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', options.directory);
  await mkdir(uploadDirectory, { recursive: true });

  const originalName = file.name || 'upload';
  const extensionFromName = path.extname(originalName).toLowerCase();
  const extensionFromMime =
    file.type === 'image/png'
      ? '.png'
      : file.type === 'image/jpeg'
        ? '.jpg'
        : file.type === 'image/webp'
          ? '.webp'
          : extensionFromName;

  const safeExtension = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extensionFromMime)
    ? extensionFromMime
    : '.png';
  const fileName = `${options.prefix}-${randomUUID()}${safeExtension}`;
  const filePath = path.join(uploadDirectory, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);
  return `/uploads/${options.publicPath}/${fileName}`;
}

async function deletePublicUploadFile(publicUrl: string | null | undefined) {
  if (!publicUrl?.startsWith('/uploads/')) {
    return;
  }

  const uploadRoot = path.join(process.cwd(), 'public', 'uploads');
  const relativePath = publicUrl.replace(/^\/uploads\//, '').split('/').filter(Boolean);
  const filePath = path.resolve(uploadRoot, ...relativePath);

  if (!filePath.startsWith(path.resolve(uploadRoot) + path.sep)) {
    return;
  }

  try {
    await unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[Upload Cleanup Failed]', {
        publicUrl,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

async function getCampaignAssetUrls(companyCode: string, campaignCode: string) {
  const rows = await prisma.insurancePackage.findMany({
    where: {
      companyCode,
      campaignCode
    },
    select: {
      logoUrl: true,
      paymentQrUrl: true
    },
    distinct: ['logoUrl', 'paymentQrUrl']
  });

  return {
    logoUrls: Array.from(new Set(rows.map((row) => row.logoUrl).filter((url): url is string => Boolean(url)))),
    paymentQrUrls: Array.from(new Set(rows.map((row) => row.paymentQrUrl).filter((url): url is string => Boolean(url))))
  };
}

async function saveLogoFile(logoFile: File, prefix: string): Promise<string> {
  return saveUploadFile(logoFile, {
    directory: 'logos',
    publicPath: 'logos',
    prefix
  });
}

async function savePaymentQrFile(qrFile: File, prefix: string): Promise<string> {
  return saveUploadFile(qrFile, {
    directory: 'payment-qrs',
    publicPath: 'payment-qrs',
    prefix
  });
}

async function saveSlipFile(slipFile: File, prefix: string): Promise<string> {
  return saveUploadFile(slipFile, {
    directory: 'slips',
    publicPath: 'slips',
    prefix
  });
}

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as OrderStatus;

  if (!orderId || !status) {
    throw new Error('Missing orderId or status');
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      ...(status === 'POLICY_APPROVED' || status === 'POLICY_ISSUED'
        ? {
            insurerStatus: status,
            insurerUpdatedAt: new Date()
          }
        : {})
    },
    include: {
      user: true,
      pkg: true
    }
  });

  await createOrderStatusHistory({
    orderId,
    status,
        message: `แอดมินอัปเดตสถานะเป็น ${getOrderStatusLabel(status)}`,
    actorType: 'ADMIN',
    actorName: 'Admin'
  });

  console.log('[Order Action Log]', {
    action: status,
    orderId: updatedOrder.id,
    orderNumber: updatedOrder.orderNumber,
    status: updatedOrder.status,
    customerName: updatedOrder.customerName ?? updatedOrder.user.name ?? '-',
    plateNumber: updatedOrder.plateNumber ?? '-',
    packageName: updatedOrder.pkg.name,
    timestamp: new Date().toISOString()
  });

  revalidatePath('/admin');
}

export async function sendEmailOutboxItem(formData: FormData): Promise<void> {
  const emailOutboxId = getRequiredFormValue(formData, 'emailOutboxId');

  await deliverEmailOutboxItem(emailOutboxId);

  revalidatePath('/admin');
}

export async function createInsurerMagicLinkPreview(formData: FormData): Promise<void> {
  const orderId = getRequiredFormValue(formData, 'orderId');

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new Error('Order was not found');
  }

  const token = await createMagicLinkTokenForOrder(orderId);

  await createProviderEmailOutbox({
    orderId,
    token,
    message: 'เพิ่มตัวอย่างอีเมลบริษัทประกันเข้าคิวส่งแล้ว'
  });

  await createOrderStatusHistory({
    orderId,
    status: order.status,
    message: 'สร้างตัวอย่างอีเมล Magic Link สำหรับบริษัทประกันแล้ว',
    actorType: 'SYSTEM',
    actorName: 'System'
  });

  revalidatePath('/admin');
  redirect(`/admin/orders/${orderId}/email-preview?token=${encodeURIComponent(token)}`);
}

export async function createPolicyDraftOrder(formData: FormData): Promise<void> {
  const packageId = getRequiredFormValue(formData, 'packageId');
  const lineId = getRequiredFormValue(formData, 'lineId');
  const customerName = getRequiredFormValue(formData, 'customerName');
  const customerPhone = getRequiredFormValue(formData, 'customerPhone');
  const plateNumber = getRequiredFormValue(formData, 'plateNumber');
  const customerEmail = getOptionalFormValue(formData, 'customerEmail');
  const customerAddress = getOptionalFormValue(formData, 'customerAddress');
  const province = getOptionalFormValue(formData, 'province');
  const district = getOptionalFormValue(formData, 'district');
  const subDistrict = getOptionalFormValue(formData, 'subDistrict');
  const postalCode = getOptionalFormValue(formData, 'postalCode');
  const idCardNumber = getOptionalFormValue(formData, 'idCardNumber');
  const carBrand = getOptionalFormValue(formData, 'carBrand');
  const carModel = getOptionalFormValue(formData, 'carModel');
  const carYear = parseOptionalInt(getOptionalFormValue(formData, 'carYear'));
  const plateProvince = getOptionalFormValue(formData, 'plateProvince');
  const policyStartDate = parseOptionalDate(getOptionalFormValue(formData, 'policyStartDate'));

  const selectedPackage = await prisma.insurancePackage.findUnique({
    where: { id: packageId }
  });

  if (!selectedPackage) {
    throw new Error('Selected package was not found');
  }

  const user = await prisma.user.upsert({
    where: {
      lineId
    },
    create: {
      lineId,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      consentedAt: new Date()
    },
    update: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      consentedAt: new Date()
    }
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: formatOrderNumber(),
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      paymentAmount: selectedPackage.netPrice,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      province,
      district,
      subDistrict,
      postalCode,
      idCardNumber,
      carBrand: carBrand ?? selectedPackage.brand,
      carModel: carModel ?? selectedPackage.model,
      carYear: carYear ?? selectedPackage.year,
      plateNumber,
      plateProvince,
      policyStartDate,
      user: {
        connect: {
          id: user.id
        }
      },
      pkg: {
        connect: {
          id: selectedPackage.id
        }
      }
    }
  });

  await createOrderStatusHistory({
    orderId: order.id,
    status: 'PENDING_PAYMENT',
    message: 'กรอกข้อมูลกรมธรรม์แล้ว รอชำระเงิน',
    actorType: 'CUSTOMER',
    actorName: customerName
  });

  revalidatePath('/admin');
  redirect(`/line-app/checkout/${order.id}`);
}

export async function submitCheckout(formData: FormData): Promise<void> {
  const orderId = getRequiredFormValue(formData, 'orderId');
  const paymentMethod = getRequiredFormValue(formData, 'paymentMethod') as PaymentMethod;
  const slipFile = formData.get('slipFile');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      pkg: true
    }
  });

  if (!order) {
    throw new Error('Order was not found');
  }

  if (paymentMethod !== 'BANK_TRANSFER' && paymentMethod !== 'CARD_GATEWAY') {
    throw new Error('Invalid payment method');
  }

  let slipUrl: string | null = null;
  let gatewayUrl: string | null = null;
  let status: OrderStatus = 'PAYMENT_SUBMITTED';
  let paymentStatus = 'SLIP_SUBMITTED';
  let historyMessage = 'ลูกค้าส่งสลิปโอนเงินแล้ว';

  if (paymentMethod === 'BANK_TRANSFER') {
    if (!(slipFile instanceof File) || slipFile.size === 0) {
      throw new Error('Payment slip is required for bank transfer');
    }

    slipUrl = await saveSlipFile(slipFile, order.orderNumber);
  } else {
    gatewayUrl = order.pkg.paymentUrl;
    if (!gatewayUrl) {
      throw new Error('Provider payment URL is not configured for this campaign');
    }
    status = 'PENDING_PAYMENT';
    paymentStatus = 'AWAITING_TRANSFER';
    historyMessage = 'ลูกค้าเลือกชำระเงินผ่าน Gateway';
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      paymentMethod,
      paymentStatus,
      paymentAmount: order.paymentAmount ?? order.pkg.netPrice,
      slipUrl,
      gatewayUrl
    }
  });

  await createOrderStatusHistory({
    orderId,
    status,
    message: historyMessage,
    actorType: 'CUSTOMER',
    actorName: order.customerName ?? order.userId
  });

  const insurerToken = await createMagicLinkTokenForOrder(orderId);
  const providerEmailOutbox = await createProviderEmailOutbox({
    orderId,
    token: insurerToken
  });
  await deliverEmailOutboxItem(providerEmailOutbox.id);

  revalidatePath('/admin');
  revalidatePath(`/line-app/success/${orderId}`);
  redirect(`/line-app/success/${orderId}`);
}

export async function updateOrderFromMagicLink(formData: FormData): Promise<void> {
  const token = getRequiredFormValue(formData, 'token');
  const status = getRequiredFormValue(formData, 'status') as OrderStatus;
  const insurerNote = getOptionalFormValue(formData, 'insurerNote');
  const actorName = getOptionalFormValue(formData, 'actorName') ?? 'Insurance provider';

  const allowedStatuses: OrderStatus[] = [
    'INSURER_REVIEWING',
    'POLICY_APPROVED',
    'POLICY_ISSUED',
    'REJECTED'
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid insurer status');
  }

  const magicToken = await prisma.magicLinkToken.findUnique({
    where: {
      tokenHash: hashMagicToken(token)
    },
    include: {
      order: {
        include: {
          user: true,
          pkg: true
        }
      }
    }
  });

  if (!magicToken || magicToken.expiresAt < new Date()) {
    throw new Error('Magic link is invalid or expired');
  }

  await prisma.order.update({
    where: {
      id: magicToken.orderId
    },
    data: {
      status,
      insurerStatus: status,
      insurerNote,
      insurerUpdatedAt: new Date()
    }
  });

  await createOrderStatusHistory({
    orderId: magicToken.orderId,
    status,
    message: insurerNote || `บริษัทประกันอัปเดตสถานะเป็น ${getOrderStatusLabel(status)}`,
    actorType: 'INSURER',
    actorName
  });

  console.log('[Simulated Broker Email + LINE Push]', {
    orderNumber: magicToken.order.orderNumber,
    customerLineId: magicToken.order.user.lineId,
    customerName: magicToken.order.customerName ?? magicToken.order.user.name,
    status,
    insurerNote,
    packageName: magicToken.order.pkg.name,
    timestamp: new Date().toISOString()
  });

  revalidatePath('/admin');
  revalidatePath(`/line-app/success/${magicToken.orderId}`);
  revalidatePath(`/line-app/tracking/${magicToken.order.orderNumber}`);
  redirect(`/insurance/update/${encodeURIComponent(token)}?updated=1`);
}

export async function updateInsurancePackage(formData: FormData): Promise<void> {
  const packageId = String(formData.get('packageId') ?? '').trim();
  const repairType = String(formData.get('repairType') ?? '').trim();
  const coverage = String(formData.get('coverage') ?? '').trim();
  const logoFile = formData.get('logoFile');

  if (!packageId) {
    throw new Error('Missing packageId');
  }

  let logoUrl: string | null | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await saveLogoFile(logoFile, packageId);
  }

  await prisma.insurancePackage.update({
    where: { id: packageId },
    data: {
      repairType: repairType || null,
      coverage: coverage || null,
      ...(logoUrl !== undefined ? { logoUrl } : {})
    }
  });

  revalidatePath('/admin');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
  revalidatePath('/line-app/search');
  revalidatePath('/line-app/compare');
}

export async function updateInsuranceCampaignLogo(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const logoFile = formData.get('logoFile');

  if (!companyCode) {
    throw new Error('Missing companyCode');
  }

  if (!campaignCode) {
    throw new Error('Missing campaignCode');
  }

  if (!(logoFile instanceof File) || logoFile.size === 0) {
    throw new Error('Logo file is required');
  }

  const existingAssets = await getCampaignAssetUrls(companyCode, campaignCode);
  const logoUrl = await saveLogoFile(logoFile, `${companyCode}-${campaignCode}`);

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      logoUrl
    }
  });

  await Promise.all(existingAssets.logoUrls.map((url) => deletePublicUploadFile(url)));

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
  revalidatePath('/line-app/search');
  revalidatePath('/line-app/compare');
}

export async function deleteInsuranceCampaignLogo(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();

  if (!companyCode || !campaignCode) {
    throw new Error('Missing companyCode or campaignCode');
  }

  const existingAssets = await getCampaignAssetUrls(companyCode, campaignCode);

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      logoUrl: null
    }
  });

  await Promise.all(existingAssets.logoUrls.map((url) => deletePublicUploadFile(url)));

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
  revalidatePath('/line-app/search');
  revalidatePath('/line-app/compare');
}

export async function updateInsuranceCampaignProviderContact(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const providerName = String(formData.get('providerName') ?? '').trim();
  const providerEmail = String(formData.get('providerEmail') ?? '').trim();
  const providerContactName = String(formData.get('providerContactName') ?? '').trim();
  const providerPhone = String(formData.get('providerPhone') ?? '').trim();

  if (!companyCode || !campaignCode) {
    throw new Error('Missing companyCode or campaignCode');
  }

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      providerName: providerName || null,
      providerEmail: providerEmail || null,
      providerContactName: providerContactName || null,
      providerPhone: providerPhone || null
    }
  });

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
}

export async function updateInsuranceCampaignPaymentSetup(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const paymentBankName = String(formData.get('paymentBankName') ?? '').trim();
  const paymentAccountName = String(formData.get('paymentAccountName') ?? '').trim();
  const paymentAccountNumber = String(formData.get('paymentAccountNumber') ?? '').trim();
  const paymentUrl = String(formData.get('paymentUrl') ?? '').trim();
  const paymentNotes = String(formData.get('paymentNotes') ?? '').trim();
  const paymentQrFile = formData.get('paymentQrFile');

  if (!companyCode || !campaignCode) {
    throw new Error('Missing companyCode or campaignCode');
  }

  const existingAssets = await getCampaignAssetUrls(companyCode, campaignCode);
  let paymentQrUrl: string | undefined;

  if (paymentQrFile instanceof File && paymentQrFile.size > 0) {
    paymentQrUrl = await savePaymentQrFile(paymentQrFile, `${companyCode}-${campaignCode}`);
  }

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      paymentBankName: paymentBankName || null,
      paymentAccountName: paymentAccountName || null,
      paymentAccountNumber: paymentAccountNumber || null,
      paymentUrl: paymentUrl || null,
      paymentNotes: paymentNotes || null,
      ...(paymentQrUrl !== undefined ? { paymentQrUrl } : {})
    }
  });

  if (paymentQrUrl !== undefined) {
    await Promise.all(existingAssets.paymentQrUrls.map((url) => deletePublicUploadFile(url)));
  }

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}

export async function deleteInsuranceCampaignPaymentQr(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();

  if (!companyCode || !campaignCode) {
    throw new Error('Missing companyCode or campaignCode');
  }

  const existingAssets = await getCampaignAssetUrls(companyCode, campaignCode);

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      paymentQrUrl: null
    }
  });

  await Promise.all(existingAssets.paymentQrUrls.map((url) => deletePublicUploadFile(url)));

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}

export async function importInsuranceCampaign(formData: FormData): Promise<void> {
  const csvFile = formData.get('csvFile');
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const campaignName = String(formData.get('campaignName') ?? '').trim();
  const replaceExisting = String(formData.get('replaceExisting') ?? '').trim() === 'on';
  const logoFile = formData.get('logoFile');

  if (!(csvFile instanceof File)) {
    throw new Error('CSV file is required');
  }

  let logoUrl: string | null | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await saveLogoFile(logoFile, `${companyCode}-${campaignCode || campaignName || 'campaign'}`);
  }

  const csvText = await csvFile.text();
  await importInsuranceCampaignFromCsv({
    csvText,
    companyCode,
    campaignCode,
    campaignName,
    replaceExisting,
    logoUrl
  });

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}

export async function deleteInsuranceCampaign(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const existingAssets = await getCampaignAssetUrls(companyCode, campaignCode);

  await deleteInsuranceCampaignByCode(companyCode, campaignCode);
  await Promise.all([
    ...existingAssets.logoUrls.map((url) => deletePublicUploadFile(url)),
    ...existingAssets.paymentQrUrls.map((url) => deletePublicUploadFile(url))
  ]);

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}
