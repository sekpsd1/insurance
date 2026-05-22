import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCustomerCtpOptionsBySClass } from '@/lib/ctp-rates';
import { notFound } from 'next/navigation';
import CartPackageButton from './cart-package-button';
import RemoveComparePackageButton from './remove-compare-package-button';

type CompareSearchParams = {
  sClass?: string;
  coverage?: string;
  repairType?: string;
  brand?: string;
  model?: string;
  year?: string;
  cubicCapacity?: string;
  sumInsured?: string;
  ids?: string | string[];
  ctpIds?: string | string[];
};

type ComparePackageRow = {
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
  year: number | null;
  fullPrice: number;
  netPrice: number;
  payablePrice: number | null;
  discount: number;
  createdAt: Date;
};

type ComparePackage = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  details: string | null;
  repairType: string | null;
  coverage: string | null;
  coverageCode: string;
  coverageType: string;
  sClass: string;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  minSumInsured: number | null;
  maxSumInsured: number | null;
  brand: string;
  model: string;
  year: number | null;
  fullPrice: number;
  netPrice: number;
  payablePrice: number | null;
  discount: number;
  createdAt: Date;
};

const MAX_COMPARE_PACKAGES = 4;

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
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
    return 'ไม่มีทุนประกัน';
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

function buildResultsHref(filters: { sClass: string; coverage: string; repairType: string; brand: string; model: string; year: string; cubicCapacity: string; sumInsured: string }, ctpIds: string[] = []) {
  const params = new URLSearchParams();

  if (filters.sClass) params.set('sClass', filters.sClass);
  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.repairType) params.set('repairType', filters.repairType);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.model) params.set('model', filters.model);
  if (filters.year) params.set('year', filters.year);
  if (filters.cubicCapacity) params.set('cubicCapacity', filters.cubicCapacity);
  if (filters.sumInsured) params.set('sumInsured', filters.sumInsured);
  ctpIds.forEach((id) => params.append('ctpIds', id));

  const query = params.toString();
  return query ? `/line-app?${query}` : '/line-app';
}

function buildSearchHref(filters: { sClass: string; coverage: string; repairType: string; brand: string; model: string; year: string; cubicCapacity: string; sumInsured: string }) {
  const params = new URLSearchParams();

  if (filters.sClass) params.set('sClass', filters.sClass);
  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.repairType) params.set('repairType', filters.repairType);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.model) params.set('model', filters.model);
  if (filters.year) params.set('year', filters.year);
  if (filters.cubicCapacity) params.set('cubicCapacity', filters.cubicCapacity);
  if (filters.sumInsured) params.set('sumInsured', filters.sumInsured);

  const query = params.toString();
  return query ? `/line-app/search?${query}` : '/line-app/search';
}

function buildCompareHrefWithIds(filters: { sClass: string; coverage: string; repairType: string; brand: string; model: string; year: string; cubicCapacity: string; sumInsured: string }, ids: string[], ctpIds: string[]) {
  const params = new URLSearchParams();

  if (filters.sClass) params.set('sClass', filters.sClass);
  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.repairType) params.set('repairType', filters.repairType);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.model) params.set('model', filters.model);
  if (filters.year) params.set('year', filters.year);
  if (filters.cubicCapacity) params.set('cubicCapacity', filters.cubicCapacity);
  if (filters.sumInsured) params.set('sumInsured', filters.sumInsured);
  ids.forEach((id) => params.append('ids', id));
  ctpIds.forEach((id) => params.append('ctpIds', id));

  const query = params.toString();
  return query ? `/line-app/compare?${query}` : '/line-app/compare';
}

function normalizeIdList(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value : normalizeSearchValue(value) ? [normalizeSearchValue(value)] : [];

  const values = rawValue
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(values)).slice(0, MAX_COMPARE_PACKAGES);
}

