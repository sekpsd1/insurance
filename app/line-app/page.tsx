import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import CompareSelection from './_components/compare-selection';

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

type LineAppSearchParams = {
  coverage?: string;
  brand?: string;
  model?: string;
  year?: string;
  page?: string;
};

type InsurancePackageRow = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  details: string | null;
  repairType: string | null;
  coverage: string | null;
  coverageCode: string | null;
  coverageType: string | null;
  fullPrice: number;
  netPrice: number;
  discount: number;
  createdAt: Date;
};

type SearchResultMeta = {
  exactYearMatched: boolean;
  usedFallbackYearSearch: boolean;
};

const PAGE_SIZE = 12;

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function normalizeCoverageType(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);

  if (normalized === '1' || normalized === '2+' || normalized === '3+' || normalized === '3') {
    return normalized as '1' | '2+' | '3+' | '3';
  }

  if (normalized.startsWith('1')) {
    return '1';
  }

  if (normalized === '2.2') {
    return '2+';
  }

  if (normalized === '3.2') {
    return '3+';
  }

  if (normalized === '3' || normalized === '3.3') {
    return '3';
  }

  return '';
}

function getCoverageLabel(value: string) {
  if (value === '1') return 'ประกันชั้น 1';
  if (value === '2+') return 'ประกัน 2+';
  if (value === '3+') return 'ประกัน 3+';
  if (value === '3') return 'ประกันชั้น 3';
  return value;
}

function buildSearchSummary(filters: { coverage: string; brand: string; model: string; year: string }) {
  return [filters.coverage ? getCoverageLabel(filters.coverage) : '', filters.brand, filters.model, filters.year].filter(Boolean).join(' ');
}

function parsePage(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function buildPageHref(baseParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(baseParams);

  if (page <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(page));
  }

  const query = params.toString();
  return query ? `/line-app?${query}` : '/line-app';
}

function buildCompareHref(baseParams: URLSearchParams) {
  const query = baseParams.toString();
  return query ? `/line-app/compare?${query}` : '/line-app/compare';
}

function buildCoverageTypeSql() {
  return Prisma.sql`
    CASE
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) LIKE '1%' THEN '1'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) = '2.2' THEN '2+'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) = '3.2' THEN '3+'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) IN ('3', '3.3') THEN '3'
      ELSE ''
    END
  `;
}

