import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/status-labels';

type ProviderEmailOrder = {
  orderNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  province: string | null;
  district: string | null;
  subDistrict: string | null;
  postalCode: string | null;
  idCardNumber: string | null;
  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carCubicCapacity: string | null;
  plateNumber: string | null;
  plateProvince: string | null;
  chassisNumber: string | null;
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
  paymentAmount: number | null;
  slipUrl: string | null;
  gatewayUrl: string | null;
  ctpSelected: boolean;
  ctpRateCode: string | null;
  ctpTotal: number | null;
  user: {
    name: string | null;
    phone: string | null;
    email?: string | null;
  };
  pkg: {
    name: string;
    company: string;
    providerName: string | null;
    providerContactName: string | null;
    providerPhone: string | null;
    providerEmail: string | null;
    netPrice: number;
    payablePrice: number | null;
    minSumInsured: number | null;
    maxSumInsured: number | null;
  };
};

function getPublicAppBaseUrl() {
  const baseUrl = process.env.APP_BASE_URL?.trim();
  return baseUrl ? baseUrl.replace(/\/+$/, '') : '';
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatThaiBaht(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function formatThaiDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString('th-TH') : '-';
}

function formatText(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return '-';
  }

  const text = String(value).trim();
  return text || '-';
}

function joinText(parts: Array<string | number | null | undefined>, separator = ' ') {
  const text = parts
    .map((part) => (part === null || part === undefined ? '' : String(part).trim()))
    .filter(Boolean)
    .join(separator)
    .trim();

  return text || '-';
}

function formatCustomerAddress(order: ProviderEmailOrder) {
  return joinText([order.customerAddress, order.subDistrict, order.district, order.province, order.postalCode]);
}

function formatDeliveryAddress(order: ProviderEmailOrder) {
  const modeLabel = order.deliveryAddressMode === 'other' ? 'ที่อยู่อื่น' : 'ที่อยู่เดียวกับผู้เอาประกัน';
  const address = joinText([order.deliveryRecipientName, order.deliveryRecipientPhone, order.deliveryAddress], ' / ');
  return `${modeLabel}${address !== '-' ? ` / ${address}` : ''}`;
}

function formatPlate(order: ProviderEmailOrder) {
  return joinText([order.plateNumber, order.plateProvince]);
}

function formatSumInsured(order: ProviderEmailOrder) {
  const min = order.pkg.minSumInsured;
  const max = order.pkg.maxSumInsured;

  if ((min ?? 0) === 0 && (max ?? 0) === 0) {
    return 'ไม่คุ้มครอง';
  }

  if (min !== null && max !== null && min === max) {
    return formatThaiBaht(min);
  }

  if (min !== null && max !== null) {
    return `${formatThaiBaht(min)} - ${formatThaiBaht(max)}`;
  }

  return formatThaiBaht(min ?? max);
}

function getPayableAmount(order: ProviderEmailOrder) {
  return order.paymentAmount ?? (order.pkg.payablePrice ?? order.pkg.netPrice) + (order.ctpSelected ? order.ctpTotal ?? 0 : 0);
}

