"use server";

import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { isCtpSelected } from '@/lib/ctp';
import { getCtpOptionForSClass } from '@/lib/ctp-rates';
import { getOrderStatusLabel, getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/status-labels';
import {
  DEFAULT_ORDER_COPY_EMAIL,
  getOrderCopyEmailSetting,
  getSalesLeadEmailSetting,
  ORDER_COPY_EMAIL_SETTING_KEY,
  SALES_LEAD_EMAIL_SETTING_KEY,
  upsertSystemSettingValue
} from '@/lib/app-settings';
import {
  deleteInsuranceCampaignByCode,
  importInsuranceCampaignFromCsv
} from '@/lib/insurance-import';
import { isValidThaiAddress } from '@/lib/thai-address';

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
export type TypeOneLeadSalesStatus = 'NEW' | 'CONTACTED' | 'QUOTED' | 'CLOSED';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([...ALLOWED_IMAGE_MIME_TYPES, 'application/pdf']);
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const PAYMENT_QR_MAX_BYTES = 3 * 1024 * 1024;
const SLIP_MAX_BYTES = 8 * 1024 * 1024;
const POLICY_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
const CSV_MAX_BYTES = 15 * 1024 * 1024;
const ALL_ORDER_STATUSES: OrderStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAID',
  'SENT_TO_INSURER',
  'INSURER_REVIEWING',
  'POLICY_APPROVED',
  'POLICY_ISSUED',
  'REJECTED',
  'CANCELLED'
];
const TYPE_ONE_LEAD_SALES_STATUSES = new Set<TypeOneLeadSalesStatus>(['NEW', 'CONTACTED', 'QUOTED', 'CLOSED']);

function formatOrderNumber(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 900000 + 100000);
  return `IN-${ymd}-${suffix}`;
}

function formatLeadNumber(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 900000 + 100000);
  return `QL-${ymd}-${suffix}`;
}

function hashMagicToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createRawMagicToken() {
  return randomBytes(32).toString('base64url');
}

function getPublicAppBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim();

  if (!baseUrl) {
    return '';
  }

  return baseUrl.replace(/\/+$/, '');
}

function getAbsoluteAppUrl(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) {
    return '';
  }

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const baseUrl = getPublicAppBaseUrl();
  return baseUrl ? `${baseUrl}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}` : pathOrUrl;
}

function formatThaiBaht(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function isLocalUrl(url: URL) {
  return ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
}

function normalizeExternalUrl(value: string | null, fieldName: string) {
  if (!value) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }

  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:' && isLocalUrl(parsed))) {
    throw new Error(`${fieldName} must use HTTPS`);
  }

  return parsed.toString();
}

async function readCsvUpload(file: File) {
  const fileName = file.name.toLowerCase();

  if (file.size > CSV_MAX_BYTES) {
    throw new Error(`CSV file is too large. Maximum size is ${Math.floor(CSV_MAX_BYTES / 1024 / 1024)} MB.`);
  }

  if (!fileName.endsWith('.csv') && file.type && !['text/csv', 'application/vnd.ms-excel'].includes(file.type)) {
    throw new Error('CSV import file must be a .csv file');
  }

  const text = await file.text();

  if (text.includes('\u0000')) {
    throw new Error('CSV import file is not a valid text file');
  }

  return text;
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

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || null;
}

function assertMaxLength(value: string | null, maxLength: number, fieldName: string) {
  if (value && value.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }
}

function normalizePhone(value: string | null, fieldName: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/\D/g, '');

  if (digits.length < 9 || digits.length > 15) {
    throw new Error(`${fieldName} must contain 9-15 digits`);
  }

  return normalized;
}

function normalizeEmail(value: string | null, fieldName: string) {
  const normalized = normalizeWhitespace(value)?.toLowerCase() ?? null;

  if (!normalized) {
    return null;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error(`${fieldName} must be a valid email address`);
  }

  return normalized;
}

function normalizeThaiIdCard(value: string | null) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    return null;
  }

  const digits = normalized.replace(/\D/g, '');

  if (!/^\d{13}$/.test(digits)) {
    throw new Error('ID card number must contain 13 digits');
  }

  const checksum =
    (11 -
      digits
        .slice(0, 12)
        .split('')
        .reduce((total, digit, index) => total + Number(digit) * (13 - index), 0) %
        11) %
    10;

  if (checksum !== Number(digits[12])) {
    throw new Error('ID card number checksum is invalid');
  }

  return digits;
}

function normalizePlateNumber(value: string) {
  const normalized = normalizeWhitespace(value);

  if (!normalized) {
    throw new Error('Plate number is required');
  }

  if (normalized.length > 20 || !/^[0-9A-Za-zก-ฮ.\-\s]+$/.test(normalized)) {
    throw new Error('Plate number contains invalid characters');
  }

  return normalized.toUpperCase();
}

function parseCarYear(value: string | null, fallback: number | null | undefined) {
  const parsedInput = parseOptionalInt(value);
  const parsed = parsedInput && parsedInput >= 2400 ? parsedInput - 543 : parsedInput ?? fallback ?? null;

  if (parsed === null) {
    return null;
  }

  const nextYear = new Date().getFullYear() + 1;

  if (parsed < 1950 || parsed > nextYear) {
    throw new Error(`Car year must be between 1950 and ${nextYear}`);
  }

  return parsed;
}

function normalizeUploadedMimeType(value: string | null | undefined) {
  const normalized = value?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (normalized === 'image/jpg' || normalized === 'image/pjpeg') {
    return 'image/jpeg';
  }

  if (normalized === 'application/x-pdf') {
    return 'application/pdf';
  }

  return normalized;
}

