"use server";

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
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

async function saveLogoFile(logoFile: File, prefix: string): Promise<string> {
  return saveUploadFile(logoFile, {
    directory: 'logos',
    publicPath: 'logos',
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
    message: `Admin updated order status to ${status}`,
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

export async function createInsurerMagicLinkPreview(formData: FormData): Promise<void> {
  const orderId = getRequiredFormValue(formData, 'orderId');

  const order = await prisma.order.findUnique({
    where: { id: orderId }
  });

  if (!order) {
    throw new Error('Order was not found');
  }

  const token = await createMagicLinkTokenForOrder(orderId);

  await createOrderStatusHistory({
    orderId,
    status: order.status,
    message: 'Magic Link email preview was generated for the insurance provider.',
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
    message: 'Policy information submitted. Waiting for checkout.',
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
  let historyMessage = 'Customer submitted a bank transfer slip.';

  if (paymentMethod === 'BANK_TRANSFER') {
    if (!(slipFile instanceof File) || slipFile.size === 0) {
      throw new Error('Payment slip is required for bank transfer');
    }

    slipUrl = await saveSlipFile(slipFile, order.orderNumber);
  } else {
    gatewayUrl = order.gatewayUrl || `https://example.com/payment-gateway/orders/${order.orderNumber}`;
    status = 'PENDING_PAYMENT';
    paymentStatus = 'AWAITING_TRANSFER';
    historyMessage = 'Customer selected card/gateway payment.';
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
  console.log('[Simulated Provider Email]', {
    orderNumber: order.orderNumber,
    provider: order.pkg.company,
    magicLinkPath: `/insurance/update/${insurerToken}`
  });

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
    message: insurerNote || `Insurance provider updated status to ${status}`,
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

  await deleteInsuranceCampaignByCode(companyCode, campaignCode);

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}
