import type { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getEmailStatusLabel,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from '@/lib/status-labels';

export const dynamic = 'force-dynamic';

const EXPORT_LIMIT = 5000;

function getDateRange(dateFrom?: string, dateTo?: string) {
  const createdAt: Prisma.DateTimeFilter = {};

  if (dateFrom) {
    const from = new Date(dateFrom);

    if (!Number.isNaN(from.getTime())) {
      from.setHours(0, 0, 0, 0);
      createdAt.gte = from;
    }
  }

  if (dateTo) {
    const to = new Date(dateTo);

    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : null;
}

function addAndWhere(where: Prisma.OrderWhereInput, condition: Prisma.OrderWhereInput) {
  const existingAnd = where.AND
    ? Array.isArray(where.AND)
      ? where.AND
      : [where.AND]
    : [];

  where.AND = [...existingAnd, condition];
}

function buildOrderWhere(searchParams: URLSearchParams) {
  const where: Prisma.OrderWhereInput = {};
  const q = searchParams.get('q')?.trim();
  const status = searchParams.get('status')?.trim();
  const provider = searchParams.get('provider')?.trim();
  const paymentMethod = searchParams.get('paymentMethod')?.trim();
  const dateRange = getDateRange(searchParams.get('dateFrom') ?? undefined, searchParams.get('dateTo') ?? undefined);

  if (q) {
    where.OR = [
      { orderNumber: { contains: q } },
      { customerName: { contains: q } },
      { customerPhone: { contains: q } },
      { plateNumber: { contains: q } },
      { plateProvince: { contains: q } },
      { carBrand: { contains: q } },
      { carModel: { contains: q } },
      {
        user: {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { lineId: { contains: q } }
          ]
        }
      },
      {
        pkg: {
          OR: [
            { name: { contains: q } },
            { company: { contains: q } }
          ]
        }
      }
    ];
  }

  if (status) {
    where.status = status;
  }

  if (paymentMethod) {
    where.paymentMethod = paymentMethod;
  }

  if (provider) {
    addAndWhere(where, {
      pkg: {
        is: {
          company: provider
        }
      }
    });
  }

  if (searchParams.get('missingProviderEmail') === 'on') {
    addAndWhere(where, {
      pkg: {
        is: {
          OR: [{ providerEmail: null }, { providerEmail: '' }]
        }
      }
    });
  }

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return where;
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString() : '';
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const where = buildOrderWhere(request.nextUrl.searchParams);
  const orders = await prisma.order.findMany({
    where,
    take: EXPORT_LIMIT,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: true,
      pkg: true,
      emailOutbox: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  });

  const headers = [
    'Order Number',
    'Created At',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'ID Card Number',
    'Customer Address',
    'Plate Number',
    'Plate Province',
    'Chassis Number',
    'Vehicle Brand',
    'Vehicle Model',
    'Vehicle Year',
    'Voluntary Policy Start Date',
    'CTP Policy Start Date',
    'Delivery Address Mode',
    'Delivery Recipient Name',
    'Delivery Recipient Phone',
    'Delivery Address',
    'Vehicle Document Type',
    'Vehicle Document URL',
    'Insurance Company',
    'Campaign Code',
    'Package Name',
    'Order Status',
    'Payment Method',
    'Payment Status',
    'Payment Amount',
    'Slip URL',
    'Gateway URL',
    'Provider Email',
    'Latest Email Status',
    'Insurer Note',
    'Insurer Updated At',
    'Policy Number',
    'Policy PDF URL',
    'Policy PDF Uploaded At'
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    formatDate(order.createdAt),
    order.customerName ?? order.user.name,
    order.customerPhone ?? order.user.phone,
    order.customerEmail ?? order.user.email,
    order.idCardNumber,
    order.customerAddress,
    order.plateNumber,
    order.plateProvince,
    order.chassisNumber,
    order.carBrand,
    order.carModel,
    formatNumber(order.carYear),
    formatDate(order.policyStartDate),
    formatDate(order.ctpPolicyStartDate),
    order.deliveryAddressMode,
    order.deliveryRecipientName,
    order.deliveryRecipientPhone,
    order.deliveryAddress,
    order.vehicleDocumentType,
    order.vehicleDocumentUrl,
    order.pkg.company,
    order.pkg.campaignCode,
    order.pkg.name,
    getOrderStatusLabel(order.status),
    getPaymentMethodLabel(order.paymentMethod),
    getPaymentStatusLabel(order.paymentStatus),
    formatNumber(order.paymentAmount ?? order.pkg.netPrice),
    order.slipUrl,
    order.gatewayUrl,
    order.pkg.providerEmail,
    getEmailStatusLabel(order.emailOutbox[0]?.status),
    order.insurerNote,
    formatDate(order.insurerUpdatedAt),
    order.policyNumber,
    order.policyPdfUrl,
    formatDate(order.policyPdfUploadedAt)
  ]);

  const csv = [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-${dateStamp}.csv"`,
      'X-Export-Row-Count': String(orders.length),
      'X-Export-Row-Limit': String(EXPORT_LIMIT)
    }
  });
}
