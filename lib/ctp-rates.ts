import { prisma } from '@/lib/prisma';
import {
  DEFAULT_CTP_OPTIONS,
  DEFAULT_CTP_SCLASS_ORDER,
  type CtpOption,
  getDefaultCtpOptionForSClass
} from '@/lib/ctp';

export type AdminCtpRate = CtpOption & {
  active: boolean;
};

function normalizeRate(row: {
  sClass: string;
  rateCode: string | null;
  cmiVehicleTypeCode: string | null;
  label: string;
  eligibilityLabel: string | null;
  premium: number;
  stamp: number;
  vat: number;
  total: number;
  sellable: boolean;
  active: boolean;
}): AdminCtpRate {
  return {
    sClass: row.sClass,
    rateCode: row.rateCode ?? '',
    cmiVehicleTypeCode: row.cmiVehicleTypeCode ?? '',
    label: row.label,
    eligibilityLabel: row.eligibilityLabel ?? '',
    premium: row.premium,
    stamp: row.stamp,
    vat: row.vat,
    total: row.total,
    sellable: row.sellable,
    active: row.active
  };
}

function normalizeDefaultRate(option: CtpOption): AdminCtpRate {
  return {
    ...option,
    active: true
  };
}

export async function getAdminCtpRates() {
  const rows = await prisma.ctpRate.findMany({
    orderBy: {
      sClass: 'asc'
    }
  });
  const rowsBySClass = new Map(rows.map((row) => [row.sClass, normalizeRate(row)]));
  const orderedRates = DEFAULT_CTP_SCLASS_ORDER.map((sClass) => rowsBySClass.get(sClass) ?? normalizeDefaultRate(DEFAULT_CTP_OPTIONS[sClass]));

  rowsBySClass.forEach((row, sClass) => {
    if (!DEFAULT_CTP_SCLASS_ORDER.includes(sClass)) {
      orderedRates.push(row);
    }
  });

  return orderedRates;
}

export async function getCtpOptionForSClass(sClass: string | null | undefined) {
  const normalized = sClass?.trim();

  if (!normalized) {
    return null;
  }

  const row = await prisma.ctpRate.findUnique({
    where: {
      sClass: normalized
    }
  });

  const defaultOption = getDefaultCtpOptionForSClass(normalized);
  const option = row ? normalizeRate(row) : defaultOption ? normalizeDefaultRate(defaultOption) : null;

  if (!option || !option.active || !option.sellable || option.total <= 0) {
    return null;
  }

  return option;
}

export async function getCustomerCtpOptionsBySClass() {
  const rates = await getAdminCtpRates();

  return rates.reduce<Record<string, CtpOption>>((result, rate) => {
    if (rate.active && rate.sellable && rate.total > 0) {
      result[rate.sClass] = rate;
    }

    return result;
  }, {});
}
