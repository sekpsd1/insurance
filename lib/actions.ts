"use server";

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  deleteInsuranceCampaignByCode,
  importInsuranceCampaignFromCsv
} from '@/lib/insurance-import';

export type OrderStatus = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';

async function saveLogoFile(logoFile: File, prefix: string): Promise<string> {
  if (!logoFile.type.startsWith('image/')) {
    throw new Error('Logo file must be an image');
  }

  const logoDirectory = path.join(process.cwd(), 'public', 'uploads', 'logos');
  await mkdir(logoDirectory, { recursive: true });

  const originalName = logoFile.name || 'logo';
  const extensionFromName = path.extname(originalName).toLowerCase();
  const extensionFromMime =
    logoFile.type === 'image/png'
      ? '.png'
      : logoFile.type === 'image/jpeg'
        ? '.jpg'
        : logoFile.type === 'image/webp'
          ? '.webp'
          : extensionFromName;

  const safeExtension = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extensionFromMime)
    ? extensionFromMime
    : '.png';
  const fileName = `${prefix}-${randomUUID()}${safeExtension}`;
  const filePath = path.join(logoDirectory, fileName);
  const buffer = Buffer.from(await logoFile.arrayBuffer());

  await writeFile(filePath, buffer);
  return `/uploads/logos/${fileName}`;
}

export async function updateOrderStatus(formData: FormData): Promise<void> {
  const orderId = String(formData.get('orderId') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim() as OrderStatus;

  if (!orderId || !status) {
    throw new Error('Missing orderId or status');
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status },
    include: {
      user: true,
      pkg: true
    }
  });

  const orderWithPlate = updatedOrder as typeof updatedOrder & {
    plateNumber: string | null;
  };

  if (status === 'APPROVED' || status === 'REJECTED') {
    const actionLabel = status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';

    console.log('[Order Action Log]', {
      action: actionLabel,
      orderId: orderWithPlate.id,
      orderNumber: orderWithPlate.orderNumber,
      status: orderWithPlate.status,
      customerName: orderWithPlate.user.name ?? '-',
      plateNumber: orderWithPlate.plateNumber ?? '-',
      packageName: orderWithPlate.pkg.name,
      timestamp: new Date().toISOString()
    });
  }

  revalidatePath('/admin');
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
