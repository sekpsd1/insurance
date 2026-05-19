export type CtpOption = {
  sClass: '110' | '320';
  rateCode: '1.10' | '1.40A';
  cmiVehicleTypeCode: '110' | '140A';
  label: string;
  eligibilityLabel: string;
  premium: number;
  stamp: number;
  vat: number;
  total: number;
};

const CTP_OPTIONS: Record<string, CtpOption> = {
  '110': {
    sClass: '110',
    rateCode: '1.10',
    cmiVehicleTypeCode: '110',
    label: 'พ.ร.บ. รถยนต์นั่งส่วนบุคคล',
    eligibilityLabel: 'รหัส 110 ไม่เกิน 7 ที่นั่ง',
    premium: 600,
    stamp: 3,
    vat: 42.21,
    total: 645.21
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
    total: 967.28
  }
};

export function getCtpOptionForSClass(sClass: string | null | undefined) {
  const normalized = sClass?.trim();
  return normalized ? CTP_OPTIONS[normalized] ?? null : null;
}

export function isCtpEligibleSClass(sClass: string | null | undefined) {
  return Boolean(getCtpOptionForSClass(sClass));
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
