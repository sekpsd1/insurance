import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmailOutboxItem } from '@/lib/actions';
import {
  getEmailActionLabel,
  getEmailStatusLabel,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from '@/lib/status-labels';

function getStatusStyles(status: string) {
  switch (status) {
    case 'POLICY_ISSUED':
    case 'POLICY_APPROVED':
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'PAYMENT_SUBMITTED':
    case 'INSURER_REVIEWING':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function getEmailStatusStyles(status: string) {
  switch (status) {
    case 'QUEUED':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'SENT':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'ERROR':
    case 'MISSING_RECIPIENT':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function canSendEmail(status: string, recipient: string | null) {
  return Boolean(recipient) && status !== 'SENT' && status !== 'MISSING_RECIPIENT';
}

type AdminPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    provider?: string;
    paymentMethod?: string;
    missingProviderEmail?: string;
    dateFrom?: string;
    dateTo?: string;
    ordersPage?: string;
    emailPage?: string;
  }>;
};

const ADMIN_PAGE_SIZE = 20;

const orderStatusOptions = [
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

const paymentMethodOptions = ['BANK_TRANSFER', 'CARD_GATEWAY'];

const orderProgressSteps = [
  { status: 'PENDING_PAYMENT', label: 'รอชำระ' },
  { status: 'PAYMENT_SUBMITTED', label: 'ส่งหลักฐาน' },
  { status: 'SENT_TO_INSURER', label: 'ส่งบริษัท' },
  { status: 'POLICY_APPROVED', label: 'อนุมัติ' },
  { status: 'POLICY_ISSUED', label: 'ออกกรมธรรม์' }
];

function getOrderProgressIndex(status: string) {
  if (status === 'PAID') {
    return 1;
  }

  if (status === 'INSURER_REVIEWING') {
    return 2;
  }

  const index = orderProgressSteps.findIndex((step) => step.status === status);
  return index >= 0 ? index : -1;
}

function getOrderProgressStepStyles(index: number, activeIndex: number, status: string) {
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return index <= Math.max(activeIndex, 0)
      ? 'bg-rose-500 text-white'
      : 'bg-slate-200 text-slate-400';
  }

  if (index < activeIndex) {
    return 'bg-emerald-500 text-white';
  }

  if (index === activeIndex) {
    return 'bg-cyan-600 text-white';
  }

  return 'bg-slate-200 text-slate-400';
}

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

function buildOrderWhere(filters: Awaited<NonNullable<AdminPageProps['searchParams']>>) {
  const where: Prisma.OrderWhereInput = {};
  const q = filters.q?.trim();
  const status = filters.status?.trim();
  const provider = filters.provider?.trim();
  const paymentMethod = filters.paymentMethod?.trim();
  const dateRange = getDateRange(filters.dateFrom, filters.dateTo);

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

  if (filters.missingProviderEmail === 'on') {
    addAndWhere(where, {
      pkg: {
        is: {
          OR: [
            { providerEmail: null },
            { providerEmail: '' }
          ]
        }
      }
    });
  }

  if (dateRange) {
    where.createdAt = dateRange;
  }

  return where;
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function buildPageHref(
  filters: Awaited<NonNullable<AdminPageProps['searchParams']>>,
  updates: Record<string, string | number | null>
) {
  const params = new URLSearchParams();
  const preservedKeys = [
    'q',
    'status',
    'provider',
    'paymentMethod',
    'dateFrom',
    'dateTo',
    'ordersPage',
    'emailPage'
  ] as const;

  preservedKeys.forEach((key) => {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  });

  if (filters.missingProviderEmail === 'on') {
    params.set('missingProviderEmail', 'on');
  }

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === '' || value === 1) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `/admin?${query}` : '/admin';
}

function buildOrderExportHref(filters: Awaited<NonNullable<AdminPageProps['searchParams']>>) {
  const params = new URLSearchParams();
  const preservedKeys = ['q', 'status', 'provider', 'paymentMethod', 'dateFrom', 'dateTo'] as const;

  preservedKeys.forEach((key) => {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  });

  if (filters.missingProviderEmail === 'on') {
    params.set('missingProviderEmail', 'on');
  }

  const query = params.toString();
  return query ? `/admin/orders/export?${query}` : '/admin/orders/export';
}

function PaginationControls({
  filters,
  pageParam,
  currentPage,
  totalItems
}: {
  filters: Awaited<NonNullable<AdminPageProps['searchParams']>>;
  pageParam: 'ordersPage' | 'emailPage';
  currentPage: number;
  totalItems: number;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / ADMIN_PAGE_SIZE), 1);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * ADMIN_PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * ADMIN_PAGE_SIZE, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        แสดง {startItem}-{endItem} จาก {totalItems.toLocaleString()} รายการ
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={buildPageHref(filters, { [pageParam]: Math.max(currentPage - 1, 1) })}
          aria-disabled={currentPage <= 1}
          className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-inset ${
            currentPage <= 1
              ? 'pointer-events-none bg-slate-100 text-slate-400 ring-slate-200'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          ก่อนหน้า
        </Link>
        <span className="rounded-xl bg-white px-3 py-2 font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
          {currentPage} / {totalPages}
        </span>
        <Link
          href={buildPageHref(filters, { [pageParam]: currentPage + 1 })}
          aria-disabled={currentPage >= totalPages}
          className={`rounded-xl px-4 py-2 font-semibold ring-1 ring-inset ${
            currentPage >= totalPages
              ? 'pointer-events-none bg-slate-100 text-slate-400 ring-slate-200'
              : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
          }`}
        >
          ถัดไป
        </Link>
      </div>
    </div>
  );
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const filters = (await searchParams) ?? {};
  const orderWhere = buildOrderWhere(filters);
  const ordersPage = parsePage(filters.ordersPage);
  const emailPage = parsePage(filters.emailPage);
  const latestEmailOutboxRows = await prisma.emailOutbox.groupBy({
    by: ['orderId'],
    _max: {
      createdAt: true
    },
    where: {
      orderId: {
        not: null
      }
    }
  });
  const latestEmailOutboxWhere: Prisma.EmailOutboxWhereInput = {
    OR: latestEmailOutboxRows.map((row) => ({
      orderId: row.orderId,
      createdAt: row._max.createdAt ?? undefined
    }))
  };
  const [
    orders,
    orderCount,
    providerRows,
    emailOutboxRows,
    emailOutboxCount,
    orphanEmailOutboxRows,
    orphanEmailOutboxCount
  ] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      skip: (ordersPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: true,
        pkg: true,
        statusHistory: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        emailOutbox: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    }),
    prisma.order.count({
      where: orderWhere
    }),
    prisma.order.findMany({
      select: {
        pkg: {
          select: {
            company: true
          }
        }
      }
    }),
    prisma.emailOutbox.findMany({
      where: latestEmailOutboxWhere.OR?.length ? latestEmailOutboxWhere : { id: '__none__' },
      skip: (emailPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        order: {
          include: {
            pkg: true
          }
        }
      }
    }),
    prisma.emailOutbox.count({
      where: latestEmailOutboxWhere.OR?.length ? latestEmailOutboxWhere : { id: '__none__' }
    }),
    prisma.emailOutbox.findMany({
      where: {
        orderId: null
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: ADMIN_PAGE_SIZE,
      include: {
        order: {
          include: {
            pkg: true
          }
        }
      }
    }),
    prisma.emailOutbox.count({
      where: {
        orderId: null
      }
    })
  ]);
  const emailOutbox = [...emailOutboxRows, ...(emailPage === 1 ? orphanEmailOutboxRows : [])]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, ADMIN_PAGE_SIZE);
  const displayEmailOutboxCount = emailOutboxCount + orphanEmailOutboxCount;
  const providerOptions = providerRows
    .map((row) => row.pkg.company)
    .filter(Boolean)
    .filter((provider, index, rows) => rows.indexOf(provider) === index)
    .sort((a, b) => a.localeCompare(b, 'th'));

  return (
    <section className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Order Monitor</p>
        <h2 className="text-3xl font-bold tracking-tight text-white">ติดตามคำสั่งซื้อ</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">
          ใช้สำหรับดูสถานะออเดอร์ คิวอีเมลบริษัทประกัน และเปิด Magic Link ให้บริษัทประกันอัปเดตสถานะกรมธรรม์
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">รายการออเดอร์ล่าสุด</h3>
              <p className="text-sm text-slate-500">ตรวจสอบลูกค้า รถ แพ็กเกจ การชำระเงิน และสถานะการส่งอีเมล</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
              {orderCount} รายการ
            </span>
          </div>
        </div>

        <form action="/admin" className="border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr]">
            <div>
              <label htmlFor="q" className="mb-1 block text-xs font-semibold text-slate-500">
                ค้นหา
              </label>
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={filters.q ?? ''}
                placeholder="เลขออเดอร์ ลูกค้า เบอร์ ทะเบียน"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-xs font-semibold text-slate-500">
                สถานะ
              </label>
              <select
                id="status"
                name="status"
                defaultValue={filters.status ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              >
                <option value="">ทั้งหมด</option>
                {orderStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {getOrderStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="provider" className="mb-1 block text-xs font-semibold text-slate-500">
                บริษัทประกัน
              </label>
              <select
                id="provider"
                name="provider"
                defaultValue={filters.provider ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              >
                <option value="">ทั้งหมด</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paymentMethod" className="mb-1 block text-xs font-semibold text-slate-500">
                วิธีชำระเงิน
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                defaultValue={filters.paymentMethod ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              >
                <option value="">ทั้งหมด</option>
                {paymentMethodOptions.map((method) => (
                  <option key={method} value={method}>
                    {getPaymentMethodLabel(method)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="dateFrom" className="mb-1 block text-xs font-semibold text-slate-500">
                จากวันที่
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={filters.dateFrom ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label htmlFor="dateTo" className="mb-1 block text-xs font-semibold text-slate-500">
                ถึงวันที่
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={filters.dateTo ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                name="missingProviderEmail"
                type="checkbox"
                defaultChecked={filters.missingProviderEmail === 'on'}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              แสดงเฉพาะรายการที่ไม่มีอีเมลบริษัทประกัน
            </label>

            <div className="flex gap-2">
              <Link
                href={buildOrderExportHref(filters)}
                className="inline-flex items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
              >
                Export CSV
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                ล้างตัวกรอง
              </Link>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                ค้นหา
              </button>
            </div>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4 sm:px-6">ออเดอร์</th>
                <th className="px-5 py-4 sm:px-6">ลูกค้า / รถ</th>
                <th className="px-5 py-4 sm:px-6">แพ็กเกจ</th>
                <th className="px-5 py-4 sm:px-6">การชำระเงิน</th>
                <th className="px-5 py-4 sm:px-6">สถานะ</th>
                <th className="px-5 py-4 sm:px-6">อีเมล</th>
                <th className="px-5 py-4 sm:px-6 text-right">คำสั่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={7}>
                    ยังไม่มีออเดอร์ในระบบ
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-semibold text-slate-900">{order.orderNumber}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString('th-TH')}</div>
                      <Link href={`/line-app/tracking/${order.orderNumber}`} className="mt-2 inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                        ติดตามออเดอร์
                      </Link>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.customerName ?? order.user.name ?? '-'}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.customerPhone ?? order.user.phone ?? '-'}</div>
                      <div className="mt-2 text-sm uppercase tracking-wide text-slate-700">
                        {order.plateNumber ?? '-'} {order.plateProvince ? `(${order.plateProvince})` : ''}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / ') || '-'}
                      </div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.pkg.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.pkg.company}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{getPaymentMethodLabel(order.paymentMethod)}</div>
                      <div className="mt-1 text-sm text-slate-500">{getPaymentStatusLabel(order.paymentStatus)}</div>
                      {order.slipUrl ? (
                        <a
                          href={order.slipUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-cyan-100"
                        >
                          ดูสลิป
                        </a>
                      ) : null}
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyles(order.status)}`}>
                        {getOrderStatusLabel(order.status)}
                      </span>
                      <div className="mt-3 min-w-[300px] rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                        <div className="grid grid-cols-5 gap-2">
                          {orderProgressSteps.map((step, index) => {
                            const activeIndex = getOrderProgressIndex(order.status);

                            return (
                              <div key={step.status} className="text-center">
                                <div
                                  className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${getOrderProgressStepStyles(
                                    index,
                                    activeIndex,
                                    order.status
                                  )}`}
                                >
                                  {index + 1}
                                </div>
                                <div className="mt-1 text-[10px] font-medium leading-4 text-slate-500">{step.label}</div>
                              </div>
                            );
                          })}
                        </div>
                        {order.status === 'REJECTED' || order.status === 'CANCELLED' ? (
                          <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                            คำสั่งซื้อนี้สิ้นสุดแล้ว
                          </div>
                        ) : null}
                      </div>
                      {order.statusHistory[0]?.message ? (
                        <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{order.statusHistory[0].message}</div>
                      ) : null}
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      {order.emailOutbox[0] ? (
                        <>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEmailStatusStyles(order.emailOutbox[0].status)}`}>
                            {getEmailStatusLabel(order.emailOutbox[0].status)}
                          </span>
                          <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                            {order.emailOutbox[0].recipient ?? 'ยังไม่มีอีเมลผู้รับ'}
                          </div>
                        </>
                      ) : order.pkg.providerEmail ? (
                        <span className="text-xs text-slate-500">ยังไม่เข้าคิวส่ง</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                          ยังไม่มีอีเมลผู้รับ
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-5 text-right sm:px-6">
                      <div className="flex flex-col items-end gap-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        รายละเอียด
                      </Link>
                      <Link
                        href={`/admin/orders/${order.id}/email-preview`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        เปิดอีเมลบริษัทประกัน
                      </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          filters={filters}
          pageParam="ordersPage"
          currentPage={ordersPage}
          totalItems={orderCount}
        />
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">คิวอีเมลบริษัทประกัน</h3>
              <p className="text-sm text-slate-500">ระบบส่งอีเมลอัตโนมัติหลัง checkout ปุ่มในตารางนี้ใช้ส่งซ้ำหรือแก้รายการที่ส่งไม่สำเร็จ</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
              {displayEmailOutboxCount} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4 sm:px-6">สร้างเมื่อ</th>
                <th className="px-5 py-4 sm:px-6">ออเดอร์</th>
                <th className="px-5 py-4 sm:px-6">ผู้รับ</th>
                <th className="px-5 py-4 sm:px-6">หัวข้อ</th>
                <th className="px-5 py-4 sm:px-6">สถานะ</th>
                <th className="px-5 py-4 sm:px-6 text-right">คำสั่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {emailOutbox.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                    ยังไม่มีรายการอีเมลบริษัทประกัน
                  </td>
                </tr>
              ) : (
                emailOutbox.map((email) => (
                  <tr key={email.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-5 text-sm text-slate-500 sm:px-6">
                      {new Date(email.createdAt).toLocaleString('th-TH')}
                    </td>
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-semibold text-slate-900">{email.order?.orderNumber ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{email.order?.pkg.company ?? '-'}</div>
                    </td>
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{email.recipient ?? '-'}</div>
                      {email.errorMessage ? (
                        <div className="mt-1 max-w-xs text-xs leading-5 text-rose-600">{email.errorMessage}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-sm text-slate-700 sm:px-6">{email.subject}</td>
                    <td className="px-5 py-5 sm:px-6">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEmailStatusStyles(email.status)}`}>
                        {getEmailStatusLabel(email.status)}
                      </span>
                      {email.sentAt ? (
                        <div className="mt-1 text-xs text-slate-500">
                          ส่งเมื่อ {new Date(email.sentAt).toLocaleString('th-TH')}
                        </div>
                      ) : null}
                      {email.status === 'MISSING_RECIPIENT' ? (
                        <div className="mt-1 max-w-xs text-xs leading-5 text-rose-600">
                          เพิ่มอีเมลบริษัทประกันในหน้า Insurance Campaigns ก่อนส่ง
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-right sm:px-6">
                      {canSendEmail(email.status, email.recipient) ? (
                        <form action={sendEmailOutboxItem}>
                          <input type="hidden" name="emailOutboxId" value={email.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                          >
                            {getEmailActionLabel(email.status)}
                          </button>
                        </form>
                      ) : email.status === 'SENT' ? (
                        <span className="text-xs font-semibold text-emerald-700">เรียบร้อย</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">ส่งไม่ได้</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationControls
          filters={filters}
          pageParam="emailPage"
          currentPage={emailPage}
          totalItems={displayEmailOutboxCount}
        />
      </div>
    </section>
  );
}
