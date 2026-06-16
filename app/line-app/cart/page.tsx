import Link from 'next/link';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCustomerCtpOptionsBySClass } from '@/lib/ctp-rates';
import CloseLineMenuButton from '../_components/close-line-menu-button';
import { CartCompareSelector, CartPlanActions, CartStorageHydrator, ClearCartButton, RemoveCartPackageButton } from './cart-actions';

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
  uom1V: string | null;
  uom2V: string | null;
  uom5V: string | null;
  seats41: string | null;
  mv411: string | null;
  mv412: string | null;
  mv42: string | null;
  mv43: string | null;
  dedod: string | null;
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
  return value.toLocaleString('th-TH');
}

function formatCoverageMoney(value: number) {
  return value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function parseNumber(value: unknown) {
  if (value == null) {
    return null;
  }

  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCoverageAmount(value: unknown, unit: string, zeroLabel = '-') {
  const parsed = parseNumber(value);

  if (parsed == null) {
    return '-';
  }

  if (parsed === 0) {
    return zeroLabel;
  }

  return `${formatCoverageMoney(parsed)} ${unit}`;
}

function formatSeatText(value: unknown, offset = 0) {
  const parsed = parseNumber(value);

  if (parsed == null) {
    return '';
  }

  const seatCount = Math.max(parsed - offset, 0);
  return ` (จำนวน ${formatCoverageMoney(seatCount)} คน)`;
}

function getCoverageLabel(value: string | null | undefined) {
  if (value === '1') return 'ประเภท 1';
  if (value === '2+') return 'ประเภท 2 พลัส';
  if (value === '3+') return 'ประเภท 3 พลัส';
  if (value === '3') return 'ประเภท 3';
  return value || '-';
}

function getCoverageGroup(pkg: Pick<CartPackageRow, 'coverageType' | 'coverageCode'>) {
  const values = [pkg.coverageType, pkg.coverageCode].map((value) => value?.trim()).filter(Boolean);
  const normalized = values.join(' ').toLowerCase();

  if (values.includes('2+') || normalized.includes('2 พลัส') || normalized.includes('2 plus') || normalized.includes('2+')) {
    return '2+';
  }

  if (values.includes('3+') || normalized.includes('3 พลัส') || normalized.includes('3 plus') || normalized.includes('3+')) {
    return '3+';
  }

  if (values.includes('3') || normalized.includes('ประเภท 3') || normalized === '3') {
    return '3';
  }

  if (values.includes('1') || normalized.includes('ประเภท 1')) {
    return '1';
  }

  return pkg.coverageType?.trim() || '';
}

function buildCoverageDetailRows(pkg: CartPackageRow, coverageGroup: string, selectedSumInsuredLabel: string) {
  const isTypeThreePlus = coverageGroup === '3+';
  const isTypeThree = coverageGroup === '3';
  const ownDamageLabel = isTypeThree
    ? '3.1 ความคุ้มครองความเสียหายต่อรถยนต์'
    : '3.1 ความคุ้มครองความเสียหายต่อรถยนต์ เนื่องจากการชนกับพาหนะทางบก(ร.ย.ภ.10)';
  const lostFireLabel = '3.2 รถยนต์ สูญหาย/ไฟไหม้';
  const lostFireValue = isTypeThreePlus || isTypeThree ? 'ไม่คุ้มครอง' : selectedSumInsuredLabel;
  const ownDamageValue = isTypeThree ? 'ไม่คุ้มครอง' : selectedSumInsuredLabel;

  return [
    { kind: 'heading' as const, label: 'ความรับผิดต่อบุคคลภายนอก' },
    {
      kind: 'row' as const,
      label: '1) ความเสียหายต่อชีวิต ร่างกาย หรืออนามัย',
      value: formatCoverageAmount(pkg.uom1V, 'บาท/คน')
    },
    {
      kind: 'row' as const,
      label: 'เฉพาะส่วนเกินวงเงินสูงสุดตาม พรบ.',
      value: formatCoverageAmount(pkg.uom2V, 'บาท/ครั้ง')
    },
    {
      kind: 'row' as const,
      label: '2) ความเสียหายต่อทรัพย์สิน',
      value: formatCoverageAmount(pkg.uom5V, 'บาท/ครั้ง')
    },
    { kind: 'row' as const, label: 'ความเสียหายส่วนแรก', value: 'ไม่มี' },
    { kind: 'row' as const, label: ownDamageLabel, value: ownDamageValue },
    {
      kind: 'row' as const,
      label: 'ความเสียหายส่วนแรก',
      value: formatCoverageAmount(pkg.dedod, 'บาท/ครั้ง', 'ไม่มี')
    },
    { kind: 'row' as const, label: lostFireLabel, value: lostFireValue },
    { kind: 'heading' as const, label: 'ความคุ้มครองตามเอกสารแนบท้าย' },
    { kind: 'subheading' as const, label: '4.1 อุบัติเหตุส่วนบุคคล' },
    { kind: 'subheading' as const, label: 'เสียชีวิต สูญเสียอวัยวะ ทุพพลภาพถาวร' },
    {
      kind: 'row' as const,
      label: 'คุ้มครองผู้ขับขี่ 1 คน',
      value: formatCoverageAmount(pkg.mv411, 'บาท/คน')
    },
    {
      kind: 'row' as const,
      label: `ผู้โดยสาร${formatSeatText(pkg.seats41, 1)}`,
      value: formatCoverageAmount(pkg.mv412, 'บาท/คน')
    },
    {
      kind: 'row' as const,
      label: `4.2 ค่ารักษาพยาบาล${formatSeatText(pkg.seats41)}`,
      value: formatCoverageAmount(pkg.mv42, 'บาท/คน')
    },
    {
      kind: 'row' as const,
      label: '4.3 การประกันตัวผู้ขับขี่',
      value: formatCoverageAmount(pkg.mv43, 'บาท/ครั้ง')
    }
  ];
}

function getSClassLabel(value: string | null | undefined) {
  if (value === '110') return 'รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู';
  if (value === '320') return 'รถกระบะ 2 ประตู';
  if (value === '210') return 'รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า';
  return value || '-';
}

function getSClassShortLabel(value: string | null | undefined) {
  return value?.trim() ? `รหัส ${value.trim()}` : '-';
}

function getDeductibleLabel(coverageCode: string | null | undefined) {
  const normalized = coverageCode?.trim();

  if (normalized === '2.2' || normalized === '3.2') {
    return 'ไม่มี';
  }

  if (normalized === '2.1' || normalized === '3.1') {
    return 'มี';
  }

  return '-';
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function formatSumInsuredRange(min: unknown, max: unknown) {
  const minValue = min == null ? null : toNumber(min);
  const maxValue = max == null ? null : toNumber(max);
  const hasMin = minValue !== null && Number.isFinite(minValue);
  const hasMax = maxValue !== null && Number.isFinite(maxValue);

  if (minValue === 0 && maxValue === 0) {
    return 'ไม่คุ้มครอง';
  }

  if (!hasMin && !hasMax) {
    return '-';
  }

  if (hasMin && hasMax && minValue !== maxValue) {
    return `${minValue.toLocaleString('th-TH')}-${maxValue.toLocaleString('th-TH')} บาท`;
  }

  return `${(hasMin ? minValue : maxValue ?? 0).toLocaleString('th-TH')} บาท`;
}

function encodeLogoUrl(logoUrl: string) {
  return logoUrl
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

function DetailIcon({
  icon,
  tone
}: {
  icon: 'car' | 'shield' | 'money' | 'star' | 'wrench' | 'tag' | 'ctp';
  tone: 'blue' | 'indigo' | 'green' | 'amber' | 'slate' | 'orange';
}) {
  const toneClass = {
    blue: 'text-[#0052CC]',
    indigo: 'text-[#364fc7]',
    green: 'text-[#16803c]',
    amber: 'text-[#c48a00]',
    slate: 'text-[#445066]',
    orange: 'text-[#bf5b00]'
  }[tone];

  const icons = {
    car: (
      <>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15h2l1.7-4.2A3 3 0 0 1 9.5 9h4.8a3 3 0 0 1 2.4 1.2L20 14h1v4h-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 18H3v-3h18M8 18h8M8.2 9l-1.4 4H12V9M12 9v4h6.4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </>
    ),
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l6 2v5c0 4-2.4 7-6 9-3.6-2-6-5-6-9V6l6-2Zm0 4v7m-3.2-3.2L12 15l3.2-3.2" />,
    money: <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14v10H5V7Zm3 3h.01M16 14h.01M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 4Z" />,
    wrench: <path strokeLinecap="round" strokeLinejoin="round" d="M15.7 5.3a4 4 0 0 0 3 5.4l-7.9 7.9a2 2 0 0 1-2.8 0l-2.6-2.6a2 2 0 0 1 0-2.8l7.9-7.9a4 4 0 0 0 2.4 0ZM7.5 14.5l2 2" />,
    tag: <path strokeLinecap="round" strokeLinejoin="round" d="M4 11V5h6l9 9-6 6-9-9Zm4-3h.01" />,
    ctp: <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h8l2 2v12H7V5Zm8 0v3h3M9 12h6M9 15h4" />
  }[icon];

  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${toneClass}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        {icons}
      </svg>
    </span>
  );
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
      WHEN UPPER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.GarageCd')), ''))) IN ('G', 'DG')
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

function buildCompareHrefWithIds(baseParams: URLSearchParams, ids: string[], ctpIds: string[]) {
  const params = new URLSearchParams(baseParams);
  ids.slice(0, 2).forEach((id) => params.append('ids', id));
  ctpIds.filter((id) => ids.slice(0, 2).includes(id)).forEach((id) => params.append('ctpIds', id));

  const query = params.toString();
  return query ? `/line-app/compare?${query}` : '/line-app/compare';
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
        payablePrice,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom1_v'), JSON_EXTRACT(rawData, '$.UOM1_V'))) AS uom1V,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom2_v'), JSON_EXTRACT(rawData, '$.UOM2_V'))) AS uom2V,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.uom5_v'), JSON_EXTRACT(rawData, '$.UOM5_V'))) AS uom5V,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.Seats41'), JSON_EXTRACT(rawData, '$.seats41'))) AS seats41,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv411'), JSON_EXTRACT(rawData, '$.MV411'))) AS mv411,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv412'), JSON_EXTRACT(rawData, '$.MV412'))) AS mv412,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv42'), JSON_EXTRACT(rawData, '$.MV42'))) AS mv42,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.mv43'), JSON_EXTRACT(rawData, '$.MV43'))) AS mv43,
        JSON_UNQUOTE(COALESCE(JSON_EXTRACT(rawData, '$.Dedod'), JSON_EXTRACT(rawData, '$.dedod'))) AS dedod
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
  const compareIds: string[] = [];
  const compareCtpIds: string[] = [];
  const backHref = packages.length > 0 ? resultsHref : '/line-app/search';

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto grid max-w-md grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-3">
          <Link href={backHref} aria-label="กลับไปหน้าก่อนหน้า" className="rounded-full p-1.5 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="min-w-0 text-center font-[Kanit,sans-serif] text-xl font-bold tracking-wide">รายการในตะกร้า</h1>
          <CloseLineMenuButton label="กลับไปเมนู" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-6">
        <CartStorageHydrator showLoading={selectedIds.length === 0} />

        <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <div>
            <div>
              <p className="text-sm font-medium text-[#4b5265]">แผนที่เก็บไว้</p>
              <h2 className="mt-1 font-[Kanit,sans-serif] text-2xl font-bold text-[#0047BA]">{packages.length} แผน</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#4b5265]">รายการนี้เป็นแผนที่เก็บไว้ดูภายหลัง ยังไม่สร้างคำสั่งซื้อจนกว่าจะกดเลือกแผน</p>
        </section>

        {packages.length >= 2 ? (
          <CartCompareSelector
            baseQueryString={baseParams.toString()}
            selectedCtpIds={selectedCtpIds}
            packages={packages.map((pkg) => ({
              id: pkg.id,
              title: [pkg.brand, pkg.model, normalizeSearchValue(resolvedSearchParams.year)].filter(Boolean).join(' · ') || pkg.company,
              subtitle: [getCoverageLabel(pkg.coverageType), getText(pkg.repairType, 'อู่ประกัน'), formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured)]
                .filter(Boolean)
                .join(' · ')
            }))}
          />
        ) : null}

        {packages.length === 0 ? (
          <section className="rounded-3xl bg-white p-6 text-center shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
            <h2 className="font-[Kanit,sans-serif] text-xl font-bold text-[#0047BA]">ยังไม่มีรายการในตะกร้า</h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5265]">กลับไปหน้าผลลัพธ์แล้วกด “เก็บใส่ตะกร้า” ในแผนที่ต้องการ</p>
            <Link href="/line-app/search" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#0047BA] px-4 py-4 font-semibold text-white transition hover:bg-[#003c9d]">
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
              const deductibleLabel = getDeductibleLabel(pkg.coverageCode);
              const coverageGroup = getCoverageGroup(pkg);
              const selectedSumInsuredLabel = formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured);
              const coverageDetailRows = buildCoverageDetailRows(pkg, coverageGroup, selectedSumInsuredLabel);

              return (
                <article key={pkg.id} className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] ring-1 ring-white/70">
                  <div className="relative p-2.5">
                    <div className="relative mb-2.5 flex items-start gap-2">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[rgba(195,198,214,0.35)] bg-[#eef3ff] shadow-sm">
                      {pkg.logoUrl ? (
                        <img src={encodeLogoUrl(pkg.logoUrl)} alt={pkg.company} className="h-full w-full object-contain p-1" />
                      ) : (
                        <span className="px-1 text-center text-xs font-bold leading-4 text-[#0052CC]">{pkg.company.slice(0, 6)}</span>
                      )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="break-words pr-14 text-[13px] leading-4 text-[#434654]">{pkg.company}</p>
                          <RemoveCartPackageButton href={buildCartHrefWithIds(baseParams, remainingIds, remainingCtpIds)} remainingIds={remainingIds} remainingCtpIds={remainingCtpIds} />
                        </div>
                      </div>
                    </div>

                  <p className="mb-2.5 break-words font-[Kanit,sans-serif] text-[15px] font-bold leading-tight text-[#0052CC]">
                    {[pkg.brand, pkg.model, normalizeSearchValue(resolvedSearchParams.year)].filter(Boolean).join(' · ') || '-'}
                  </p>

                  <div className="mb-2.5 overflow-hidden rounded-xl border border-[#dfe4ef] bg-white shadow-[0_6px_18px_rgba(15,32,67,0.06)]">
                    <div className="space-y-2 p-3 text-[13px] text-[#2f3545]">
                      <div className="flex items-start gap-2">
                        <DetailIcon icon="car" tone="blue" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-[#1f2a44]">{getSClassShortLabel(pkg.sClass)}</span>
                            <span className="text-right leading-5">{getSClassLabel(pkg.sClass)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DetailIcon icon="shield" tone="indigo" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium text-[#4b5265]">ประเภท</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{getCoverageLabel(pkg.coverageType)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DetailIcon icon="money" tone="green" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium text-[#4b5265]">ทุนประกัน</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DetailIcon icon="star" tone="amber" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium text-[#4b5265]">ความเสียหายส่วนแรก</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{deductibleLabel}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <DetailIcon icon="wrench" tone="slate" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium text-[#4b5265]">ประเภทการซ่อม</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{getText(pkg.repairType, 'อู่ประกัน')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2.5 overflow-hidden rounded-xl bg-[#eef1f4] shadow-[0_8px_22px_rgba(15,32,67,0.08)]">
                    <div className="border-b border-[#d8dde7] px-3 py-2">
                      <h3 className="font-[Kanit,sans-serif] text-base font-bold text-[#1f2a44]">สรุปค่าใช้จ่าย</h3>
                    </div>

                    <div className="space-y-2 px-3 py-3 text-[13px] text-[#2f3545]">
                      <div className="flex items-center gap-2">
                        <DetailIcon icon="tag" tone="orange" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium">เบี้ยประกัน</span>
                          <span className="text-right font-semibold">{formatMoney(toNumber(pkg.netPrice))} บาท</span>
                        </div>
                      </div>

                      {ctpOption ? (
                        <div className="flex items-center gap-2">
                          <DetailIcon icon="ctp" tone="blue" />
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                            <span className="font-medium">พ.ร.บ. เพิ่มเติม</span>
                            <span className="text-right font-semibold">{formatMoney(ctpOption.total)} บาท</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-[#d8dde7] px-3 py-2 text-base font-bold text-[#1f2a44]">
                      <span>รวม</span>
                      <span>{formatMoney(premiumTotal)} บาท</span>
                    </div>
                  </div>

                  <div className="mb-2.5 rounded-xl border border-[#d6c27a] bg-[#fffdf4] px-3 py-2.5 shadow-[0_8px_20px_rgba(154,118,20,0.10)]">
                    <p className="text-sm font-semibold text-[#4b3a0b]">คงเหลือชำระ</p>
                    <p className="mt-0.5 font-[Kanit,sans-serif] text-2xl font-bold leading-tight text-[#111827]">{formatMoney(payableTotal)} บาท</p>
                  </div>

                  <CartPlanActions formHref={buildFormHref(baseParams, pkg.id, Boolean(ctpOption))} coverageDetailRows={coverageDetailRows} />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Link href={backHref} className="rounded-2xl bg-[#0047BA] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#003c9d]">
            กลับไปเลือกแผน
          </Link>
          {compareIds.length >= 2 ? (
            <Link
              href={buildCompareHrefWithIds(baseParams, compareIds, compareCtpIds)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[#0047BA] shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-blue-100 transition hover:bg-[#eef3ff]"
            >
              ดูเปรียบเทียบ
            </Link>
          ) : null}
          {packages.length > 0 ? <ClearCartButton /> : null}
        </div>
      </div>
    </main>
  );
}
