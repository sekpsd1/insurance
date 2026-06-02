import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import CompareSelection from './_components/compare-selection';
import ResultsQuickFilters from './_components/results-quick-filters';
import { getCustomerCtpOptionsBySClass } from '@/lib/ctp-rates';

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function toNumber(value: unknown) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIdList(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value : normalizeSearchValue(value) ? [normalizeSearchValue(value)] : [];

  return Array.from(
    new Set(
      rawValue
        .flatMap((entry) => entry.split(','))
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

type LineAppSearchParams = {
  sClass?: string;
  coverage?: string;
  repairType?: string;
  brand?: string;
  model?: string;
  year?: string;
  cubicCapacity?: string;
  sumInsured?: string;
  page?: string;
  ctpIds?: string | string[];
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
  sClass: string | null;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  minSumInsured: number | null;
  maxSumInsured: number | null;
  brand: string | null;
  model: string | null;
  fullPrice: number;
  netPrice: number;
  payablePrice: number | null;
  discount: number;
  uom1V: string | null;
  uom2V: string | null;
  uom5V: string | null;
  seats41: string | null;
  mv411: string | null;
  mv412: string | null;
  mv42: string | null;
  mv43: string | null;
  dedod: string | null;
  createdAt: Date;
};

type SearchResultMeta = {
  exactYearMatched: boolean;
  usedFallbackYearSearch: boolean;
};

type QuickFilterOptionRow = {
  coverageType: string | null;
  repairType: 'dealer' | 'garage' | null;
  minSumInsuredValues: string | null;
  maxSumInsuredValues: string | null;
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

  if (normalized === '1') {
    return '1';
  }

  if (normalized === '2.1' || normalized === '2.2' || normalized === '2+') {
    return '2+';
  }

  if (normalized === '3.1' || normalized === '3.2' || normalized === '3+') {
    return '3+';
  }

  if (normalized === '3') {
    return '3';
  }

  return '';
}

function normalizeRepairType(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  return normalized === 'dealer' || normalized === 'garage' ? normalized : '';
}

function getCoverageLabel(value: string) {
  if (value === '1') return 'ประเภท 1';
  if (value === '2+') return 'ประเภท 2 พลัส';
  if (value === '3+') return 'ประเภท 3 พลัส';
  if (value === '3') return 'ประเภท 3';
  return value;
}

function getSClassLabel(value: string) {
  if (value === '110') return 'รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู';
  if (value === '320') return 'รถกระบะ 2 ประตู';
  if (value === '210') return 'รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า';

  const labels: Record<string, string> = {
    '110': '110 รถยนต์นั่งส่วนบุคคล',
    '210': '210 รถยนต์โดยสารส่วนบุคคล',
    '320': '320 รถยนต์บรรทุกส่วนบุคคล'
  };

  return labels[value] ?? value;
}

function getRepairTypeLabel(value: string) {
  if (value === 'dealer') return 'ซ่อมห้าง';
  if (value === 'garage') return 'ซ่อมอู่';
  return value;
}

function formatSumInsured(value: string) {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  if (parsed === 0) {
    return 'ไม่คุ้มครอง';
  }

  return Number.isFinite(parsed) ? parsed.toLocaleString('th-TH') : value;
}

function formatCubicCapacity(value: string) {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return `${parsed.toLocaleString('th-TH')} ซีซี`;
}

function buildSearchSummary(filters: { sClass: string; coverage: string; repairType: string; brand: string; model: string; year: string; cubicCapacity: string; sumInsured: string }) {
  return [
    filters.sClass ? getSClassLabel(filters.sClass) : '',
    filters.coverage ? getCoverageLabel(filters.coverage) : '',
    filters.repairType ? getRepairTypeLabel(filters.repairType) : '',
    filters.brand,
    filters.model,
    filters.year,
    filters.cubicCapacity ? formatCubicCapacity(filters.cubicCapacity) : '',
    filters.sumInsured ? `ทุน ${formatSumInsured(filters.sumInsured)}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function parsePage(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeInt(value: string) {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseNumberCsv(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
}

function getCarAgeFromRegistrationYear(year: string) {
  const parsedYear = parsePositiveInt(year);
  if (!parsedYear) {
    return null;
  }

  return Math.max(new Date().getFullYear() - parsedYear, 0);
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

function buildSearchHref(baseParams: URLSearchParams) {
  const params = new URLSearchParams(baseParams);
  params.delete('page');

  const query = params.toString();
  return query ? `/line-app/search?${query}` : '/line-app/search';
}

function buildCoverageTypeSql() {
  return Prisma.sql`
    CASE
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) LIKE '1%' THEN '1'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) IN ('2.1', '2.2') THEN '2+'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) IN ('3.1', '3.2') THEN '3+'
      WHEN TRIM(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod'))) = '3' THEN '3'
      ELSE ''
    END
  `;
}

function buildRepairTypeSql() {
  return Prisma.sql`
    CASE
      WHEN UPPER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.GarageCd')), ''))) = 'G'
        OR TRIM(COALESCE(repairType, '')) IN ('ซ่อมห้าง', 'อู่ห้าง')
        THEN 'dealer'
      ELSE 'garage'
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
  const sClass = normalizeSearchValue(resolvedSearchParams.sClass);
  const coverage = normalizeCoverageType(resolvedSearchParams.coverage);
  const repairType = normalizeRepairType(resolvedSearchParams.repairType);
  const brand = normalizeSearchValue(resolvedSearchParams.brand);
  const model = normalizeSearchValue(resolvedSearchParams.model);
  const year = normalizeSearchValue(resolvedSearchParams.year);
  const cubicCapacity = normalizeSearchValue(resolvedSearchParams.cubicCapacity);
  const sumInsured = normalizeSearchValue(resolvedSearchParams.sumInsured);
  const initialCtpPackageIds = normalizeIdList(resolvedSearchParams.ctpIds);
  const page = parsePage(resolvedSearchParams.page);
  const selectedCarAge = getCarAgeFromRegistrationYear(year);
  const selectedCubicCapacity = parsePositiveInt(cubicCapacity);
  const selectedSumInsured = parseNonNegativeInt(sumInsured);
  const hasFilters = Boolean(sClass || coverage || repairType || brand || model || year || cubicCapacity || sumInsured);

  if (!hasFilters) {
    redirect('/line-app/search');
  }

  const baseParams = new URLSearchParams();

  if (sClass) baseParams.set('sClass', sClass);
  if (coverage) baseParams.set('coverage', coverage);
  if (repairType) baseParams.set('repairType', repairType);
  if (brand) baseParams.set('brand', brand);
  if (model) baseParams.set('model', model);
  if (year) baseParams.set('year', year);
  if (cubicCapacity) baseParams.set('cubicCapacity', cubicCapacity);
  if (sumInsured) baseParams.set('sumInsured', sumInsured);
  const baseQueryString = baseParams.toString();

  const coverageTypeSql = buildCoverageTypeSql();
  const repairTypeSql = buildRepairTypeSql();
  const searchConditions: Prisma.Sql[] = [Prisma.sql`${coverageTypeSql} <> ''`];
  const baseConditions: Prisma.Sql[] = [Prisma.sql`${coverageTypeSql} <> ''`];

  if (coverage) {
    const coverageCondition = Prisma.sql`${coverageTypeSql} = ${coverage}`;

    searchConditions.push(coverageCondition);
    baseConditions.push(coverageCondition);
  }

  if (repairType) {
    const repairTypeCondition = Prisma.sql`${repairTypeSql} = ${repairType}`;

    searchConditions.push(repairTypeCondition);
    baseConditions.push(repairTypeCondition);
  }

  if (sClass) {
    const condition = Prisma.sql`COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) = ${sClass}`;
    searchConditions.push(condition);
    baseConditions.push(condition);
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

  if (selectedCarAge !== null) {
    searchConditions.push(Prisma.sql`
      COALESCE(minCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinYear')), '') AS UNSIGNED)) <= ${selectedCarAge}
      AND COALESCE(maxCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxYear')), '') AS UNSIGNED)) >= ${selectedCarAge}
    `);
  }

  if (selectedCubicCapacity !== null) {
    searchConditions.push(Prisma.sql`
      COALESCE(minCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinCST')), '') AS UNSIGNED)) <= ${selectedCubicCapacity}
      AND COALESCE(maxCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxCST')), '') AS UNSIGNED)) >= ${selectedCubicCapacity}
    `);
  }

  if (selectedSumInsured !== null) {
    searchConditions.push(Prisma.sql`
      COALESCE(minSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinSI')), '') AS UNSIGNED)) <= ${selectedSumInsured}
      AND COALESCE(maxSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxSI')), '') AS UNSIGNED)) >= ${selectedSumInsured}
    `);
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

  const effectiveConditions = searchConditions;
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
      CASE WHEN ${repairTypeSql} = 'dealer' THEN 'ซ่อมห้าง' ELSE 'ซ่อมอู่' END AS repairType,
      coverage,
      JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode,
      ${coverageTypeSql} AS coverageType,
      COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) AS sClass,
      COALESCE(minCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinCST')), '') AS UNSIGNED)) AS minCubicCapacity,
      COALESCE(maxCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxCST')), '') AS UNSIGNED)) AS maxCubicCapacity,
      COALESCE(minSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinSI')), '') AS UNSIGNED)) AS minSumInsured,
      COALESCE(maxSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxSI')), '') AS UNSIGNED)) AS maxSumInsured,
      brand,
      model,
      fullPrice,
      netPrice,
      payablePrice,
      discount,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom1_v'), JSON_EXTRACT(rawData, '$.UOM1_V'))) AS uom1V,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom2_v'), JSON_EXTRACT(rawData, '$.UOM2_V'))) AS uom2V,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom5_v'), JSON_EXTRACT(rawData, '$.UOM5_V'))) AS uom5V,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.Seats41'), JSON_EXTRACT(rawData, '$.seats41'))) AS seats41,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv411'), JSON_EXTRACT(rawData, '$.MV411'))) AS mv411,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv412'), JSON_EXTRACT(rawData, '$.MV412'))) AS mv412,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv42'), JSON_EXTRACT(rawData, '$.MV42'))) AS mv42,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv43'), JSON_EXTRACT(rawData, '$.MV43'))) AS mv43,
      JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.Dedod'), JSON_EXTRACT(rawData, '$.dedod'))) AS dedod,
      createdAt
    FROM InsurancePackage
    ${effectiveWhereClause}
    ORDER BY createdAt DESC, id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(safePage - 1) * PAGE_SIZE}
  `;

  const quickFilterConditions: Prisma.Sql[] = [Prisma.sql`${coverageTypeSql} <> ''`];

  if (sClass) {
    quickFilterConditions.push(Prisma.sql`COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) = ${sClass}`);
  }

  if (brand) {
    quickFilterConditions.push(Prisma.sql`brand = ${brand}`);
  }

  if (model) {
    quickFilterConditions.push(Prisma.sql`model = ${model}`);
  }

  if (selectedCarAge !== null) {
    quickFilterConditions.push(Prisma.sql`
      COALESCE(minCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinYear')), '') AS UNSIGNED)) <= ${selectedCarAge}
      AND COALESCE(maxCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxYear')), '') AS UNSIGNED)) >= ${selectedCarAge}
    `);
  }

  if (selectedCubicCapacity !== null) {
    quickFilterConditions.push(Prisma.sql`
      COALESCE(minCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinCST')), '') AS UNSIGNED)) <= ${selectedCubicCapacity}
      AND COALESCE(maxCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxCST')), '') AS UNSIGNED)) >= ${selectedCubicCapacity}
    `);
  }

  const quickFilterWhereClause = Prisma.sql`WHERE ${Prisma.join(quickFilterConditions, ' AND ')}`;
  const quickFilterRows = await prisma.$queryRaw<QuickFilterOptionRow[]>`
    SELECT
      coverageType,
      repairType,
      GROUP_CONCAT(DISTINCT minSumInsured ORDER BY minSumInsured SEPARATOR ',') AS minSumInsuredValues,
      GROUP_CONCAT(DISTINCT maxSumInsured ORDER BY maxSumInsured SEPARATOR ',') AS maxSumInsuredValues
    FROM (
      SELECT
        ${coverageTypeSql} AS coverageType,
        ${repairTypeSql} AS repairType,
        COALESCE(minSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinSI')), '') AS UNSIGNED)) AS minSumInsured,
        COALESCE(maxSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxSI')), '') AS UNSIGNED)) AS maxSumInsured
      FROM InsurancePackage
      ${quickFilterWhereClause}
    ) quickFilterSource
    GROUP BY coverageType, repairType
    ORDER BY coverageType ASC, repairType ASC
  `;

  const quickFilterOptions = quickFilterRows.flatMap((row) => {
    const normalizedCoverageType = row.coverageType?.trim();

    if (
      normalizedCoverageType !== '1' &&
      normalizedCoverageType !== '2+' &&
      normalizedCoverageType !== '3+' &&
      normalizedCoverageType !== '3'
    ) {
      return [];
    }

    if (row.repairType !== 'dealer' && row.repairType !== 'garage') {
      return [];
    }

    const coverageType = normalizedCoverageType as '1' | '2+' | '3+' | '3';

    return [
      {
        coverageType,
        repairType: row.repairType,
        sumInsuredValues: Array.from(
          new Set([...parseNumberCsv(row.minSumInsuredValues), ...parseNumberCsv(row.maxSumInsuredValues)])
        )
      }
    ];
  });

  const currentQuickFilterOption = quickFilterOptions.find(
    (option) => option.coverageType === coverage && option.repairType === repairType
  );
  const validCurrentSumInsuredValues = currentQuickFilterOption?.sumInsuredValues ?? [];

  if (coverage === '3' && sumInsured) {
    const normalizedParams = new URLSearchParams(baseParams);
    normalizedParams.delete('sumInsured');
    normalizedParams.delete('page');
    redirect(`/line-app?${normalizedParams.toString()}`);
  }

  if (
    coverage &&
    coverage !== '3' &&
    repairType &&
    validCurrentSumInsuredValues.length > 0 &&
    !validCurrentSumInsuredValues.some((value) => String(value) === sumInsured)
  ) {
    const normalizedParams = new URLSearchParams(baseParams);
    normalizedParams.set('sumInsured', String(validCurrentSumInsuredValues[0]));
    normalizedParams.delete('page');
    redirect(`/line-app?${normalizedParams.toString()}`);
  }

  let searchMeta: SearchResultMeta = {
    exactYearMatched: exactYearTotal > 0 || !year,
    usedFallbackYearSearch: false,
  };

  let insurancePackages = packages;
  const ctpOptionsBySClass = await getCustomerCtpOptionsBySClass();
  const searchSummary = buildSearchSummary({ sClass, coverage, repairType, brand, model, year, cubicCapacity, sumInsured });

  const resultRange = totalItems === 0 ? { start: 0, end: 0 } : { start: (safePage - 1) * PAGE_SIZE + 1, end: Math.min(safePage * PAGE_SIZE, totalItems) };

  return (
    <main className="flex min-h-screen flex-col bg-[#faf8ff] text-[#191b23] antialiased">
      <header className="sticky top-0 z-10 flex w-full items-center justify-between bg-[#0052CC] px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href={buildSearchHref(baseParams)} aria-label="กลับไปหน้า Search Premium" className="-ml-2 rounded-full p-2 transition-colors hover:bg-white/10">
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

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-4 px-4 py-4">
        {hasFilters ? (
          <section className="hidden rounded-2xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            ผลลัพธ์สำหรับ: <span className="font-semibold">{searchSummary}</span>
            {searchMeta.usedFallbackYearSearch ? (
              <span className="mt-1 block text-xs font-normal text-[#4c6394]">
                ไม่มีข้อมูลปีจดทะเบียนตรงกับที่เลือก แสดงผลตามยี่ห้อและรุ่นแทน
              </span>
            ) : null}
          </section>
        ) : null}

        {hasFilters ? (
          <ResultsQuickFilters
            optionRows={quickFilterOptions}
            baseQueryString={baseQueryString}
            searchHref={buildSearchHref(baseParams)}
            currentCoverage={coverage}
            currentRepairType={repairType}
            currentSumInsured={sumInsured}
            vehicleTitle={[brand, model, year].filter(Boolean).join(' ') || 'ข้อมูลรถของคุณ'}
            vehicleSubtitle={[sClass ? getSClassLabel(sClass) : '', cubicCapacity ? formatCubicCapacity(cubicCapacity) : '']
              .filter(Boolean)
              .join(' · ')}
          />
        ) : null}

        <section className="hidden rounded-xl bg-[#e1e2ec] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
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
          <section className="hidden rounded-2xl bg-white px-4 py-3 text-sm text-[#434654] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            แสดงผล {resultRange.start}-{resultRange.end} จาก {totalItems} แผน
          </section>
        ) : null}

        {totalItems >= 2 ? (
          <Link
            href={buildCompareHref(baseParams)}
            className="hidden items-center justify-between rounded-2xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-4 text-sm font-semibold text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition hover:bg-[#e1ebff]"
          >
            <span>ไปหน้าเปรียบเทียบแผน เพื่อเลือกแผนมาเทียบ</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}

        <div className="-order-10">
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
              repairType: pkg.repairType,
              coverage: pkg.coverage,
              coverageCode: pkg.coverageCode,
              coverageType: pkg.coverageType,
              sClass: pkg.sClass,
              minCubicCapacity: toNumberOrNull(pkg.minCubicCapacity),
              maxCubicCapacity: toNumberOrNull(pkg.maxCubicCapacity),
              minSumInsured: toNumberOrNull(pkg.minSumInsured),
              maxSumInsured: toNumberOrNull(pkg.maxSumInsured),
              brand: pkg.brand,
              model: pkg.model,
              fullPrice: toNumber(pkg.fullPrice),
              netPrice: toNumber(pkg.netPrice),
              payablePrice: toNumberOrNull(pkg.payablePrice),
              discount: toNumber(pkg.discount),
              uom1V: pkg.uom1V,
              uom2V: pkg.uom2V,
              uom5V: pkg.uom5V,
              seats41: pkg.seats41,
              mv411: pkg.mv411,
              mv412: pkg.mv412,
              mv42: pkg.mv42,
              mv43: pkg.mv43,
              dedod: pkg.dedod
            }))}
            ctpOptionsBySClass={ctpOptionsBySClass}
            baseQueryString={baseQueryString}
            vehicleTypeLabel={sClass ? getSClassLabel(sClass) : ''}
            registrationYear={year}
            cubicCapacityLabel={cubicCapacity ? formatCubicCapacity(cubicCapacity) : ''}
            initialCtpPackageIds={initialCtpPackageIds}
          />
        )}
        </div>

        {totalItems > PAGE_SIZE ? (
          <PaginationControls currentPage={safePage} totalPages={totalPages} baseParams={baseParams} />
        ) : null}
      </div>
    </main>
  );
}
