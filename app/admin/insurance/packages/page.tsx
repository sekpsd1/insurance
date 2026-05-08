import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { updateInsurancePackage } from '@/lib/actions';

const PAGE_SIZE = 20;

type PackageSearchParams = {
  q?: string | string[];
  companyCode?: string | string[];
  campaignCode?: string | string[];
  page?: string | string[];
};

type PackageRow = {
  id: string;
  name: string;
  company: string;
  companyCode: string | null;
  campaignCode: string | null;
  campaignName: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  fullPrice: number;
  netPrice: number;
  discount: number;
  repairType: string | null;
  coverage: string | null;
  logoUrl: string | null;
  createdAt: Date;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function parsePage(value: string | string[] | undefined) {
  const rawValue = normalizeSearchValue(value);
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value);
}

function buildPageHref(baseParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(baseParams);

  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }

  const query = params.toString();
  return query ? `/admin/insurance/packages?${query}` : '/admin/insurance/packages';
}

async function getPackages(searchParams: PackageSearchParams) {
  const q = normalizeSearchValue(searchParams.q);
  const companyCode = normalizeSearchValue(searchParams.companyCode);
  const campaignCode = normalizeSearchValue(searchParams.campaignCode);
  const page = parsePage(searchParams.page);

  const where: Prisma.InsurancePackageWhereInput = {};

  if (companyCode) {
    where.companyCode = companyCode;
  }

  if (campaignCode) {
    where.campaignCode = campaignCode;
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { company: { contains: q } },
      { companyCode: { contains: q } },
      { campaignCode: { contains: q } },
      { campaignName: { contains: q } },
      { brand: { contains: q } },
      { model: { contains: q } },
      { details: { contains: q } }
    ];
  }

  const totalItems = await prisma.insurancePackage.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const packages = await prisma.insurancePackage.findMany({
    where,
    take: PAGE_SIZE,
    skip: (safePage - 1) * PAGE_SIZE,
    orderBy: [
      { createdAt: 'desc' },
      { id: 'desc' }
    ],
    select: {
      id: true,
      name: true,
      company: true,
      companyCode: true,
      campaignCode: true,
      campaignName: true,
      brand: true,
      model: true,
      year: true,
      fullPrice: true,
      netPrice: true,
      discount: true,
      repairType: true,
      coverage: true,
      logoUrl: true,
      createdAt: true
    }
  });

  return {
    q,
    companyCode,
    campaignCode,
    page: safePage,
    totalItems,
    totalPages,
    packages: packages as PackageRow[]
  };
}

function PaginationControls({
  currentPage,
  totalPages,
  baseParams
}: {
  currentPage: number;
  totalPages: number;
  baseParams: URLSearchParams;
}) {
  const previousPage = Math.max(1, currentPage - 1);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200">
      <span>
        หน้า {currentPage} / {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={buildPageHref(baseParams, previousPage)}
          className={`rounded-xl px-4 py-2 font-semibold transition ${
            currentPage <= 1 ? 'pointer-events-none bg-slate-800 text-slate-500' : 'bg-white/10 hover:bg-white/20'
          }`}
        >
          ก่อนหน้า
        </Link>
        <Link
          href={buildPageHref(baseParams, nextPage)}
          className={`rounded-xl px-4 py-2 font-semibold transition ${
            currentPage >= totalPages ? 'pointer-events-none bg-slate-800 text-slate-500' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
          }`}
        >
          ถัดไป
        </Link>
      </div>
    </div>
  );
}

function getResultRange(page: number, totalItems: number) {
  if (totalItems === 0) {
    return { start: 0, end: 0 };
  }

  return {
    start: (page - 1) * PAGE_SIZE + 1,
    end: Math.min(page * PAGE_SIZE, totalItems)
  };
}

