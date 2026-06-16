import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmailOutboxItem, updateTypeOneQuoteLeadFollowUp } from '@/lib/actions';
import { getEmailActionLabel, getEmailStatusLabel } from '@/lib/status-labels';

const LEADS_PAGE_SIZE = 20;

type AdminLeadsPageProps = {
  searchParams?: Promise<{
    q?: string;
    emailStatus?: string;
    salesStatus?: string;
    page?: string;
  }>;
};

const emailStatusOptions = ['QUEUED', 'SENT', 'ERROR', 'MISSING_RECIPIENT'];
const salesStatusOptions = [
  { value: 'NEW', label: 'ใหม่' },
  { value: 'CONTACTED', label: 'ติดต่อแล้ว' },
  { value: 'QUOTED', label: 'ส่งใบเสนอราคาแล้ว' },
  { value: 'CLOSED', label: 'ปิดงานแล้ว' }
];

function getSalesStatusLabel(status?: string | null) {
  return salesStatusOptions.find((option) => option.value === status)?.label ?? 'ใหม่';
}

function getSalesStatusStyles(status?: string | null) {
  switch (status) {
    case 'CONTACTED':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'QUOTED':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
    case 'CLOSED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    default:
      return 'bg-amber-50 text-amber-700 ring-amber-200';
  }
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok'
  }).format(date);
}

function formatLeadVehicleSize(sClass: string | null, cubicCapacity: string) {
  if (sClass === '210') {
    return `ไม่เกิน ${cubicCapacity} ที่นั่ง`;
  }

  return `${cubicCapacity} ซีซี`;
}

function getCoverageLabel(coverageType?: string | null) {
  switch (coverageType) {
    case '2+':
      return 'ประเภท 2 พลัส';
    case '3+':
      return 'ประเภท 3 พลัส';
    case '3':
      return 'ประเภท 3';
    default:
      return 'ประเภท 1';
  }
}

function getRepairTypeLabel(repairType?: string | null) {
  switch (repairType) {
    case 'dealer':
      return 'ซ่อมห้าง';
    case 'garage':
      return 'ซ่อมอู่';
    default:
      return '-';
  }
}

function getLeadSourceLabel(source?: string | null) {
  return source === 'NO_CAMPAIGN' ? 'นอกแคมเปญ' : 'แผนพิเศษ';
}