function buildVisiblePages(currentPage: number, totalPages: number) {
  const pages = new Set<number>();

  pages.add(1);
  pages.add(totalPages);
  pages.add(currentPage - 1);
  pages.add(currentPage);
  pages.add(currentPage + 1);

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
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
  const visiblePages = buildVisiblePages(currentPage, totalPages);
  const nextPage = Math.min(totalPages, currentPage + 1);

  return (
    <div className="rounded-2xl border border-[#d8dcec] bg-white px-4 py-4 text-sm text-[#434654] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <span>
          หน้า {currentPage} / {totalPages}
        </span>
        <span className="text-xs text-[#6b7280]">เลื่อนดูแผนเพิ่มเติมได้ด้วยปุ่ม Load More</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {visiblePages.map((page) => {
          const isActive = page === currentPage;

          return (
            <Link
              key={page}
              href={buildPageHref(baseParams, page)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex h-10 min-w-10 items-center justify-center rounded-xl border px-3 font-semibold transition ${
                isActive
                  ? 'border-[#0052CC] bg-[#0052CC] text-white'
                  : 'border-[#d8dcec] bg-white text-[#0052CC] hover:border-[#0052CC] hover:bg-[#eef3ff]'
              }`}
            >
              {page}
            </Link>
          );
        })}
      </div>

      <div className="mt-4">
        <Link
          href={buildPageHref(baseParams, nextPage)}
          className={`flex w-full items-center justify-center rounded-xl px-4 py-3 font-semibold transition ${
            currentPage >= totalPages
              ? 'pointer-events-none bg-slate-100 text-slate-400'
              : 'bg-[#0052CC] text-white hover:bg-[#0040a2]'
          }`}
        >
          Load More
        </Link>
      </div>
    </div>
  );
}

export default async function LineAppPage({
  searchParams
}: {
  searchParams?: Promise<LineAppSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const coverage = normalizeCoverageType(resolvedSearchParams.coverage);
  const brand = normalizeSearchValue(resolvedSearchParams.brand);
  const model = normalizeSearchValue(resolvedSearchParams.model);
  const year = normalizeSearchValue(resolvedSearchParams.year);
  const page = parsePage(resolvedSearchParams.page);
  const hasFilters = Boolean(coverage || brand || model || year);
  const baseParams = new URLSearchParams();

  if (coverage) baseParams.set('coverage', coverage);
  if (brand) baseParams.set('brand', brand);
  if (model) baseParams.set('model', model);
  if (year) baseParams.set('year', year);
  const baseQueryString = baseParams.toString();

  const searchConditions: Prisma.Sql[] = [];
  const baseConditions: Prisma.Sql[] = [];
  const coverageTypeSql = buildCoverageTypeSql();

  if (coverage) {
    const coverageCondition = Prisma.sql`${coverageTypeSql} = ${coverage}`;

    searchConditions.push(coverageCondition);
    baseConditions.push(coverageCondition);
  }

  if (brand) {
    const condition = Prisma.sql`brand = ${brand}`;
    searchConditions.push(condition);
    baseConditions.push(condition);
  }

  if (model) {
    const condition = Prisma.sql`model = ${model}`;
    searchConditions.push(condition);
    baseConditions.push(condition);
  }

  if (year) {
    searchConditions.push(Prisma.sql`year = ${Number.parseInt(year, 10)}`);
  }

  const whereClause =
    searchConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(searchConditions, ' AND ')}`
      : Prisma.empty;

  const countRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*) AS total
    FROM InsurancePackage
    ${whereClause}
  `;
  const exactYearTotal = Number(countRows[0]?.total ?? 0);

  const effectiveConditions = year && exactYearTotal === 0 ? baseConditions : searchConditions;
  const effectiveWhereClause =
    effectiveConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(effectiveConditions, ' AND ')}`
      : Prisma.empty;

  const effectiveCountRows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*) AS total
    FROM InsurancePackage
    ${effectiveWhereClause}
  `;
  const totalItems = Number(effectiveCountRows[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const packages = await prisma.$queryRaw<InsurancePackageRow[]>`
    SELECT
      id,
      name,
      company,
      logoUrl,
      details,
      repairType,
      coverage,
      JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode,
      ${coverageTypeSql} AS coverageType,
      fullPrice,
      netPrice,
      discount,
      createdAt
    FROM InsurancePackage
    ${effectiveWhereClause}
    ORDER BY createdAt DESC, id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(safePage - 1) * PAGE_SIZE}
  `;

  let searchMeta: SearchResultMeta = {
    exactYearMatched: exactYearTotal > 0 || !year,
    usedFallbackYearSearch: Boolean(year && exactYearTotal === 0),
  };

  let insurancePackages = packages;
  const searchSummary = buildSearchSummary({ coverage, brand, model, year });

  const resultRange = totalItems === 0 ? { start: 0, end: 0 } : { start: (safePage - 1) * PAGE_SIZE + 1, end: Math.min(safePage * PAGE_SIZE, totalItems) };

  return (
    <main className="flex min-h-screen flex-col bg-[#faf8ff] text-[#191b23] antialiased">
      <header className="sticky top-0 z-10 flex w-full items-center justify-between bg-[#0052CC] px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/line-app/search" aria-label="กลับไปหน้า Search Premium" className="-ml-2 rounded-full p-2 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-[Kanit,sans-serif] text-lg font-semibold tracking-wide">เลือกแผนประกันราคาทุน</h1>
          <button type="button" aria-label="Menu" className="-mr-2 rounded-full p-2 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-6 px-4 py-6">
        {hasFilters ? (
          <section className="rounded-2xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            ผลลัพธ์สำหรับ: <span className="font-semibold">{searchSummary}</span>
            {searchMeta.usedFallbackYearSearch ? (
              <span className="mt-1 block text-xs font-normal text-[#4c6394]">
                ไม่มีข้อมูลปีจดทะเบียนตรงกับที่เลือก แสดงผลตามยี่ห้อและรุ่นแทน
              </span>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl bg-[#e1e2ec] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0052CC] text-sm font-bold text-white">
              i
            </div>
            <div>
              <h2 className="font-[Kanit,sans-serif] font-semibold text-[#0052CC]">
                {totalItems > 0 ? `ค้นพบ ${totalItems} แผนที่เหมาะกับคุณ` : 'ไม่พบแผนที่ตรงกับเงื่อนไข'}
              </h2>
              <p className="mt-1 text-sm text-[#434654]">ราคาต้นทุนจากบริษัทประกัน 100%</p>
            </div>
          </div>
        </section>

        {totalItems > 0 ? (
          <section className="rounded-2xl bg-white px-4 py-3 text-sm text-[#434654] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            แสดงผล {resultRange.start}-{resultRange.end} จาก {totalItems} แผน
          </section>
        ) : null}

        {totalItems >= 2 ? (
          <Link
            href={buildCompareHref(baseParams)}
            className="flex items-center justify-between rounded-2xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-4 text-sm font-semibold text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:bg-[#e1ebff]"
          >
            <span>ไปหน้า Comparison Table เพื่อเลือกแผนมาเทียบ</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}

        {insurancePackages.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <p className="font-[Kanit,sans-serif] text-lg font-semibold text-[#0052CC]">
              ขออภัย ไม่พบแผนประกันสำหรับข้อมูลนี้
            </p>
            <p className="mt-2 text-sm leading-6 text-[#434654]">
              กรุณาลองปรับข้อมูลรถยนต์ หรือกลับไปค้นหาใหม่อีกครั้ง
            </p>
          </div>
        ) : (
          <CompareSelection
            packages={insurancePackages.map((pkg) => ({
              id: pkg.id,
              name: pkg.name,
              company: pkg.company,
              logoUrl: pkg.logoUrl,
              details: pkg.details,
              repairType: pkg.repairType,
              coverage: pkg.coverage,
              coverageType: pkg.coverageType,
              fullPrice: pkg.fullPrice,
              netPrice: pkg.netPrice,
              discount: pkg.discount
            }))}
            baseQueryString={baseQueryString}
          />
        )}

        {totalItems > PAGE_SIZE ? (
          <PaginationControls currentPage={safePage} totalPages={totalPages} baseParams={baseParams} />
        ) : null}
      </div>
    </main>
  );
}