function PackageEditForm({ pkg }: { pkg: PackageRow }) {
  return (
    <form action={updateInsurancePackage} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="packageId" value={pkg.id} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">{pkg.companyCode ?? pkg.company}</p>
          <h3 className="mt-2 text-lg font-bold text-slate-950">{pkg.name}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {pkg.company} · {pkg.campaignName ?? '-'}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{formatCurrency(pkg.netPrice)}</span>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-slate-500">Campaign Code</div>
          <div className="mt-1 font-semibold text-slate-900">{pkg.campaignCode ?? '-'}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-slate-500">Vehicle</div>
          <div className="mt-1 font-semibold text-slate-900">
            {[pkg.brand, pkg.model, pkg.year].filter(Boolean).join(' · ') || '-'}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-slate-500">Full Price</div>
          <div className="mt-1 font-semibold text-slate-900">{formatCurrency(pkg.fullPrice)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="text-slate-500">Discount</div>
          <div className="mt-1 font-semibold text-slate-900">{formatCurrency(pkg.discount)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor={`repairType-${pkg.id}`} className="mb-1 block text-sm font-medium text-slate-700">
            ประเภทการซ่อม
          </label>
          <input
            id={`repairType-${pkg.id}`}
            name="repairType"
            type="text"
            defaultValue={pkg.repairType ?? ''}
            placeholder="เช่น ซ่อมห้าง / อู่ / ห้าง"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <div>
          <label htmlFor={`coverage-${pkg.id}`} className="mb-1 block text-sm font-medium text-slate-700">
            ความคุ้มครอง
          </label>
          <input
            id={`coverage-${pkg.id}`}
            name="coverage"
            type="text"
            defaultValue={pkg.coverage ?? ''}
            placeholder="เช่น ซ่อมรถคู่กรณี / ซ่อมรถเรา"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
          />
        </div>

        <button
          type="submit"
          className="inline-flex w-full items-center justify-center rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
        >
          บันทึกแพ็กเกจนี้
        </button>
      </div>
    </form>
  );
}

export default async function InsurancePackagesPage({
  searchParams
}: {
  searchParams?: Promise<PackageSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const data = await getPackages(resolvedSearchParams);

  const baseParams = new URLSearchParams();
  if (data.q) baseParams.set('q', data.q);
  if (data.companyCode) baseParams.set('companyCode', data.companyCode);
  if (data.campaignCode) baseParams.set('campaignCode', data.campaignCode);
  const resultRange = getResultRange(data.page, data.totalItems);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Package Search & Edit</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">ค้นหา / แก้ไขแพ็กเกจรายตัว</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            ค้นหาแพ็กเกจแบบแบ่งหน้า เพื่อแก้ `repairType` และ `coverage` ทีละรายการโดยไม่โหลดข้อมูลทั้งหมดพร้อมกัน
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white shadow-lg shadow-black/10">
          <div className="text-slate-300">ผลลัพธ์</div>
          <div className="mt-1 text-xl font-bold">{data.totalItems.toLocaleString()}</div>
        </div>
      </div>

      <form method="get" className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/10">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="q" className="mb-2 block text-sm font-semibold text-white">Search</label>
            <input
              id="q"
              name="q"
              defaultValue={data.q}
              placeholder="ค้นหาจากชื่อแพ็กเกจ, บริษัท, campaign code, brand, model, รายละเอียด"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-[16px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100/20"
            />
          </div>
          <div>
            <label htmlFor="companyCode" className="mb-2 block text-sm font-semibold text-white">Company Code</label>
            <input
              id="companyCode"
              name="companyCode"
              defaultValue={data.companyCode}
              placeholder="เช่น TMSTH"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-[16px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100/20"
            />
          </div>
          <div>
            <label htmlFor="campaignCode" className="mb-2 block text-sm font-semibold text-white">Campaign Code</label>
            <input
              id="campaignCode"
              name="campaignCode"
              defaultValue={data.campaignCode}
              placeholder="เช่น C69/00109-2+"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-[16px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100/20"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            ค้นหา
          </button>
          <Link
            href="/admin/insurance/packages"
            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            ล้างตัวกรอง
          </Link>
        </div>
      </form>

      <PaginationControls currentPage={data.page} totalPages={data.totalPages} baseParams={baseParams} />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data.packages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300 lg:col-span-2">
            ไม่พบแพ็กเกจที่ตรงกับเงื่อนไขค้นหา
          </div>
        ) : (
          data.packages.map((pkg) => <PackageEditForm key={pkg.id} pkg={pkg} />)
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-300">
        <span>
          {data.totalItems === 0 ? (
            'ไม่มีผลลัพธ์ในหน้าปัจจุบัน'
          ) : (
            <>
              แสดง {resultRange.start.toLocaleString()}–{resultRange.end.toLocaleString()} จากทั้งหมด {data.totalItems.toLocaleString()}
            </>
          )}
        </span>
        <div className="flex gap-2">
          <Link href="/admin/insurance" className="rounded-2xl border border-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/10">
            กลับหน้าแคมเปญ
          </Link>
        </div>
      </div>
    </section>
  );
}
