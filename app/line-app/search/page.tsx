import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import SearchPremiumForm from './search-premium-form';

type SearchPremiumSearchParams = {
  sClass?: string;
  coverage?: string;
  brand?: string;
  model?: string;
  year?: string;
  cubicCapacity?: string;
  sumInsured?: string;
};

type OptionRow = {
  sClass: string | null;
  coverageCode: string | null;
  brand: string | null;
  model: string | null;
  minCarAge: number | null;
  maxCarAge: number | null;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  minSumInsured: number | null;
  maxSumInsured: number | null;
};

function normalizeCoverageType(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';

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

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

export default async function SearchInsurancePage({
  searchParams
}: {
  searchParams?: Promise<SearchPremiumSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedSClass = normalizeSearchValue(resolvedSearchParams.sClass);
  const selectedCoverage = normalizeSearchValue(resolvedSearchParams.coverage);
  const selectedBrand = normalizeSearchValue(resolvedSearchParams.brand);
  const selectedModel = normalizeSearchValue(resolvedSearchParams.model);
  const selectedYear = normalizeSearchValue(resolvedSearchParams.year);
  const selectedCubicCapacity = normalizeSearchValue(resolvedSearchParams.cubicCapacity);
  const selectedSumInsured = normalizeSearchValue(resolvedSearchParams.sumInsured);

  const optionRows = await prisma.$queryRaw<OptionRow[]>`
    SELECT DISTINCT
      COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) AS sClass,
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
    ORDER BY sClass ASC, brand ASC, model ASC, minCarAge ASC
  `;
  const currentYear = new Date().getFullYear();

  const normalizedOptionRows = optionRows
    .map((row) => ({
      sClass: row.sClass?.trim() ?? '',
      coverageType: normalizeCoverageType(row.coverageCode),
      brand: row.brand?.trim() ?? '',
      model: row.model?.trim() ?? '',
      minCarAge: row.minCarAge,
      maxCarAge: row.maxCarAge,
      minCubicCapacity: row.minCubicCapacity,
      maxCubicCapacity: row.maxCubicCapacity,
      minSumInsured: row.minSumInsured,
      maxSumInsured: row.maxSumInsured,
      years:
        row.minCarAge !== null && row.maxCarAge !== null
          ? Array.from(
              { length: Math.max(row.maxCarAge - row.minCarAge + 1, 0) },
              (_, index) => String(currentYear - (row.minCarAge ?? 0) - index)
            )
          : []
    }))
    .filter((row) => Boolean(row.sClass && row.coverageType && row.coverageType !== '1' && row.brand && row.model));

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link href="/line-app" aria-label="ย้อนกลับ" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <h1 className="font-[Kanit,sans-serif] text-xl font-bold tracking-wide">ค้นหาเบี้ยประกัน</h1>
          <div className="h-9 w-9" />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-md flex-col px-4 pb-6 pt-6">
        <section className="rounded-3xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e9efff] text-[#0047BA] shadow-inner">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13h14a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 17.5h.01M16.5 17.5h.01" />
              </svg>
            </div>

            <div>
              <h2 className="font-[Kanit,sans-serif] text-2xl font-bold leading-tight text-[#0047BA]">ข้อมูลรถยนต์ของคุณ</h2>
              <p className="mt-1 text-sm leading-6 text-[#4b5265]">
                กรุณาระบุรายละเอียดเพื่อดูแผนประกันและราคาทุนจากข้อมูลจริง
              </p>
            </div>
          </div>
        </section>

        <SearchPremiumForm
          optionRows={normalizedOptionRows}
          initialSClass={selectedSClass}
          initialCoverage={selectedCoverage}
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
