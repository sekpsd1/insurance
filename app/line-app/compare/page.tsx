import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

type CompareSearchParams = {
  coverage?: string;
  brand?: string;
  model?: string;
  year?: string;
  ids?: string | string[];
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
  brand: string | null;
  model: string | null;
  year: number | null;
  fullPrice: number;
  netPrice: number;
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
  brand: string;
  model: string;
  year: number | null;
  fullPrice: number;
  netPrice: number;
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

function buildSearchSummary(filters: { coverage: string; brand: string; model: string; year: string }) {
  return [filters.coverage ? getCoverageLabel(filters.coverage) : '', filters.brand, filters.model, filters.year].filter(Boolean).join(' ');
}

function buildResultsHref(filters: { coverage: string; brand: string; model: string; year: string }) {
  const params = new URLSearchParams();

  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.model) params.set('model', filters.model);
  if (filters.year) params.set('year', filters.year);

  const query = params.toString();
  return query ? `/line-app?${query}` : '/line-app';
}

function buildSearchHref(filters: { coverage: string; brand: string; model: string; year: string }) {
  const params = new URLSearchParams();

  if (filters.coverage) params.set('coverage', filters.coverage);
  if (filters.brand) params.set('brand', filters.brand);
  if (filters.model) params.set('model', filters.model);
  if (filters.year) params.set('year', filters.year);

  const query = params.toString();
  return query ? `/line-app/search?${query}` : '/line-app/search';
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
    coverageType: row.coverageType?.trim() ?? '',
    coverageCode: row.coverageCode?.trim() ?? ''
  };
}

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

export default async function ComparePage({
  searchParams
}: {
  searchParams?: Promise<CompareSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const coverage = normalizeCoverageType(resolvedSearchParams.coverage);
  const brand = normalizeSearchValue(resolvedSearchParams.brand);
  const model = normalizeSearchValue(resolvedSearchParams.model);
  const year = normalizeSearchValue(resolvedSearchParams.year);
  const selectedIds = normalizeIdList(resolvedSearchParams.ids);

  const coverageTypeSql = buildCoverageTypeSql();
  const searchConditions: Prisma.Sql[] = [];

  if (coverage) {
    searchConditions.push(Prisma.sql`${coverageTypeSql} = ${coverage}`);
  }

  if (brand) {
    searchConditions.push(Prisma.sql`brand = ${brand}`);
  }

  if (model) {
    searchConditions.push(Prisma.sql`model = ${model}`);
  }

  if (year) {
    searchConditions.push(Prisma.sql`year = ${Number.parseInt(year, 10)}`);
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
      repairType,
      coverage,
      JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode,
      ${coverageTypeSql} AS coverageType,
      brand,
      model,
      year,
      fullPrice,
      netPrice,
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
        repairType,
        coverage,
        JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode,
        ${coverageTypeSql} AS coverageType,
        brand,
        model,
        year,
        fullPrice,
        netPrice,
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

  const searchSummary = buildSearchSummary({ coverage, brand, model, year });
  const searchHref = buildSearchHref({ coverage, brand, model, year });
  const resultsHref = buildResultsHref({ coverage, brand, model, year });
  const isComparisonReady = packages.length >= 2;

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/line-app/search" aria-label="กลับไปหน้า Search Premium" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>

          <h1 className="font-[Kanit,sans-serif] text-xl font-bold tracking-wide">Comparison Table</h1>
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
                {coverage ? <input type="hidden" name="coverage" value={coverage} /> : null}
                {brand ? <input type="hidden" name="brand" value={brand} /> : null}
                {model ? <input type="hidden" name="model" value={model} /> : null}
                {year ? <input type="hidden" name="year" value={year} /> : null}

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
                          <span className="font-semibold text-slate-900">{pkg.name}</span>
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
                              <img src={pkg.logoUrl} alt={pkg.company} className="h-full w-full rounded-full object-contain p-1" />
                            ) : (
                              'LOGO'
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4c6394]">{pkg.company}</p>
                            <h3 className="mt-1 font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#0047BA]">{pkg.name}</h3>
                            <p className="mt-2 text-sm font-semibold text-[#0f4ec7]">{getCoverageLabel(pkg.coverageType || coverage || '')}</p>
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
                    { label: 'ปี', values: packages.map((pkg) => (pkg.year ? String(pkg.year) : '-')) },
                    { label: 'ประเภทซ่อม', values: packages.map((pkg) => pkg.repairType || '-') },
                    { label: 'ความคุ้มครอง', values: packages.map((pkg) => pkg.coverage || '-') },
                    { label: 'ราคาตลาดทั่วไป', values: packages.map((pkg) => `${formatMoney(pkg.fullPrice)} บาท`) },
                    { label: 'เบี้ยประกันราคาทุน', values: packages.map((pkg) => `${formatMoney(pkg.netPrice)} บาท`) },
                    { label: 'ส่วนลด', values: packages.map((pkg) => `${formatMoney(pkg.discount)} บาท`) },
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
