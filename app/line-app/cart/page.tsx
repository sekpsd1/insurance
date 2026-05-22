import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCustomerCtpOptionsBySClass } from '@/lib/ctp-rates';
import { ClearCartButton, RemoveCartPackageButton } from './cart-actions';

type CartSearchParams = {
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

type CartPackageRow = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  details: string | null;
  repairType: string | null;
  coverageCode: string | null;
  coverageType: string | null;
  sClass: string | null;
  minSumInsured: number | null;
  maxSumInsured: number | null;
  brand: string | null;
  model: string | null;
  netPrice: number;
  payablePrice: number | null;
};

const MAX_CART_PACKAGES = 30;

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function normalizeIdList(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value : normalizeSearchValue(value) ? [normalizeSearchValue(value)] : [];

  const values = rawValue
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(values)).slice(0, MAX_CART_PACKAGES);
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

function formatMoney(value: number) {
  return value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getCoverageLabel(value: string | null | undefined) {
  if (value === '1') return 'ประเภท 1';
  if (value === '2+') return 'ประเภท 2 พลัส';
  if (value === '3+') return 'ประเภท 3 พลัส';
  if (value === '3') return 'ประเภท 3';
  return value || '-';
}

function getSClassLabel(value: string | null | undefined) {
  if (value === '110') return 'รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู';
  if (value === '320') return 'รถกระบะ 2 ประตู';
  if (value === '210') return 'รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า';
  return value || '-';
}

function formatSumInsuredRange(min: number | null | undefined, max: number | null | undefined) {
  if (min === 0 && max === 0) {
    return 'ไม่มีทุนประกัน';
  }

  if (!min && !max) {
    return '-';
  }

  if (min && max && min !== max) {
    return `${min.toLocaleString('th-TH')}-${max.toLocaleString('th-TH')} บาท`;
  }

  return `${(min ?? max ?? 0).toLocaleString('th-TH')} บาท`;
}

function encodeLogoUrl(logoUrl: string) {
  return logoUrl
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
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

function buildBaseParams(filters: Omit<CartSearchParams, 'ids' | 'ctpIds'>) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    const normalized = normalizeSearchValue(value);
    if (normalized) {
      params.set(key, normalized);
    }
  });

  return params;
}

function buildResultsHref(baseParams: URLSearchParams) {
  const query = baseParams.toString();
  return query ? `/line-app?${query}` : '/line-app/search';
}

function buildCartHrefWithIds(baseParams: URLSearchParams, ids: string[], ctpIds: string[]) {
  const params = new URLSearchParams(baseParams);
  ids.forEach((id) => params.append('ids', id));
  ctpIds.forEach((id) => params.append('ctpIds', id));

  const query = params.toString();
  return query ? `/line-app/cart?${query}` : '/line-app/cart';
}

function buildFormHref(baseParams: URLSearchParams, id: string, includeCtp: boolean) {
  const params = new URLSearchParams(baseParams);

  if (includeCtp) {
    params.set('includeCtp', '1');
  } else {
    params.delete('includeCtp');
  }

  const query = params.toString();
  return query ? `/line-app/form/${id}?${query}` : `/line-app/form/${id}`;
}