function getEmailStatusStyles(status?: string | null) {
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

function buildLeadWhere(q?: string): Prisma.TypeOneQuoteLeadWhereInput {
  const query = q?.trim();

  if (!query) {
    return {};
  }

  return {
    OR: [
      { leadNumber: { contains: query } },
      { customerName: { contains: query } },
      { customerPhone: { contains: query } },
      { lineId: { contains: query } },
      { lineDisplayName: { contains: query } },
      { email: { contains: query } },
      { sClass: { contains: query } },
      { coverageType: { contains: query } },
      { repairType: { contains: query } },
      { leadSource: { contains: query } },
      { brand: { contains: query } },
      { model: { contains: query } },
      { cubicCapacity: { contains: query } }
    ]
  };
}

function buildPageHref(baseParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(baseParams);
  params.set('page', String(page));
  return `/admin/leads?${params.toString()}`;
}

function canRetryEmail(status?: string | null, recipient?: string | null) {
  return Boolean(recipient) && status !== 'SENT' && status !== 'MISSING_RECIPIENT';
}

export default async function AdminLeadsPage({ searchParams }: AdminLeadsPageProps) {
  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? '';
  const emailStatus = params.emailStatus?.trim() ?? '';
  const salesStatus = params.salesStatus?.trim() ?? '';
  const currentPage = Math.max(Number.parseInt(params.page ?? '1', 10) || 1, 1);
  const where = buildLeadWhere(q);

  if (salesStatus && salesStatusOptions.some((option) => option.value === salesStatus)) {
    where.salesStatus = salesStatus;
  }

  if (emailStatus) {
    const matchingOutboxes = await prisma.emailOutbox.findMany({
      where: {
        status: emailStatus
      },
      select: {
        id: true
      }
    });

    where.emailOutboxId = {
      in: matchingOutboxes.map((outbox) => outbox.id)
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [leads, totalCount, allLeadCount, todayLeadCount] = await Promise.all([
    prisma.typeOneQuoteLead.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      skip: (currentPage - 1) * LEADS_PAGE_SIZE,
      take: LEADS_PAGE_SIZE
    }),
    prisma.typeOneQuoteLead.count({ where }),
    prisma.typeOneQuoteLead.count(),
    prisma.typeOneQuoteLead.count({
      where: {
        createdAt: {
          gte: startOfToday
        }
      }
    })
  ]);

  const emailOutboxIds = leads.map((lead) => lead.emailOutboxId).filter((id): id is string => Boolean(id));
  const emailOutboxes = emailOutboxIds.length
    ? await prisma.emailOutbox.findMany({
        where: {
          id: {
            in: emailOutboxIds
          }
        },
        select: {
          id: true,
          recipient: true,
          subject: true,
          status: true,
          sentAt: true,
          errorMessage: true
        }
      })
    : [];
  const emailOutboxById = new Map(emailOutboxes.map((outbox) => [outbox.id, outbox]));
  const totalPages = Math.max(Math.ceil(totalCount / LEADS_PAGE_SIZE), 1);
  const baseParams = new URLSearchParams();

  if (q) {
    baseParams.set('q', q);
  }

  if (emailStatus) {
    baseParams.set('emailStatus', emailStatus);
  }

  if (salesStatus) {
    baseParams.set('salesStatus', salesStatus);
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] bg-white p-6 shadow-xl shadow-slate-950/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Quote Leads</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">คำขอใบเสนอราคา</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              รายการลูกค้าที่ส่งข้อมูลให้เซลติดต่อกลับ ทั้งประเภท 1 และกรณี 2+/3+ ที่ไม่พบแคมเปญ ระบบจะแสดงข้อมูลรถ ลูกค้า และสถานะอีเมลที่ส่งถึงทีมขาย
            </p>
          </div>
          <Link
            href="/admin/insurance"
            prefetch={false}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            ตั้งค่าอีเมลทีมขาย
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Lead ทั้งหมด</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{allLeadCount.toLocaleString('th-TH')}</p>
          </div>
          <div className="rounded-3xl bg-cyan-50 p-5">
            <p className="text-sm text-cyan-700">วันนี้</p>
            <p className="mt-2 text-3xl font-black text-cyan-800">{todayLeadCount.toLocaleString('th-TH')}</p>
          </div>
          <div className="rounded-3xl bg-indigo-50 p-5">
            <p className="text-sm text-indigo-700">ผลลัพธ์ตามตัวกรอง</p>
            <p className="mt-2 text-3xl font-black text-indigo-800">{totalCount.toLocaleString('th-TH')}</p>
          </div>
        </div>

        <form className="mt-6 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_220px_220px_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">ค้นหา</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="เลขคำขอ ชื่อ เบอร์ LINE ID ยี่ห้อ รุ่น"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">สถานะอีเมล</span>
            <select
              name="emailStatus"
              defaultValue={emailStatus}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">ทั้งหมด</option>
              {emailStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {getEmailStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">สถานะติดตาม</span>
            <select
              name="salesStatus"
              defaultValue={salesStatus}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">ทั้งหมด</option>
              {salesStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
              กรองข้อมูล
            </button>
            <Link
              href="/admin/leads"
              prefetch={false}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              ล้าง
            </Link>
          </div>
        </form>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[180px_1.1fr_1.1fr_1.25fr_230px_300px] bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <div>เลขคำขอ</div>
            <div>ลูกค้า</div>
            <div>รถ</div>
            <div>ช่องทางติดต่อ</div>
            <div>อีเมลทีมขาย</div>
            <div>ติดตาม</div>
          </div>

          {leads.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">ยังไม่มีรายการตามเงื่อนไขนี้</div>
          ) : (
            leads.map((lead) => {
              const outbox = lead.emailOutboxId ? emailOutboxById.get(lead.emailOutboxId) : null;
              const statusLabel = getEmailStatusLabel(outbox?.status ?? 'MISSING_RECIPIENT');

              return (
                <article
                  key={lead.id}
                  className="grid grid-cols-[180px_1.1fr_1.1fr_1.25fr_230px_300px] items-start gap-4 border-t border-slate-200 px-4 py-5 text-sm"
                >
                  <div>
                    <p className="font-black text-slate-950">{lead.leadNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(lead.createdAt)}</p>
                  </div>
                  <div>
                    <p className="font-bold text-slate-950">{lead.customerName}</p>
                    <p className="mt-1 text-slate-600">{lead.customerPhone}</p>
                    {lead.email ? <p className="mt-1 break-all text-xs text-slate-500">{lead.email}</p> : null}
                  </div>
                  <div>
                    <p className="font-bold text-slate-950">
                      {lead.brand} {lead.model}
                    </p>
                    <p className="mt-1 text-slate-600">
                      ปี {lead.carYear} / {formatLeadVehicleSize(lead.sClass, lead.cubicCapacity)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700 ring-1 ring-cyan-100">
                        {getCoverageLabel(lead.coverageType)}
                      </span>
                      {lead.repairType ? (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700 ring-1 ring-indigo-100">
                          {getRepairTypeLabel(lead.repairType)}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                        {getLeadSourceLabel(lead.leadSource)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      SClass {lead.sClass || '-'} {lead.sumInsured !== null ? `/ ทุน ${lead.sumInsured.toLocaleString('th-TH')} บาท` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="break-all text-slate-700">LINE ID: {lead.lineId || '-'}</p>
                    {lead.lineDisplayName ? <p className="mt-1 text-xs text-slate-500">LINE name: {lead.lineDisplayName}</p> : null}
                  </div>
                  <div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getEmailStatusStyles(outbox?.status)}`}>
                      {statusLabel}
                    </span>
                    <p className="mt-2 break-all text-xs text-slate-600">{outbox?.recipient ?? '-'}</p>
                    {outbox?.sentAt ? <p className="mt-1 text-xs text-emerald-700">ส่งเมื่อ {formatDate(outbox.sentAt)}</p> : null}
                    {outbox?.errorMessage ? <p className="mt-1 line-clamp-2 text-xs text-rose-600">{outbox.errorMessage}</p> : null}
                    {outbox && canRetryEmail(outbox.status, outbox.recipient) ? (
                      <form action={sendEmailOutboxItem} className="mt-3">
                        <input type="hidden" name="emailOutboxId" value={outbox.id} />
                        <button className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800">
                          {getEmailActionLabel(outbox.status)}
                        </button>
                      </form>
                    ) : (
                      <span className="mt-3 inline-flex rounded-2xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500">-</span>
                    )}
                  </div>
                  <form action={updateTypeOneQuoteLeadFollowUp} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getSalesStatusStyles(lead.salesStatus)}`}>
                        {getSalesStatusLabel(lead.salesStatus)}
                      </span>
                      <button className="rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800">
                        บันทึก
                      </button>
                    </div>
                    <select
                      name="salesStatus"
                      defaultValue={lead.salesStatus}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    >
                      {salesStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    <textarea
                      name="salesNote"
                      defaultValue={lead.salesNote ?? ''}
                      placeholder="บันทึกการติดตาม เช่น โทรแล้ว รอลูกค้าส่งเอกสาร"
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                    />
                  </form>
                </article>
              );
            })
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            แสดง {leads.length > 0 ? (currentPage - 1) * LEADS_PAGE_SIZE + 1 : 0}-
            {Math.min(currentPage * LEADS_PAGE_SIZE, totalCount)} จาก {totalCount.toLocaleString('th-TH')} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Link
              href={buildPageHref(baseParams, Math.max(currentPage - 1, 1))}
              prefetch={false}
              aria-disabled={currentPage <= 1}
              className={`rounded-2xl border px-4 py-2 font-bold ${
                currentPage <= 1
                  ? 'pointer-events-none border-slate-200 text-slate-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              ก่อนหน้า
            </Link>
            <span className="rounded-2xl border border-slate-200 px-4 py-2 font-bold text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <Link
              href={buildPageHref(baseParams, Math.min(currentPage + 1, totalPages))}
              prefetch={false}
              aria-disabled={currentPage >= totalPages}
              className={`rounded-2xl border px-4 py-2 font-bold ${
                currentPage >= totalPages
                  ? 'pointer-events-none border-slate-200 text-slate-300'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              ถัดไป
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
