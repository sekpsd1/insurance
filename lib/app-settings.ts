import { prisma } from './prisma';

export const SALES_LEAD_EMAIL_SETTING_KEY = 'salesLeadEmail';
export const ORDER_COPY_EMAIL_SETTING_KEY = 'orderCopyEmail';
export const DEFAULT_ORDER_COPY_EMAIL = 'prakanpai2026@gmail.com';

export async function getSystemSettingValue(key: string) {
  const setting = await prisma.systemSetting.findUnique({
    where: {
      key
    }
  });

  return setting?.value ?? null;
}

export async function getSalesLeadEmailSetting() {
  return getSystemSettingValue(SALES_LEAD_EMAIL_SETTING_KEY);
}

export async function getOrderCopyEmailSetting() {
  return getSystemSettingValue(ORDER_COPY_EMAIL_SETTING_KEY);
}

export async function upsertSystemSettingValue(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: {
      key
    },
    update: {
      value
    },
    create: {
      key,
      value
    }
  });
}
