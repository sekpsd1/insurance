import { prisma } from './prisma';

export const SALES_LEAD_EMAIL_SETTING_KEY = 'salesLeadEmail';

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