function parsePolicyStartDate(value: string | null) {
  const parsed = parseOptionalDate(value);

  if (!parsed) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 30);
  const maxDate = new Date(today);
  maxDate.setFullYear(maxDate.getFullYear() + 1);

  if (parsed < minDate || parsed > maxDate) {
    throw new Error('Policy start date must be within 30 days in the past and 1 year in the future');
  }

  return parsed;
}

function getDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseRequiredPolicyStartDate(value: string | null, fieldName: string) {
  const parsed = parsePolicyStartDate(value);

  if (!parsed) {
    throw new Error(`${fieldName} is required`);
  }

  return parsed;
}

async function assertCtpPolicyStartDateAllowed(date: Date) {
  const dateKey = getDateKey(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = getDateKey(today);

  if (dateKey !== todayKey) {
    return;
  }

  const day = date.getDay();

  if (day === 0 || day === 6) {
    throw new Error('Same-day CTP policy start date is not available on Saturday or Sunday');
  }

  if (new Date().getHours() >= 16) {
    throw new Error('Same-day CTP policy start date is not available after 16:00');
  }

  const holiday = await prisma.businessHoliday.findUnique({
    where: {
      date: new Date(dateKey)
    }
  });

  if (holiday) {
    throw new Error('Same-day CTP policy start date is not available on a configured business holiday');
  }
}

function normalizeChassisNumber(value: string | null) {
  const normalized = normalizeWhitespace(value)?.toUpperCase() ?? null;

  if (!normalized) {
    throw new Error('Chassis number is required');
  }

  if (normalized.length > 40 || !/^[0-9A-Z\-\s]+$/.test(normalized)) {
    throw new Error('Chassis number contains invalid characters');
  }

  return normalized;
}

function normalizeShortText(value: string | null, maxLength: number, fieldName: string) {
  const normalized = normalizeWhitespace(value);
  assertMaxLength(normalized, maxLength, fieldName);
  return normalized;
}

function parseOptionalInt(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRequiredMoney(value: string | null, fieldName: string) {
  const normalized = value?.replace(/,/g, '').trim();
  const parsed = normalized ? Number.parseFloat(normalized) : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a valid non-negative number`);
  }

  return Math.round(parsed * 100) / 100;
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
    carCubicCapacity: string | null;
    plateNumber: string | null;
    plateProvince: string | null;
    chassisNumber: string | null;
    idCardNumber: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    policyStartDate: Date | null;
    ctpPolicyStartDate: Date | null;
    deliveryAddressMode: string | null;
    deliveryRecipientName: string | null;
    deliveryRecipientPhone: string | null;
    deliveryAddress: string | null;
    vehicleDocumentUrl: string | null;
    vehicleDocumentType: string | null;
    paymentMethod: string | null;
    paymentStatus: string;
    slipUrl: string | null;
    gatewayUrl: string | null;
    ctpSelected: boolean;
    ctpRateCode: string | null;
    ctpTotal: number | null;
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
  const magicLinkUrl = getAbsoluteAppUrl(magicLinkPath);
  const slipUrl = getAbsoluteAppUrl(order.slipUrl);
  const gatewayUrl = getAbsoluteAppUrl(order.gatewayUrl);
  const vehicleDocumentUrl = getAbsoluteAppUrl(order.vehicleDocumentUrl);
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const car = [order.carBrand, order.carModel, order.carCubicCapacity, order.carYear].filter(Boolean).join(' / ') || '-';
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
    order.customerEmail ? `Customer email: ${order.customerEmail}` : null,
    order.idCardNumber ? `ID card: ${order.idCardNumber}` : null,
    order.customerAddress ? `Customer address: ${order.customerAddress}` : null,
    `Vehicle: ${car}`,
    `Plate: ${plate}`,
    order.chassisNumber ? `Chassis number: ${order.chassisNumber}` : null,
    order.policyStartDate ? `Voluntary policy start date: ${order.policyStartDate.toLocaleDateString('th-TH')}` : null,
    order.ctpPolicyStartDate ? `CTP policy start date: ${order.ctpPolicyStartDate.toLocaleDateString('th-TH')}` : null,
    order.deliveryAddress ? `Policy delivery: ${order.deliveryAddressMode === 'other' ? 'Other address' : 'Same address'} / ${order.deliveryRecipientName ?? '-'} / ${order.deliveryRecipientPhone ?? '-'} / ${order.deliveryAddress}` : null,
    `Package: ${order.pkg.name}`,
    order.ctpSelected ? `CTP/CMI: ${order.ctpRateCode ?? '-'} (${order.ctpTotal ?? 0} THB)` : null,
    `Payment method: ${getPaymentMethodLabel(order.paymentMethod)}`,
    `Payment status: ${getPaymentStatusLabel(order.paymentStatus)}`,
    slipUrl ? `Payment slip: ${slipUrl}` : null,
    vehicleDocumentUrl ? `${order.vehicleDocumentType ?? 'Vehicle document'}: ${vehicleDocumentUrl}` : null,
    gatewayUrl ? `Gateway URL: ${gatewayUrl}` : null,
    '',
    `Update policy status here: ${magicLinkUrl}`,
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

function buildOrderCopyEmail(input: {
  order: {
    orderNumber: string;
    customerName: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    carBrand: string | null;
    carModel: string | null;
    carYear: number | null;
    carCubicCapacity: string | null;
    plateNumber: string | null;
    plateProvince: string | null;
    paymentMethod: string | null;
    paymentStatus: string;
    paymentAmount: number | null;
    ctpSelected: boolean;
    ctpRateCode: string | null;
    ctpTotal: number | null;
    slipUrl: string | null;
    gatewayUrl: string | null;
    user: {
      name: string | null;
      phone: string | null;
    };
    pkg: {
      name: string;
      company: string;
      netPrice: number;
      payablePrice: number | null;
    };
  };
  recipient: string;
}) {
  const { order, recipient } = input;
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const car = [order.carBrand, order.carModel, order.carCubicCapacity, order.carYear].filter(Boolean).join(' / ') || '-';
  const plate = [order.plateNumber, order.plateProvince].filter(Boolean).join(' ') || '-';
  const slipUrl = getAbsoluteAppUrl(order.slipUrl);
  const gatewayUrl = getAbsoluteAppUrl(order.gatewayUrl);
  const payableAmount =
    order.paymentAmount ??
    (order.pkg.payablePrice ?? order.pkg.netPrice) + (order.ctpSelected ? order.ctpTotal ?? 0 : 0);
  const subject = `[Order Copy] ${order.orderNumber} - ${customerName}`;
  const body = [
    'มีรายการสั่งซื้อสำเร็จจาก LINE Mini App',
    '',
    `เลขที่คำสั่งซื้อ: ${order.orderNumber}`,
    `ลูกค้า: ${customerName}`,
    `เบอร์โทร: ${customerPhone}`,
    order.customerEmail ? `อีเมลลูกค้า: ${order.customerEmail}` : null,
    `รถ: ${car}`,
    `ทะเบียน: ${plate}`,
    `บริษัทประกัน: ${order.pkg.company}`,
    `แพ็กเกจ: ${order.pkg.name}`,
    `วิธีชำระเงิน: ${getPaymentMethodLabel(order.paymentMethod)}`,
    `สถานะชำระเงิน: ${getPaymentStatusLabel(order.paymentStatus)}`,
    `ยอดคงเหลือชำระ: ${formatThaiBaht(payableAmount)}`,
    order.ctpSelected ? `พ.ร.บ.: ${order.ctpRateCode ?? '-'} / ${formatThaiBaht(order.ctpTotal)}` : null,
    slipUrl ? `สลิปชำระเงิน: ${slipUrl}` : null,
    gatewayUrl ? `ลิงก์ชำระเงินบริษัทประกัน: ${gatewayUrl}` : null,
    '',
    'อีเมลนี้เป็นสำเนาแจ้งเตือนเพื่อให้ทราบว่ามีรายการสั่งซื้อสำเร็จ'
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  return {
    recipient,
    subject,
    body
  };
}

async function createOrderCopyEmailOutbox(orderId: string) {
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

  const configuredCopyEmail = await getOrderCopyEmailSetting();
  const recipient = normalizeEmail(
    configuredCopyEmail ?? process.env.ORDER_COPY_EMAIL ?? DEFAULT_ORDER_COPY_EMAIL,
    'Order copy email'
  );
  const email = buildOrderCopyEmail({
    order,
    recipient: recipient ?? DEFAULT_ORDER_COPY_EMAIL
  });
  const status = email.recipient ? 'QUEUED' : 'MISSING_RECIPIENT';
  const existingOutbox = await prisma.emailOutbox.findFirst({
    where: {
      orderId: null,
      magicLinkPath: null,
      subject: email.subject
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (existingOutbox?.status === 'SENT') {
    return existingOutbox;
  }

  if (existingOutbox) {
    return prisma.emailOutbox.update({
      where: {
        id: existingOutbox.id
      },
      data: {
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        magicLinkPath: null,
        status,
        sentAt: null,
        errorAt: status === 'MISSING_RECIPIENT' ? new Date() : null,
        errorMessage: status === 'MISSING_RECIPIENT' ? 'Order copy email is missing.' : null
      }
    });
  }

  return prisma.emailOutbox.create({
    data: {
      orderId: null,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      magicLinkPath: null,
      status,
      errorAt: status === 'MISSING_RECIPIENT' ? new Date() : null,
      errorMessage: status === 'MISSING_RECIPIENT' ? 'Order copy email is missing.' : null
    }
  });
}

function renderProviderEmailHtml(body: string, magicLinkPath: string | null) {
  const magicLinkUrl = getAbsoluteAppUrl(magicLinkPath);
  const content = body
    .split('\n')
    .filter((line) => !line.startsWith('Update policy status here:'))
    .map((line) => {
      if (!line.trim()) {
        return '<div style="height:12px;line-height:12px">&nbsp;</div>';
      }

      return `<p style="margin:0 0 8px 0;color:#111827;font-size:14px;line-height:1.6">${escapeHtml(line)}</p>`;
    })
    .join('');

  const actionButton = magicLinkUrl
    ? `
      <div style="margin:24px 0">
        <a href="${escapeHtml(magicLinkUrl)}" style="display:inline-block;background:#0052cc;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:10px">
          Update policy status
        </a>
        <p style="margin:12px 0 0 0;color:#6b7280;font-size:12px;line-height:1.5">
          If the button does not work, open this link:<br>
          <a href="${escapeHtml(magicLinkUrl)}" style="color:#0052cc;word-break:break-all">${escapeHtml(magicLinkUrl)}</a>
        </p>
      </div>
    `
    : '';

  return `
    <div style="margin:0;padding:0;background:#f8fafc">
      <div style="max-width:640px;margin:0 auto;padding:24px">
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:24px;font-family:Arial,Helvetica,sans-serif">
          ${content}
          ${actionButton}
        </div>
      </div>
    </div>
  `;
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
      orderId: order.id,
      magicLinkPath: {
        not: null
      }
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

async function sendProviderEmail(input: {
  recipient: string;
  subject: string;
  body: string;
  magicLinkPath: string | null;
}) {
  const emailProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'mock';
  const from = process.env.EMAIL_FROM?.trim();

  if (emailProvider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const appBaseUrl = getPublicAppBaseUrl();

    if (!apiKey || !from || !appBaseUrl) {
      throw new Error('RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL are required when EMAIL_PROVIDER=resend');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: input.recipient,
        subject: input.subject,
        text: input.body,
        html: renderProviderEmailHtml(input.body, input.magicLinkPath)
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`Resend email failed (${response.status}): ${responseText.slice(0, 500)}`);
    }

    return;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_PROVIDER must be configured for production email delivery');
  }

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
    await sendProviderEmail({
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

function sanitizeFilePrefix(prefix: string) {
  return prefix
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload';
}

function detectImageMime(buffer: Buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) {
    return 'image/gif';
  }

  return null;
}

function detectDocumentMime(buffer: Buffer) {
  const imageMime = detectImageMime(buffer);

  if (imageMime) {
    return imageMime;
  }

  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
    return 'application/pdf';
  }

  return null;
}

function getExtensionForMime(mimeType: string) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'application/pdf') return '.pdf';
  return '.bin';
}

function assertLocalUploadsAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_LOCAL_UPLOADS_IN_PRODUCTION !== 'true') {
    throw new Error('Local uploads are disabled in production. Configure object storage or set ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true only if the host has persistent storage.');
  }
}

function getUploadStorageDriver() {
  return process.env.UPLOAD_STORAGE_DRIVER?.trim().toLowerCase() || 'local';
}

function getS3Config() {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() || 'auto';
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error('S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_PUBLIC_BASE_URL are required when UPLOAD_STORAGE_DRIVER=s3');
  }

  return {
    endpoint: endpoint.replace(/\/+$/, ''),
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl
  };
}

function sha256Hex(input: Buffer | string) {
  return createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function getS3SigningKey(secretAccessKey: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, 's3');
  return hmac(dateRegionServiceKey, 'aws4_request');
}

function encodeS3PathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildS3CanonicalUri(bucket: string, key: string) {
  return `/${encodeS3PathSegment(bucket)}/${key.split('/').map(encodeS3PathSegment).join('/')}`;
}

async function requestS3Object(input: {
  method: 'PUT' | 'DELETE';
  key: string;
  body?: Buffer;
  contentType?: string;
}) {
  const config = getS3Config();
  const endpointUrl = new URL(config.endpoint);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body ?? '');
  const canonicalUri = buildS3CanonicalUri(config.bucket, input.key);
  const canonicalHeaders = [
    input.contentType ? `content-type:${input.contentType}` : null,
    `host:${endpointUrl.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`
  ]
    .filter((header): header is string => Boolean(header))
    .join('\n');
  const signedHeaders = input.contentType
    ? 'content-type;host;x-amz-content-sha256;x-amz-date'
    : 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    input.method,
    canonicalUri,
    '',
    `${canonicalHeaders}\n`,
    signedHeaders,
    payloadHash
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const signature = createHmac('sha256', getS3SigningKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign)
    .digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(`${config.endpoint}${canonicalUri}`, {
    method: input.method,
    headers: {
      ...(input.contentType ? { 'Content-Type': input.contentType } : {}),
      Authorization: authorization,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    },
    body: input.body ? new Blob([new Uint8Array(input.body)]) : undefined
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Object storage ${input.method} failed (${response.status}): ${responseText.slice(0, 500)}`);
  }
}

async function saveObjectUploadFile(key: string, buffer: Buffer, contentType: string) {
  const config = getS3Config();

  await requestS3Object({
    method: 'PUT',
    key,
    body: buffer,
    contentType
  });

  return `${config.publicBaseUrl}/${key.split('/').map(encodeS3PathSegment).join('/')}`;
}

async function saveUploadFile(file: File, options: { directory: string; publicPath: string; prefix: string; maxBytes: number }) {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error('Upload file must be a PNG, JPG, WebP, or GIF image');
  }

  if (file.size > options.maxBytes) {
    throw new Error(`Upload file is too large. Maximum size is ${Math.floor(options.maxBytes / 1024 / 1024)} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMime(buffer);

  if (!detectedMime || detectedMime !== file.type) {
    throw new Error('Upload file content does not match the selected image type');
  }

  const fileName = `${sanitizeFilePrefix(options.prefix)}-${randomUUID()}${getExtensionForMime(detectedMime)}`;
  const objectKey = `${options.publicPath}/${fileName}`;

  if (getUploadStorageDriver() === 's3') {
    return saveObjectUploadFile(objectKey, buffer, detectedMime);
  }

  assertLocalUploadsAllowed();

  const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', options.directory);
  await mkdir(uploadDirectory, { recursive: true });
  const filePath = path.join(uploadDirectory, fileName);

  await writeFile(filePath, buffer);
  return `/uploads/${options.publicPath}/${fileName}`;
}

async function deletePublicUploadFile(publicUrl: string | null | undefined) {
  const s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');

  if (publicUrl && s3PublicBaseUrl && publicUrl.startsWith(`${s3PublicBaseUrl}/`)) {
    const key = publicUrl
      .slice(s3PublicBaseUrl.length + 1)
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');

    if (!key.includes('..')) {
      try {
        await requestS3Object({
          method: 'DELETE',
          key
        });
      } catch (error) {
        console.warn('[Object Storage Cleanup Failed]', {
          publicUrl,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return;
  }

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
    prefix,
    maxBytes: LOGO_MAX_BYTES
  });
}

async function savePaymentQrFile(qrFile: File, prefix: string): Promise<string> {
  return saveUploadFile(qrFile, {
    directory: 'payment-qrs',
    publicPath: 'payment-qrs',
    prefix,
    maxBytes: PAYMENT_QR_MAX_BYTES
  });
}

async function saveSlipFile(slipFile: File, prefix: string): Promise<string> {
  return saveUploadFile(slipFile, {
    directory: 'slips',
    publicPath: 'slips',
    prefix,
    maxBytes: SLIP_MAX_BYTES
  });
}

async function saveDocumentUploadFile(file: File, options: { directory: string; publicPath: string; prefix: string; maxBytes: number }) {
  const declaredMime = normalizeUploadedMimeType(file.type);
  const hasGenericMime = !declaredMime || declaredMime === 'application/octet-stream' || declaredMime === 'binary/octet-stream';

  if (!hasGenericMime && !ALLOWED_DOCUMENT_MIME_TYPES.has(declaredMime)) {
    throw new Error('Document upload must be a PNG, JPG, WebP, GIF, or PDF file');
  }

  if (file.size > options.maxBytes) {
    throw new Error(`Document upload is too large. Maximum size is ${Math.floor(options.maxBytes / 1024 / 1024)} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectDocumentMime(buffer);

  if (!detectedMime || (!hasGenericMime && detectedMime !== declaredMime)) {
    throw new Error('Document upload content does not match the selected file type');
  }

  const fileName = `${sanitizeFilePrefix(options.prefix)}-${randomUUID()}${getExtensionForMime(detectedMime)}`;
  const objectKey = `${options.publicPath}/${fileName}`;

  if (getUploadStorageDriver() === 's3') {
    return saveObjectUploadFile(objectKey, buffer, detectedMime);
  }

  assertLocalUploadsAllowed();

  const uploadDirectory = path.join(process.cwd(), 'public', 'uploads', options.directory);
  await mkdir(uploadDirectory, { recursive: true });
  const filePath = path.join(uploadDirectory, fileName);

  await writeFile(filePath, buffer);
  return `/uploads/${options.publicPath}/${fileName}`;
}

async function saveVehicleDocumentFile(file: File, prefix: string): Promise<string> {
  return saveDocumentUploadFile(file, {
    directory: 'vehicle-documents',
    publicPath: 'vehicle-documents',
    prefix,
    maxBytes: POLICY_DOCUMENT_MAX_BYTES
  });
}

async function savePolicyPdfFile(file: File, prefix: string): Promise<string> {
  if (file.type !== 'application/pdf') {
    throw new Error('Policy document must be a PDF file');
  }

  return saveDocumentUploadFile(file, {
    directory: 'policy-pdfs',
    publicPath: 'policy-pdfs',
    prefix,
    maxBytes: POLICY_DOCUMENT_MAX_BYTES
  });
}

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as OrderStatus;

  if (!orderId || !status) {
    throw new Error('Missing orderId or status');
  }

  if (!ALL_ORDER_STATUSES.includes(status)) {
    throw new Error('Invalid order status');
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
  revalidatePath('/admin/leads');
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
  const lineId = normalizeShortText(getOptionalFormValue(formData, 'lineId'), 120, 'LINE ID') ?? `guest:${randomUUID()}`;
  const lineDisplayName = normalizeShortText(getOptionalFormValue(formData, 'lineDisplayName'), 120, 'LINE display name');
  const linePictureUrl = normalizeExternalUrl(getOptionalFormValue(formData, 'linePictureUrl'), 'LINE picture URL');
  const customerName = normalizeShortText(getRequiredFormValue(formData, 'customerName'), 120, 'Customer name') ?? '';
  const customerPhone = normalizePhone(getRequiredFormValue(formData, 'customerPhone'), 'Customer phone') ?? '';
  const plateNumber = normalizePlateNumber(getRequiredFormValue(formData, 'plateNumber'));
  const customerEmail = normalizeEmail(getOptionalFormValue(formData, 'customerEmail'), 'Customer email');
  const customerAddress = normalizeShortText(getRequiredFormValue(formData, 'customerAddress'), 1000, 'Customer address') ?? '';
  const province = normalizeShortText(getRequiredFormValue(formData, 'province'), 80, 'Province');
  const district = normalizeShortText(getRequiredFormValue(formData, 'district'), 80, 'District');
  const subDistrict = normalizeShortText(getRequiredFormValue(formData, 'subDistrict'), 80, 'Subdistrict');
  const postalCode = normalizeShortText(getRequiredFormValue(formData, 'postalCode'), 10, 'Postal code');
  const idCardNumber = normalizeThaiIdCard(getRequiredFormValue(formData, 'idCardNumber'));
  const carBrand = normalizeShortText(getRequiredFormValue(formData, 'carBrand'), 80, 'Car brand') ?? '';
  const carModel = normalizeShortText(getRequiredFormValue(formData, 'carModel'), 120, 'Car model') ?? '';
  const carCubicCapacity = normalizeShortText(getRequiredFormValue(formData, 'carCubicCapacity'), 80, 'Car cubic capacity') ?? '';
  const carYear = parseCarYear(getRequiredFormValue(formData, 'carYear'), null);
  const plateProvince = normalizeShortText(getOptionalFormValue(formData, 'plateProvince'), 80, 'Plate province');
  const chassisNumber = normalizeChassisNumber(getRequiredFormValue(formData, 'chassisNumber'));
  const policyStartDate = parseRequiredPolicyStartDate(getRequiredFormValue(formData, 'policyStartDate'), 'Voluntary policy start date');
  const deliveryAddressMode = getOptionalFormValue(formData, 'deliveryAddressMode') === 'other' ? 'other' : 'same';
  const deliveryRecipientName =
    deliveryAddressMode === 'other'
      ? normalizeShortText(getRequiredFormValue(formData, 'deliveryRecipientName'), 120, 'Delivery recipient name')
      : customerName;
  const deliveryRecipientPhone =
    deliveryAddressMode === 'other'
      ? normalizePhone(getRequiredFormValue(formData, 'deliveryRecipientPhone'), 'Delivery recipient phone')
      : customerPhone;
  const deliveryAddress =
    deliveryAddressMode === 'other'
      ? normalizeShortText(getRequiredFormValue(formData, 'deliveryAddress'), 1000, 'Delivery address')
      : [customerAddress, subDistrict, district, province, postalCode].filter(Boolean).join(' ');
  const vehicleDocumentType = normalizeShortText(getRequiredFormValue(formData, 'vehicleDocumentType'), 80, 'Vehicle document type') ?? '';
  const vehicleDocumentFile = formData.get('vehicleDocumentFile');

  const selectedPackage = await prisma.insurancePackage.findUnique({
    where: { id: packageId }
  });

  if (!selectedPackage) {
    throw new Error('Selected package was not found');
  }

  const ctpOption = await getCtpOptionForSClass(selectedPackage.sClass);
  const includeCtp = isCtpSelected(formData.get('includeCtp'));

  if (includeCtp && !ctpOption) {
    throw new Error('CTP is available only for vehicle class 110 or 320');
  }

  if (!(vehicleDocumentFile instanceof File) || vehicleDocumentFile.size === 0) {
    throw new Error('Vehicle registration or previous policy document is required');
  }

  if (
    !isValidThaiAddress({
      province,
      district,
      subDistrict,
      postalCode
    })
  ) {
    throw new Error('Selected customer address is invalid');
  }

  const ctpPolicyStartDate = includeCtp
    ? parseRequiredPolicyStartDate(getRequiredFormValue(formData, 'ctpPolicyStartDate'), 'CTP policy start date')
    : null;

  if (ctpPolicyStartDate) {
    await assertCtpPolicyStartDateAllowed(ctpPolicyStartDate);
  }

  const ctpTotal = includeCtp && ctpOption ? ctpOption.total : 0;
  const paymentAmount = (selectedPackage.payablePrice ?? selectedPackage.netPrice) + ctpTotal;
  const orderNumber = formatOrderNumber();
  const vehicleDocumentUrl = await saveVehicleDocumentFile(vehicleDocumentFile, orderNumber);

  const user = await prisma.user.upsert({
    where: {
      lineId
    },
    create: {
      lineId,
      lineDisplayName,
      linePictureUrl,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      consentedAt: new Date()
    },
    update: {
      ...(lineDisplayName ? { lineDisplayName } : {}),
      ...(linePictureUrl ? { linePictureUrl } : {}),
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      consentedAt: new Date()
    }
  });

  const order = await prisma.order.create({
    data: {
      orderNumber,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      paymentAmount,
      ctpSelected: includeCtp,
      ctpRateCode: includeCtp && ctpOption ? ctpOption.rateCode : null,
      ctpVehicleTypeCode: includeCtp && ctpOption ? ctpOption.cmiVehicleTypeCode : null,
      ctpPremium: includeCtp && ctpOption ? ctpOption.premium : null,
      ctpStamp: includeCtp && ctpOption ? ctpOption.stamp : null,
      ctpVat: includeCtp && ctpOption ? ctpOption.vat : null,
      ctpTotal: includeCtp && ctpOption ? ctpOption.total : null,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      province,
      district,
      subDistrict,
      postalCode,
      idCardNumber,
      carBrand,
      carModel,
      carYear,
      carCubicCapacity,
      plateNumber,
      plateProvince,
      chassisNumber,
      policyStartDate,
      ctpPolicyStartDate,
      deliveryAddressMode,
      deliveryRecipientName,
      deliveryRecipientPhone,
      deliveryAddress,
      vehicleDocumentUrl,
      vehicleDocumentType,
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

export async function createTypeOneQuoteLead(input: {
  customerName: string;
  customerPhone: string;
  lineId?: string;
  lineDisplayName?: string;
  email?: string;
  sClass?: string;
  brand: string;
  model: string;
  year: string;
  cubicCapacity: string;
}): Promise<{ ok: true; leadNumber: string }> {
  const customerName = normalizeShortText(input.customerName, 120, 'Customer name');
  const customerPhone = normalizePhone(input.customerPhone, 'Customer phone');
  const email = normalizeEmail(input.email ?? null, 'Customer email');
  const lineId = normalizeShortText(input.lineId ?? '', 120, 'LINE ID');
  const lineDisplayName = normalizeShortText(input.lineDisplayName ?? '', 120, 'LINE display name');
  const sClass = normalizeShortText(input.sClass ?? '', 20, 'Vehicle class');
  const brand = normalizeShortText(input.brand, 120, 'Brand');
  const model = normalizeShortText(input.model, 120, 'Model');
  const cubicCapacity = normalizeShortText(input.cubicCapacity, 80, 'Cubic capacity');
  const carYear = Number.parseInt(input.year, 10);

  if (!customerName || !customerPhone || !brand || !model || !cubicCapacity) {
    throw new Error('Required quote lead fields are missing');
  }

  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(carYear) || carYear < 1950 || carYear > currentYear + 1) {
    throw new Error(`Car year must be between 1950 and ${currentYear + 1}`);
  }

  let leadNumber = formatLeadNumber();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existing = await prisma.typeOneQuoteLead.findUnique({
      where: {
        leadNumber
      }
    });

    if (!existing) {
      break;
    }

    leadNumber = formatLeadNumber();
  }

  const configuredSalesEmail = await getSalesLeadEmailSetting();
  const salesEmail = normalizeEmail(configuredSalesEmail ?? process.env.SALES_LEAD_EMAIL ?? null, 'Sales lead email');
  const subject = `[Type 1 Quote] ${leadNumber} - ${brand} ${model} ${carYear}`;
  const vehicleSizeLabel = sClass === '210' ? `Seat count: up to ${cubicCapacity}` : `Cubic capacity: ${cubicCapacity} cc`;
  const body = [
    'New Type 1 quote request',
    '',
    `Lead number: ${leadNumber}`,
    `Customer: ${customerName}`,
    `Phone: ${customerPhone}`,
    lineId ? `LINE ID: ${lineId}` : null,
    lineDisplayName ? `LINE display name: ${lineDisplayName}` : null,
    email ? `Email: ${email}` : null,
    '',
    `Vehicle class: ${sClass ?? '-'}`,
    `Brand: ${brand}`,
    `Model: ${model}`,
    `Registration year: ${carYear}`,
    vehicleSizeLabel,
    '',
    'This is an automated broker system message.'
  ]
    .filter((line): line is string => line !== null)
    .join('\n');

  const lead = await prisma.typeOneQuoteLead.create({
    data: {
      leadNumber,
      customerName,
      customerPhone,
      lineId,
      lineDisplayName,
      email,
      sClass,
      brand,
      model,
      carYear,
      cubicCapacity
    }
  });

  const outbox = await prisma.emailOutbox.create({
    data: {
      recipient: salesEmail,
      subject,
      body,
      status: salesEmail ? 'QUEUED' : 'MISSING_RECIPIENT',
      errorAt: salesEmail ? null : new Date(),
      errorMessage: salesEmail ? null : 'SALES_LEAD_EMAIL is missing. Set this env value to notify the sales team.'
    }
  });

  await prisma.typeOneQuoteLead.update({
    where: {
      id: lead.id
    },
    data: {
      emailOutboxId: outbox.id
    }
  });

  if (salesEmail) {
    await deliverEmailOutboxItem(outbox.id);
  }

  revalidatePath('/admin');
  return { ok: true, leadNumber };
}

export async function updateSalesLeadEmailSetting(formData: FormData): Promise<void> {
  const salesEmail = normalizeEmail(getRequiredFormValue(formData, 'salesLeadEmail'), 'Sales lead email');

  if (!salesEmail) {
    throw new Error('Sales lead email is required');
  }

  await upsertSystemSettingValue(SALES_LEAD_EMAIL_SETTING_KEY, salesEmail);

  revalidatePath('/admin/insurance');
  revalidatePath('/admin/readiness');
}

export async function updateOrderCopyEmailSetting(formData: FormData): Promise<void> {
  const orderCopyEmail = normalizeEmail(getRequiredFormValue(formData, 'orderCopyEmail'), 'Order copy email');

  if (!orderCopyEmail) {
    throw new Error('Order copy email is required');
  }

  await upsertSystemSettingValue(ORDER_COPY_EMAIL_SETTING_KEY, orderCopyEmail);

  revalidatePath('/admin/insurance');
  revalidatePath('/admin/readiness');
}

export async function addBusinessHoliday(formData: FormData): Promise<void> {
  const dateValue = getRequiredFormValue(formData, 'holidayDate');
  const label = normalizeShortText(getOptionalFormValue(formData, 'holidayLabel'), 120, 'Holiday label');
  const parsedDate = parseOptionalDate(dateValue);

  if (!parsedDate) {
    throw new Error('Holiday date is invalid');
  }

  const date = new Date(getDateKey(parsedDate));

  await prisma.businessHoliday.upsert({
    where: {
      date
    },
    create: {
      date,
      label
    },
    update: {
      label
    }
  });

  revalidatePath('/admin/insurance');
  revalidatePath('/line-app/form');
}

export async function deleteBusinessHoliday(formData: FormData): Promise<void> {
  const holidayId = getRequiredFormValue(formData, 'holidayId');

  await prisma.businessHoliday.delete({
    where: {
      id: holidayId
    }
  });

  revalidatePath('/admin/insurance');
  revalidatePath('/line-app/form');
}

export async function updateTypeOneQuoteLeadFollowUp(formData: FormData): Promise<void> {
  const leadId = getRequiredFormValue(formData, 'leadId');
  const salesStatus = normalizeShortText(
    getRequiredFormValue(formData, 'salesStatus'),
    40,
    'Sales follow-up status'
  ) as TypeOneLeadSalesStatus | null;
  const salesNote = normalizeShortText(getOptionalFormValue(formData, 'salesNote'), 1000, 'Sales note');

  if (!salesStatus || !TYPE_ONE_LEAD_SALES_STATUSES.has(salesStatus)) {
    throw new Error('Invalid sales follow-up status');
  }

  await prisma.typeOneQuoteLead.update({
    where: {
      id: leadId
    },
    data: {
      salesStatus,
      salesNote
    }
  });

  revalidatePath('/admin/leads');
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
      paymentAmount: order.paymentAmount ?? order.pkg.payablePrice ?? order.pkg.netPrice,
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

  const orderCopyEmailOutbox = await createOrderCopyEmailOutbox(orderId);
  await deliverEmailOutboxItem(orderCopyEmailOutbox.id);

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
  const insurerNote = normalizeShortText(getOptionalFormValue(formData, 'insurerNote'), 2000, 'Insurer note');
  const actorName = normalizeShortText(getOptionalFormValue(formData, 'actorName'), 120, 'Actor name') ?? 'Insurance provider';
  const policyNumber = normalizeShortText(getOptionalFormValue(formData, 'policyNumber'), 80, 'Policy number');
  const policyPdfFile = formData.get('policyPdfFile');

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

  const isMagicLinkClosed = Boolean(
    magicToken?.usedAt && (magicToken.order.status === 'POLICY_ISSUED' || magicToken.order.status === 'REJECTED')
  );

  if (!magicToken || magicToken.expiresAt < new Date() || isMagicLinkClosed) {
    throw new Error('Magic link is invalid or expired');
  }

  const isTerminalStatus = status === 'POLICY_ISSUED' || status === 'REJECTED';
  const hasNewPolicyPdf = policyPdfFile instanceof File && policyPdfFile.size > 0;

  if (status === 'POLICY_ISSUED' && !hasNewPolicyPdf && !magicToken.order.policyPdfUrl) {
    throw new Error('Policy PDF is required before marking the policy as issued');
  }

  const policyPdfUrl = hasNewPolicyPdf ? await savePolicyPdfFile(policyPdfFile, magicToken.order.orderNumber) : null;

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: {
        id: magicToken.orderId
      },
      data: {
        status,
        insurerStatus: status,
        insurerNote,
        insurerUpdatedAt: new Date(),
        ...(policyNumber ? { policyNumber } : {}),
        ...(policyPdfUrl
          ? {
              policyPdfUrl,
              policyPdfUploadedAt: new Date()
            }
          : {})
      }
    });

    if (isTerminalStatus) {
      await tx.magicLinkToken.updateMany({
        where: {
          orderId: magicToken.orderId,
          purpose: magicToken.purpose
        },
        data: {
          usedAt: new Date()
        }
      });
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
  const repairType = normalizeShortText(String(formData.get('repairType') ?? ''), 120, 'Repair type') ?? '';
  const coverage = normalizeShortText(String(formData.get('coverage') ?? ''), 2000, 'Coverage') ?? '';
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
  const providerName = normalizeShortText(String(formData.get('providerName') ?? ''), 160, 'Provider name');
  const providerEmail = normalizeEmail(String(formData.get('providerEmail') ?? ''), 'Provider email');
  const providerContactName = normalizeShortText(String(formData.get('providerContactName') ?? ''), 120, 'Provider contact name');
  const providerPhone = normalizePhone(String(formData.get('providerPhone') ?? ''), 'Provider phone');

  if (!companyCode || !campaignCode) {
    throw new Error('Missing companyCode or campaignCode');
  }

  await prisma.insurancePackage.updateMany({
    where: {
      companyCode,
      campaignCode
    },
    data: {
      providerName,
      providerEmail,
      providerContactName,
      providerPhone
    }
  });

  revalidatePath('/admin');
  revalidatePath('/admin/insurance');
  revalidatePath('/admin/insurance/packages');
}

export async function updateInsuranceCampaignPaymentSetup(formData: FormData): Promise<void> {
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const paymentBankName = normalizeShortText(String(formData.get('paymentBankName') ?? ''), 120, 'Payment bank name');
  const paymentAccountName = normalizeShortText(String(formData.get('paymentAccountName') ?? ''), 160, 'Payment account name');
  const paymentAccountNumber = normalizeShortText(String(formData.get('paymentAccountNumber') ?? ''), 40, 'Payment account number');
  const paymentUrl = normalizeExternalUrl(String(formData.get('paymentUrl') ?? '').trim() || null, 'Payment URL');
  const paymentNotes = normalizeShortText(String(formData.get('paymentNotes') ?? ''), 2000, 'Payment notes');
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
      paymentBankName,
      paymentAccountName,
      paymentAccountNumber,
      paymentUrl,
      paymentNotes,
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
  const companyCode = normalizeShortText(String(formData.get('companyCode') ?? ''), 80, 'Company code') ?? '';
  const campaignCode = normalizeShortText(String(formData.get('campaignCode') ?? ''), 80, 'Campaign code') ?? '';
  const campaignName = normalizeShortText(String(formData.get('campaignName') ?? ''), 160, 'Campaign name') ?? '';
  const replaceExisting = String(formData.get('replaceExisting') ?? '').trim() === 'on';
  const logoFile = formData.get('logoFile');

  if (!(csvFile instanceof File)) {
    throw new Error('CSV file is required');
  }

  let logoUrl: string | null | undefined;

  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await saveLogoFile(logoFile, `${companyCode}-${campaignCode || campaignName || 'campaign'}`);
  }

  const csvText = await readCsvUpload(csvFile);
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

export async function updateCtpRate(formData: FormData): Promise<void> {
  const sClass = normalizeShortText(getRequiredFormValue(formData, 'sClass'), 20, 'Vehicle class') ?? '';
  const rateCode = normalizeShortText(getOptionalFormValue(formData, 'rateCode'), 40, 'Rate code');
  const cmiVehicleTypeCode = normalizeShortText(getOptionalFormValue(formData, 'cmiVehicleTypeCode'), 40, 'CMI vehicle type code');
  const label = normalizeShortText(getRequiredFormValue(formData, 'label'), 200, 'Label') ?? '';
  const eligibilityLabel = normalizeShortText(getOptionalFormValue(formData, 'eligibilityLabel'), 200, 'Eligibility label');
  const premium = parseRequiredMoney(getRequiredFormValue(formData, 'premium'), 'Premium');
  const stamp = parseRequiredMoney(getRequiredFormValue(formData, 'stamp'), 'Stamp');
  const vat = parseRequiredMoney(getRequiredFormValue(formData, 'vat'), 'VAT');
  const total = parseRequiredMoney(getRequiredFormValue(formData, 'total'), 'Total');
  const sellable = String(formData.get('sellable') ?? '').trim() === 'on';
  const active = String(formData.get('active') ?? '').trim() === 'on';

  await prisma.ctpRate.upsert({
    where: {
      sClass
    },
    create: {
      sClass,
      rateCode,
      cmiVehicleTypeCode,
      label,
      eligibilityLabel,
      premium,
      stamp,
      vat,
      total,
      sellable,
      active
    },
    update: {
      rateCode,
      cmiVehicleTypeCode,
      label,
      eligibilityLabel,
      premium,
      stamp,
      vat,
      total,
      sellable,
      active
    }
  });

  revalidatePath('/admin/insurance');
  revalidatePath('/line-app');
  revalidatePath('/line-app/search');
}
