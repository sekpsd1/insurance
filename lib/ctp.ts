export type CtpOption = {
  sClass: string;
  rateCode: string;
  cmiVehicleTypeCode: string;
  label: string;
  eligibilityLabel: string;
  premium: number;
  stamp: number;
  vat: number;
  total: number;
  sellable: boolean;
};

export const DEFAULT_CTP_OPTIONS: Record<string, CtpOption> = {
  '110': {
    sClass: '110',
    rateCode: '1.10',
    cmiVehicleTypeCode: '110',
    label: 'พ.ร.บ. รถยนต์นั่งส่วนบุคคล',
    eligibilityLabel: 'รหัส 110 ไม่เกิน 7 ที่นั่ง',
    premium: 600,
    stamp: 3,
    vat: 42.21,
    total: 645.21,
    sellable: true
  },
  '210': {
    sClass: '210',
    rateCode: '',
    cmiVehicleTypeCode: '210',
    label: 'พ.ร.บ. รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า',
    eligibilityLabel: 'รหัส 210 ยังไม่เปิดขาย พ.ร.บ.',
    premium: 0,
    stamp: 0,
    vat: 0,
    total: 0,
    sellable: false
  },
  '320': {
    sClass: '320',
    rateCode: '1.40A',
    cmiVehicleTypeCode: '140A',
    label: 'พ.ร.บ. รถกระบะส่วนบุคคล',
    eligibilityLabel: 'รหัส 320 ไม่เกิน 4 ตัน',
    premium: 900,
    stamp: 4,
    vat: 63.28,
    total: 967.28,
    sellable: true
  }
};

export const DEFAULT_CTP_SCLASS_ORDER = ['110', '210', '320'];

export function getDefaultCtpOptionForSClass(sClass: string | null | undefined) {
  const normalized = sClass?.trim();
  const option = normalized ? DEFAULT_CTP_OPTIONS[normalized] ?? null : null;
  return option && option.sellable && option.total > 0 ? option : null;
}

export function isCtpEligibleSClass(sClass: string | null | undefined) {
  return Boolean(getDefaultCtpOptionForSClass(sClass));
}

export function isCtpSelected(value: FormDataEntryValue | string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.includes('1') || value.includes('true') || value.includes('on');
  }

  return value === '1' || value === 'true' || value === 'on';
}

export function formatCtpOption(option: CtpOption | null | undefined) {
  if (!option) {
    return null;
  }

  return `${option.rateCode} ${option.label}`;
}