function normalizePackageRow(row: ComparePackageRow) {
  return {
    ...row,
    brand: row.brand?.trim() ?? '',
    model: row.model?.trim() ?? '',
    sClass: row.sClass?.trim() ?? '',
    coverageType: row.coverageType?.trim() ?? '',
    coverageCode: row.coverageCode?.trim() ?? ''
  };
}

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function encodeLogoUrl(logoUrl: string) {
  return logoUrl
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

function parsePositiveInt(value: string) {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCarAgeFromRegistrationYear(year: string) {
  const parsedYear = parsePositiveInt(year);
  if (!parsedYear) {
    return null;
  }

  return Math.max(new Date().getFullYear() - parsedYear, 0);
}

export default async function ComparePage({
  searchParams
}: {
  searchParams?: Promise<CompareSearchParams>;
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
  const selectedCarAge = getCarAgeFromRegistrationYear(year);
  const selectedCubicCapacity = parsePositiveInt(cubicCapacity);
  const selectedSumInsured = parsePositiveInt(sumInsured);
  const selectedIds = normalizeIdList(resolvedSearchParams.ids);
  const selectedCtpIds = normalizeIdList(resolvedSearchParams.ctpIds);

  const coverageTypeSql = buildCoverageTypeSql();
  const repairTypeSql = Prisma.sql`
    CASE
      WHEN UPPER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.GarageCd')), ''))) = 'G'
        OR TRIM(COALESCE(repairType, '')) IN ('ซ่อมห้าง', 'อู่ห้าง')
        THEN 'dealer'
      ELSE 'garage'
    END
  `;
  const searchConditions: Prisma.Sql[] = [Prisma.sql`${coverageTypeSql} <> ''`];

  if (coverage) {
    searchConditions.push(Prisma.sql`${coverageTypeSql} = ${coverage}`);
  }

  if (repairType) {
    searchConditions.push(Prisma.sql`${repairTypeSql} = ${repairType}`);
  }

  if (sClass) {
    searchConditions.push(Prisma.sql`COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) = ${sClass}`);
  }

  if (brand) {
    searchConditions.push(Prisma.sql`brand = ${brand}`);
  }

  if (model) {
    searchConditions.push(Prisma.sql`model = ${model}`);
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

  const sourcePackages = await prisma.$queryRaw<ComparePackageRow[]>`
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
      year,
      fullPrice,
      netPrice,
      payablePrice,
      discount,
      createdAt
    FROM InsurancePackage
    ${whereClause}
    ORDER BY createdAt DESC, id DESC
    LIMIT 8
  `;

  let packages: ComparePackage[] = sourcePackages.map((row) => normalizePackageRow(row));

  if (selectedIds.length >= 2) {
    const idRows = await prisma.$queryRaw<ComparePackageRow[]>`
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
        year,
        fullPrice,
        netPrice,
        payablePrice,
        discount,
        createdAt
      FROM InsurancePackage
      WHERE id IN (${Prisma.join(selectedIds.map((id) => Prisma.sql`${id}`))})
      ORDER BY createdAt DESC, id DESC
    `;

    const selectedById = new Map<string, ComparePackage>(idRows.map((row) => {
      const normalized = normalizePackageRow(row);
      return [normalized.id, normalized];
    }));

    packages = selectedIds
      .map((id) => selectedById.get(id))
      .filter((row): row is ComparePackage => Boolean(row));
  }

  const searchSummary = buildSearchSummary({ sClass, coverage, repairType, brand, model, year, cubicCapacity, sumInsured });
  const searchHref = buildSearchHref({ sClass, coverage, repairType, brand, model, year, cubicCapacity, sumInsured });
  const compareFilters = { sClass, coverage, repairType, brand, model, year, cubicCapacity, sumInsured };
  const isComparisonReady = packages.length >= 2;
  const packageIdSet = new Set(packages.map((pkg) => pkg.id));
  const activeCtpIds = selectedCtpIds.filter((id) => packageIdSet.has(id));
  const activeCtpIdSet = new Set(activeCtpIds);
  const resultsHref = buildResultsHref(compareFilters, activeCtpIds);
  const ctpOptionsBySClass = await getCustomerCtpOptionsBySClass();
  const ctpOptionByPackageId = new Map(
    packages.map((pkg) => [
      pkg.id,
      activeCtpIdSet.has(pkg.id) && pkg.sClass ? ctpOptionsBySClass[pkg.sClass] ?? null : null
    ])
  );

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href={searchHref} aria-label="กลับไปหน้า Search Premium" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <h1 className="font-[Kanit,sans-serif] text-xl font-bold tracking-wide">ตารางเปรียบเทียบแผน</h1>
          <div className="h-9 w-9" />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-5xl flex-col gap-5 px-4 py-6">
        {searchSummary ? (
          <section className="rounded-3xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            ผลลัพธ์สำหรับ: <span className="font-semibold">{searchSummary}</span>
          </section>
        ) : null}

        <section className="rounded-2xl bg-white px-4 py-3 text-sm text-[#434654] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
          {isComparisonReady ? (
            <span>กำลังเปรียบเทียบ {packages.length} แผน</span>
          ) : (
            <span>เลือกอย่างน้อย 2 แผนเพื่อดูตารางเปรียบเทียบ</span>
          )}
        </section>

        {!isComparisonReady ? (
          <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
            <div className="mb-4 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e9efff] text-[#0047BA] shadow-inner">
                <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13h14a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2Z" />
                </svg>
              </div>
              <div>
                <h2 className="font-[Kanit,sans-serif] text-2xl font-bold leading-tight text-[#0047BA]">เลือกแผนที่ต้องการเปรียบเทียบ</h2>
                <p className="mt-1 text-sm leading-6 text-[#4b5265]">
                  ติ๊กเลือกอย่างน้อย 2 แผนจากรายการด้านล่าง แล้วกดปุ่มเปรียบเทียบ
                </p>
              </div>
            </div>

            {sourcePackages.length === 0 ? (
              <div className="rounded-2xl bg-[#f8f9ff] px-4 py-6 text-center text-sm text-[#434654]">
                ไม่พบรายการสำหรับเงื่อนไขนี้
              </div>
            ) : (
              <form action="/line-app/compare" method="get" className="space-y-3">
                {sClass ? <input type="hidden" name="sClass" value={sClass} /> : null}
                {coverage ? <input type="hidden" name="coverage" value={coverage} /> : null}
                {repairType ? <input type="hidden" name="repairType" value={repairType} /> : null}
                {brand ? <input type="hidden" name="brand" value={brand} /> : null}
                {model ? <input type="hidden" name="model" value={model} /> : null}
                {year ? <input type="hidden" name="year" value={year} /> : null}
                {cubicCapacity ? <input type="hidden" name="cubicCapacity" value={cubicCapacity} /> : null}
                {sumInsured ? <input type="hidden" name="sumInsured" value={sumInsured} /> : null}

                <div className="grid gap-3">
                  {sourcePackages.map((pkg) => (
                    <label
                      key={pkg.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-[#0052CC] hover:bg-[#eef3ff]"
                    >
                      <input
                        type="checkbox"
                        name="ids"
                        value={pkg.id}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0052CC] focus:ring-[#0052CC]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#0f4ec7] px-2.5 py-1 text-xs font-semibold text-white">
                            {getCoverageLabel(pkg.coverageType || coverage || '')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {pkg.company} · {pkg.brand || '-'} · {pkg.model || '-'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="sticky bottom-4 rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#003c9d]"
                  >
                    ดูตารางเปรียบเทียบ
                    <span aria-hidden="true">→</span>
                  </button>
                  <p className="mt-2 text-center text-xs text-[#4b5265]">เลือกได้สูงสุด {MAX_COMPARE_PACKAGES} แผน</p>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-20 bg-[#f8f9ff] px-4 py-4 text-left text-sm font-semibold text-slate-700">รายละเอียด</th>
                    {packages.map((pkg) => (
                      <th key={pkg.id} className="min-w-[220px] border-l border-slate-200 bg-[#eef3ff] px-4 py-4 text-left align-top">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#434654] shadow-sm ring-1 ring-slate-200">
                            {pkg.logoUrl ? (
                              <img src={encodeLogoUrl(pkg.logoUrl)} alt={pkg.company} className="h-full w-full rounded-full object-contain p-1" />
                            ) : (
                              'LOGO'
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6394]">{pkg.company}</p>
                              <RemoveComparePackageButton
                                href={buildCompareHrefWithIds(
                                  compareFilters,
                                  packages.filter((item) => item.id !== pkg.id).map((item) => item.id),
                                  activeCtpIds.filter((id) => id !== pkg.id)
                                )}
                                remainingIds={packages.filter((item) => item.id !== pkg.id).map((item) => item.id)}
                                remainingCtpIds={activeCtpIds.filter((id) => id !== pkg.id)}
                              />
                            </div>
                            <p className="mt-2 text-sm font-semibold text-[#0f4ec7]">{getCoverageLabel(pkg.coverageType || coverage || '')}</p>
                            <div className="mt-3">
                              <CartPackageButton packageId={pkg.id} includeCtp={Boolean(ctpOptionByPackageId.get(pkg.id))} />
                            </div>
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'บริษัท', values: packages.map((pkg) => pkg.company) },
                    { label: 'ยี่ห้อ', values: packages.map((pkg) => pkg.brand || '-') },
                    { label: 'รุ่น', values: packages.map((pkg) => pkg.model || '-') },
                    { label: 'ปี', values: packages.map((pkg) => (pkg.year ? String(pkg.year) : year || '-')) },
                    { label: 'ขนาดเครื่องยนต์', values: packages.map((pkg) => (pkg.minCubicCapacity || pkg.maxCubicCapacity ? `${formatMoney(pkg.minCubicCapacity ?? 0)}-${formatMoney(pkg.maxCubicCapacity ?? 0)} ซีซี` : '-')) },
                    { label: 'ทุนประกัน', values: packages.map((pkg) => (pkg.minSumInsured || pkg.maxSumInsured ? `${formatMoney(pkg.minSumInsured ?? pkg.maxSumInsured ?? 0)} บาท` : '-')) },
                    { label: 'ประเภทซ่อม', values: packages.map((pkg) => pkg.repairType || 'อู่ประกัน') },
                    { label: 'เบี้ยประกันราคาทุน', values: packages.map((pkg) => `${formatMoney(pkg.netPrice)} บาท`) },
                    { label: 'พ.ร.บ. เพิ่มเติม', values: packages.map((pkg) => {
                      const ctpOption = ctpOptionByPackageId.get(pkg.id);
                      return ctpOption ? `${formatMoney(ctpOption.total)} บาท` : '-';
                    }) },
                    { label: 'รวม', values: packages.map((pkg) => {
                      const ctpOption = ctpOptionByPackageId.get(pkg.id);
                      return `${formatMoney(pkg.netPrice + (ctpOption?.total ?? 0))} บาท`;
                    }) },
                    { label: 'คงเหลือชำระ', values: packages.map((pkg) => {
                      const ctpOption = ctpOptionByPackageId.get(pkg.id);
                      return `${formatMoney((pkg.payablePrice ?? pkg.netPrice) + (ctpOption?.total ?? 0))} บาท`;
                    }) },
                    { label: 'รายละเอียด', values: packages.map((pkg) => pkg.details || '-') }
                  ].map((row) => (
                    <tr key={row.label}>
                      <th className="sticky left-0 z-10 border-t border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700">
                        {row.label}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={`${row.label}-${index}`} className="border-t border-l border-slate-200 px-4 py-3 text-sm leading-6 text-slate-600">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={searchHref} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0047BA] shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-[#cfd8ff] transition hover:bg-[#eef3ff]">
            กลับไปค้นหา
          </Link>
          <Link href={resultsHref} className="rounded-2xl bg-[#0047BA] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003c9d]">
            ไปหน้าผลลัพธ์
          </Link>
        </div>
      </div>
    </main>
  );
}
