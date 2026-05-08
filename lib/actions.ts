"use server";

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import {
  deleteInsuranceCampaignByCode,
  importInsuranceCampaignFromCsv
} from '@/lib/insurance-import';

export type OrderStatus = 'PENDING' | 'REVIEWING' | 'APPROVED' | 'REJECTED';

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

  if (!packageId) {
    throw new Error('Missing packageId');
  }

  await prisma.$executeRaw`
    UPDATE InsurancePackage
    SET repairType = ${repairType || null},
        coverage = ${coverage || null}
    WHERE id = ${packageId}
  `;

  revalidatePath('/admin');
  revalidatePath('/admin/insurance/packages');
  revalidatePath('/line-app');
}

export async function importInsuranceCampaign(formData: FormData): Promise<void> {
  const csvFile = formData.get('csvFile');
  const companyCode = String(formData.get('companyCode') ?? '').trim();
  const campaignCode = String(formData.get('campaignCode') ?? '').trim();
  const campaignName = String(formData.get('campaignName') ?? '').trim();
  const replaceExisting = String(formData.get('replaceExisting') ?? '').trim() === 'on';

  if (!(csvFile instanceof File)) {
    throw new Error('CSV file is required');
  }

  const csvText = await csvFile.text();
  await importInsuranceCampaignFromCsv({
    csvText,
    companyCode,
    campaignCode,
    campaignName,
    replaceExisting
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