export function buildProviderEmail(input: { order: ProviderEmailOrder; magicLinkPath: string }) {
  const { order, magicLinkPath } = input;
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const customerEmail = order.customerEmail ?? order.user.email ?? '-';
  const plate = formatPlate(order);
  const magicLinkUrl = getAbsoluteAppUrl(magicLinkPath);
  const slipUrl = getAbsoluteAppUrl(order.slipUrl);
  const gatewayUrl = getAbsoluteAppUrl(order.gatewayUrl);
  const vehicleDocumentUrl = getAbsoluteAppUrl(order.vehicleDocumentUrl);
  const ctpLabel = order.ctpSelected ? 'รวม พ.ร.บ.' : 'ไม่รวม พ.ร.บ.';
  const documentLines = [
    vehicleDocumentUrl ? `- ${order.vehicleDocumentType ?? 'เอกสารรถ'}: ${vehicleDocumentUrl}` : null,
    slipUrl ? `- สลิปชำระเงิน: ${slipUrl}` : null
  ].filter((line): line is string => Boolean(line));
  const subject = `แจ้งงาน ${customerName} / ${plate}`;
  const body = [
    'เรียน เจ้าหน้าที่',
    '',
    `แจ้งทำประกัน ${ctpLabel}`,
    '',
    'Data ตามด้านบนที่ลูกค้ากรอก (เป็นภาษาไทย) เป็น Text',
    '',
    `ผู้เอาประกันภัย: ${customerName}`,
    `เบอร์โทรศัพท์: ${customerPhone}`,
    customerEmail !== '-' ? `อีเมล: ${customerEmail}` : null,
    `เลขบัตรประชาชน: ${formatText(order.idCardNumber)}`,
    `ที่อยู่: ${formatCustomerAddress(order)}`,
    `รถยี่ห้อ / รุ่น: ${joinText([order.carBrand, order.carModel], ' / ')}`,
    `ขนาด: ${formatText(order.carCubicCapacity)}`,
    `ปีจดทะเบียน: ${formatText(order.carYear)}`,
    `เลขทะเบียน: ${plate}`,
    `ตัวถัง: ${formatText(order.chassisNumber)}`,
    `วันที่คุ้มครอง : ภาคสมัครใจ: ${formatThaiDate(order.policyStartDate)}`,
    `วันที่คุ้มครอง พรบ.: ${order.ctpSelected ? formatThaiDate(order.ctpPolicyStartDate) : 'ไม่ได้ซื้อ พ.ร.บ.'}`,
    `แผนที่เลือกประกัน: ${order.pkg.name}`,
    `ทุนประกัน: ${formatSumInsured(order)}`,
    `เบี้ยประกัน: ${formatThaiBaht(getPayableAmount(order))}`,
    order.ctpSelected ? `รายละเอียด พ.ร.บ.: ${order.ctpRateCode ?? '-'} / ${formatThaiBaht(order.ctpTotal)}` : null,
    `วิธีชำระเงิน: ${getPaymentMethodLabel(order.paymentMethod)}`,
    `สถานะชำระเงิน: ${getPaymentStatusLabel(order.paymentStatus)}`,
    gatewayUrl ? `ลิงก์ชำระเงินบริษัทประกัน: ${gatewayUrl}` : null,
    '',
    'เอกสารแนบ ดาวน์โหลดเป็น file ได้:',
    documentLines.length ? documentLines.join('\n') : '-',
    '',
    `การจัดส่งกรมธรรม์: ${formatDeliveryAddress(order)}`,
    '',
    `ลิงก์สำหรับบริษัทประกันอัปเดตสถานะ: ${magicLinkUrl}`,
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

export function renderProviderEmailHtml(body: string, magicLinkPath: string | null) {
  const magicLinkUrl = getAbsoluteAppUrl(magicLinkPath);
  const content = body
    .split('\n')
    .filter((line) => !line.startsWith('ลิงก์สำหรับบริษัทประกันอัปเดตสถานะ:'))
    .filter((line) => !line.startsWith('Update policy status here:'))
    .map((line) => {
      if (!line.trim()) {
        return '<div style="height:12px;line-height:12px">&nbsp;</div>';
      }

      return `<p style="margin:0 0 8px 0;color:#111827;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(line)}</p>`;
    })
    .join('');

  const actionButton = magicLinkUrl
    ? `
      <div style="margin:24px 0">
        <a href="${escapeHtml(magicLinkUrl)}" style="display:inline-block;background:#0052cc;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1;padding:14px 22px;border-radius:10px">
          เปิดหน้าอัปเดตสถานะกรมธรรม์
        </a>
        <p style="margin:12px 0 0 0;color:#6b7280;font-size:12px;line-height:1.5">
          หากปุ่มไม่ทำงาน ให้เปิดลิงก์นี้:<br>
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