export default async function CartPage({
  searchParams
}: {
  searchParams?: Promise<CartSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedIds = normalizeIdList(resolvedSearchParams.ids);
  const selectedCtpIds = normalizeIdList(resolvedSearchParams.ctpIds);
  const selectedCtpIdSet = new Set(selectedCtpIds);
  const baseParams = buildBaseParams({
    sClass: resolvedSearchParams.sClass,
    coverage: resolvedSearchParams.coverage,
    repairType: resolvedSearchParams.repairType,
    brand: resolvedSearchParams.brand,
    model: resolvedSearchParams.model,
    year: resolvedSearchParams.year,
    cubicCapacity: resolvedSearchParams.cubicCapacity,
    sumInsured: resolvedSearchParams.sumInsured
  });
  const resultsHref = buildResultsHref(baseParams);
  const coverageTypeSql = buildCoverageTypeSql();
  const repairTypeSql = buildRepairTypeSql();

  const rows = selectedIds.length > 0
    ? await prisma.$queryRaw<CartPackageRow[]>`
      SELECT
        id,
        name,
        company,
        logoUrl,
        details,
        CASE WHEN ${repairTypeSql} = 'dealer' THEN 'ซ่อมห้าง' ELSE 'ซ่อมอู่' END AS repairType,
        JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.covcod')) AS coverageCode,
        ${coverageTypeSql} AS coverageType,
        COALESCE(sClass, JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.SClass'))) AS sClass,
        COALESCE(minSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MinSI')), '') AS UNSIGNED)) AS minSumInsured,
        COALESCE(maxSumInsured, CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.MaxSI')), '') AS UNSIGNED)) AS maxSumInsured,
        brand,
        model,
        netPrice,
        payablePrice
      FROM InsurancePackage
      WHERE id IN (${Prisma.join(selectedIds.map((id) => Prisma.sql`${id}`))})
      ORDER BY createdAt DESC, id DESC
    `
    : [];

  const ctpOptionsBySClass = await getCustomerCtpOptionsBySClass();
  const packageById = new Map(rows.map((row) => [row.id, row]));
  const packages = selectedIds
    .map((id) => packageById.get(id))
    .filter((row): row is CartPackageRow => Boolean(row));
  const totalPayablePrice = packages.reduce((sum, pkg) => {
    const ctpOption = selectedCtpIdSet.has(pkg.id) && pkg.sClass ? ctpOptionsBySClass[pkg.sClass] ?? null : null;
    return sum + toNumber(pkg.payablePrice ?? pkg.netPrice) + (ctpOption?.total ?? 0);
  }, 0);

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <Link href={resultsHref} aria-label="กลับไปหน้าผลลัพธ์" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="font-[Kanit,sans-serif] text-xl font-bold tracking-wide">รายการในตะกร้า</h1>
          <div className="h-9 w-9" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#4b5265]">แผนที่เก็บไว้</p>
              <h2 className="mt-1 font-[Kanit,sans-serif] text-2xl font-bold text-[#0047BA]">{packages.length} แผน</h2>
            </div>
            <div className="rounded-2xl bg-[#eef3ff] px-4 py-3 text-right">
              <p className="text-xs font-medium text-[#4b5265]">คงเหลือชำระรวม</p>
              <p className="mt-1 font-[Kanit,sans-serif] text-lg font-bold text-[#0047BA]">{formatMoney(totalPayablePrice)} บาท</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#4b5265]">รายการนี้เป็นแผนที่เก็บไว้ดูภายหลัง ยังไม่สร้างคำสั่งซื้อจนกว่าจะกดเลือกแผน</p>
        </section>

        {packages.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
            <h2 className="font-[Kanit,sans-serif] text-xl font-bold text-[#0047BA]">ยังไม่มีรายการในตะกร้า</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5265]">กลับไปหน้าผลลัพธ์แล้วกด “เก็บใส่ตะกร้า” ในแผนที่ต้องการ</p>
            <Link href={resultsHref} className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#0047BA] px-4 py-4 font-semibold text-white transition hover:bg-[#003c9d]">
              กลับไปเลือกแผน
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {packages.map((pkg) => {
              const remainingIds = packages.filter((item) => item.id !== pkg.id).map((item) => item.id);
              const remainingIdSet = new Set(remainingIds);
              const remainingCtpIds = selectedCtpIds.filter((id) => remainingIdSet.has(id));
              const ctpOption = selectedCtpIdSet.has(pkg.id) && pkg.sClass ? ctpOptionsBySClass[pkg.sClass] ?? null : null;
              const ctpTotal = ctpOption?.total ?? 0;
              const premiumTotal = toNumber(pkg.netPrice) + ctpTotal;
              const payableTotal = toNumber(pkg.payablePrice ?? pkg.netPrice) + ctpTotal;

              return (
                <article key={pkg.id} className="overflow-hidden rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(195,198,214,0.35)] bg-[#eef3ff] shadow-sm">
                      {pkg.logoUrl ? (
                        <img src={encodeLogoUrl(pkg.logoUrl)} alt={pkg.company} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="px-1 text-center text-xs font-bold leading-4 text-[#0052CC]">{pkg.company.slice(0, 6)}</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[#434654]">{pkg.company}</p>
                        <RemoveCartPackageButton href={buildCartHrefWithIds(baseParams, remainingIds, remainingCtpIds)} remainingIds={remainingIds} remainingCtpIds={remainingCtpIds} />
                      </div>
                      <p className="mt-1 font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#0052CC]">
                        {[pkg.brand, pkg.model].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 rounded-2xl border border-[#dfe4ef] bg-white p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#4b5265]">ประเภทรถ</dt>
                      <dd className="text-right font-semibold text-[#1f2a44]">{getSClassLabel(pkg.sClass)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#4b5265]">ประเภท</dt>
                      <dd className="text-right font-semibold text-[#1f2a44]">{getCoverageLabel(pkg.coverageType)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#4b5265]">ทุนประกัน</dt>
                      <dd className="text-right font-semibold text-[#1f2a44]">{formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-[#4b5265]">ประเภทการซ่อม</dt>
                      <dd className="text-right font-semibold text-[#1f2a44]">{pkg.repairType || '-'}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-[#dfe4ef] pt-3">
                      <dt className="font-semibold text-[#1f2a44]">เบี้ยประกัน</dt>
                      <dd className="text-right font-[Kanit,sans-serif] text-lg font-bold text-[#0047BA]">{formatMoney(toNumber(pkg.netPrice))} บาท</dd>
                    </div>
                    {ctpOption ? (
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-[#1f2a44]">พ.ร.บ. เพิ่มเติม</dt>
                        <dd className="text-right font-[Kanit,sans-serif] text-lg font-bold text-[#0047BA]">{formatMoney(ctpOption.total)} บาท</dd>
                      </div>
                    ) : null}
                    {ctpOption ? (
                      <div className="flex justify-between gap-4">
                        <dt className="font-semibold text-[#1f2a44]">รวม</dt>
                        <dd className="text-right font-[Kanit,sans-serif] text-lg font-bold text-[#111827]">{formatMoney(premiumTotal)} บาท</dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-4">
                      <dt className="font-semibold text-[#4b3a0b]">คงเหลือชำระ</dt>
                      <dd className="text-right font-[Kanit,sans-serif] text-lg font-bold text-[#111827]">{formatMoney(payableTotal)} บาท</dd>
                    </div>
                  </dl>

                  <Link
                    href={buildFormHref(baseParams, pkg.id, Boolean(ctpOption))}
                    className="mt-4 flex w-full items-center justify-center gap-2 bg-[#0052CC] py-4 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
                  >
                    ดูรายละเอียด / เลือกแผนนี้
                    <span aria-hidden="true">→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={resultsHref} className="rounded-2xl bg-[#0047BA] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003c9d]">
            กลับไปเลือกแผน
          </Link>
          {packages.length > 0 ? <ClearCartButton href={resultsHref} /> : null}
        </div>
      </div>
    </main>
  );
}
