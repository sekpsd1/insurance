import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import SearchPremiumForm from './search-premium-form';
import CloseLineMenuButton from '../_components/close-line-menu-button';

type SearchPremiumSearchParams = {
  sClass?: string;
  coverage?: string;
  repairType?: string;
  brand?: string;
  model?: string;
  year?: string;
  cubicCapacity?: string;
  sumInsured?: string;
};

type OptionRow = {
  sClass: string | null;
  coverageCode: string | null;
  repairType: 'dealer' | 'garage' | null;
  brand: string | null;
  model: string | null;
  minCarAge: number | null;
  maxCarAge: number | null;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  minSumInsuredValues: string | null;
  maxSumInsuredValues: string | null;
};

function normalizeCoverageType(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';

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

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function normalizeVehicleOptionValue(value: string | string[] | undefined) {
  return normalizeSearchValue(value).toLocaleUpperCase('en-US');
}

function normalizeRepairType(value: string | string[] | undefined) {
  const normalized = normalizeSearchValue(value);
  return normalized === 'dealer' || normalized === 'garage' ? normalized : '';
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

function toNumberOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function SearchCarBannerIllustration() {
  return (
    <svg viewBox="0 0 220 130" className="h-full w-full" role="img" aria-label="รูปรถ">
      <defs>
        <linearGradient id="search-car-body" x1="36" x2="178" y1="69" y2="69" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e9f3ff" />
        </linearGradient>
        <linearGradient id="search-car-shield" x1="163" x2="199" y1="5" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#35b8ff" />
          <stop offset="1" stopColor="#0052cc" />
        </linearGradient>
      </defs>
      <path d="M16 106c29-22 53-26 83-22 44 6 70-10 104-44v66H16Z" fill="#dff0ff" opacity="0.75" />
      <path d="M178 9 202 18v20c0 16-10 30-24 36-14-6-24-20-24-36V18l24-9Z" fill="url(#search-car-shield)" />
      <path d="m167 39 8 8 17-21" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
      <path d="M40 75c5-16 16-27 34-30h48c17 0 30 12 38 30l14 3c9 2 16 10 16 19v5H27v-8c0-10 5-17 13-19Z" fill="url(#search-car-body)" stroke="#b7d2ef" strokeWidth="2" />
      <path d="M70 48h49c11 0 21 8 28 23H54c4-12 9-20 16-23Z" fill="#0f477f" opacity="0.18" />
      <path d="M58 72h93" stroke="#c4d9ef" strokeLinecap="round" strokeWidth="3" />
      <path d="M49 86h16M153 86h16" stroke="#0052cc" strokeLinecap="round" strokeWidth="4" />
      <circle cx="64" cy="103" r="14" fill="#102236" />
      <circle cx="64" cy="103" r="6" fill="#cfe2f8" />
      <circle cx="154" cy="103" r="14" fill="#102236" />
      <circle cx="154" cy="103" r="6" fill="#cfe2f8" />
      <path d="M20 114h182" stroke="#c2d9f2" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function buildResultsHref(filters: {
  sClass: string;
  coverage: string;
  repairType: string;
  brand: string;
  model: string;
  year: string;
  cubicCapacity: string;
  sumInsured: string;
}) {
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
  return query ? `/line-app?${query}` : '/line-app';
}

export default async function SearchInsurancePage({
  searchParams
}: {
  searchParams?: Promise<SearchPremiumSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedSClass = normalizeSearchValue(resolvedSearchParams.sClass);
  const selectedCoverage = normalizeSearchValue(resolvedSearchParams.coverage);
  const selectedRepairType = normalizeRepairType(resolvedSearchParams.repairType);
  const selectedBrand = normalizeVehicleOptionValue(resolvedSearchParams.brand);
  const selectedModel = normalizeVehicleOptionValue(resolvedSearchParams.model);
  const selectedYear = normalizeSearchValue(resolvedSearchParams.year);
  const selectedCubicCapacity = normalizeSearchValue(resolvedSearchParams.cubicCapacity);
  const selectedSumInsured = normalizeSearchValue(resolvedSearchParams.sumInsured);
  const resultsHref = buildResultsHref({
    sClass: selectedSClass,
    coverage: selectedCoverage,
    repairType: selectedRepairType,
    brand: selectedBrand,
    model: selectedModel,
    year: selectedYear,
    cubicCapacity: selectedCubicCapacity,
    sumInsured: selectedSumInsured
  });

  const optionRows = await prisma.$queryRaw<OptionRow[]>`
    SELECT
      sClass,
      repairType,
      brand,
      model,
      minCarAge,
      maxCarAge,
      minCubicCapacity,
      maxCubicCapacity,
      coverageCode,
      GROUP_CONCAT(DISTINCT minSumInsured ORDER BY minSumInsured SEPARATOR ',') AS minSumInsuredValues,
      GROUP_CONCAT(DISTINCT maxSumInsured ORDER BY maxSumInsured SEPARATOR ',') AS maxSumInsuredValues
    FROM (
      SELECT
        COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) AS sClass,
        CASE
          WHEN UPPER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.GarageCd')), ''))) IN ('G', 'DG')
            OR TRIM(COALESCE(repairType, '')) IN ('ซ่อมห้าง', 'อู่ห้าง')
            THEN 'dealer'
          ELSE 'garage'
        END AS repairType,
        brand,
        model,
        COALESCE(minCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinYear')), '') AS UNSIGNED)) AS minCarAge,
        COALESCE(maxCarAge, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxYear')), '') AS UNSIGNED)) AS maxCarAge,
        COALESCE(minCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinCST')), '') AS UNSIGNED)) AS minCubicCapacity,
        COALESCE(maxCubicCapacity, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxCST')), '') AS UNSIGNED)) AS maxCubicCapacity,
        COALESCE(minSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinSI')), '') AS UNSIGNED)) AS minSumInsured,
        COALESCE(maxSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxSI')), '') AS UNSIGNED)) AS maxSumInsured,
        JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode
      FROM InsurancePackage
      WHERE brand IS NOT NULL
        AND brand <> ''
        AND model IS NOT NULL
        AND model <> ''
    ) source
    GROUP BY
      sClass,
      repairType,
      brand,
      model,
      minCarAge,
      maxCarAge,
      minCubicCapacity,
      maxCubicCapacity,
      coverageCode
    ORDER BY sClass ASC, brand ASC, model ASC, minCarAge ASC
  `;

  const normalizedOptionRows = optionRows
    .map((row) => ({
      sClass: row.sClass?.trim() ?? '',
      coverageType: normalizeCoverageType(row.coverageCode),
      repairType: row.repairType,
      brand: normalizeVehicleOptionValue(row.brand ?? ''),
      model: normalizeVehicleOptionValue(row.model ?? ''),
      minCarAge: toNumberOrNull(row.minCarAge),
      maxCarAge: toNumberOrNull(row.maxCarAge),
      minCubicCapacity: toNumberOrNull(row.minCubicCapacity),
      maxCubicCapacity: toNumberOrNull(row.maxCubicCapacity),
      sumInsuredValues: Array.from(
        new Set([...parseNumberCsv(row.minSumInsuredValues), ...parseNumberCsv(row.maxSumInsuredValues)])
      )
    }))
    .filter((row) => Boolean(row.sClass && row.coverageType && row.repairType && row.brand && row.model));

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto grid max-w-md grid-cols-[auto_auto_1fr] items-center gap-2 px-3 py-3">
          <Link href={resultsHref} aria-label="ย้อนกลับ" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <CloseLineMenuButton />

          <h1 className="min-w-0 text-right font-[Kanit,sans-serif] text-lg font-bold leading-tight tracking-wide max-[360px]:text-base">ค้นหาเบี้ยประกัน</h1>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col px-4 pb-6 pt-5">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#f4f9ff] to-[#dfeeff] px-4 py-3 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <div className="grid min-h-[104px] grid-cols-[minmax(0,1fr)_136px] items-center gap-2 max-[360px]:grid-cols-[minmax(0,1fr)_112px]">
            <div className="min-w-0 self-center">
              <h2 className="max-w-[15rem] font-[Kanit,sans-serif] text-[clamp(16px,4.5vw,20px)] font-bold leading-snug text-[#0052CC]">
                กรุณากรอกรายละเอียดรถยนต์
                <span className="block">เพื่อใช้เสนอราคา</span>
              </h2>
            </div>
            <div className="min-w-0 self-end justify-self-end">
              <SearchCarBannerIllustration />
            </div>
          </div>
        </section>

        <SearchPremiumForm
          optionRows={normalizedOptionRows}
          initialSClass={selectedSClass}
          initialCoverage={selectedCoverage}
          initialRepairType={selectedRepairType}
          initialBrand={selectedBrand}
          initialModel={selectedModel}
          initialYear={selectedYear}
          initialCubicCapacity={selectedCubicCapacity}
          initialSumInsured={selectedSumInsured}
        />
      </div>
    </main>
  );
}
