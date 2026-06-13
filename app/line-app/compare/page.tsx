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

const MAX_COMPARE_PACKAGES = 2;

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
    return 'ไม่คุ้มครอง';
  }

  return Number.isFinite(parsed) ? parsed.toLocaleString('th-TH') : value;
}

function isSeatBasedVehicleType(sClass: string | null | undefined) {
  return sClass === '210';
}

function formatCubicCapacity(value: string, sClass = '') {
  const parsed = Number.parseInt(value.replace(/,/g, ''), 10);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  if (isSeatBasedVehicleType(sClass)) {
    return `ไม่เกิน ${parsed.toLocaleString('th-TH')} ที่นั่ง`;
  }

  return `${parsed.toLocaleString('th-TH')} ซีซี`;
}

function formatVehicleSizeRange(pkg: Pick<ComparePackage, 'sClass' | 'minCubicCapacity' | 'maxCubicCapacity'>) {
  const minValue = pkg.minCubicCapacity ?? 0;
  const maxValue = pkg.maxCubicCapacity ?? minValue;

  if (!minValue && !maxValue) {
    return '-';
  }

  if (isSeatBasedVehicleType(pkg.sClass)) {
    if (minValue === 0) {
      return `ไม่เกิน ${formatMoney(maxValue)} ที่นั่ง`;
    }

    if (minValue === maxValue) {
      return `${formatMoney(minValue)} ที่นั่ง`;
    }

    return `${formatMoney(minValue)}-${formatMoney(maxValue)} ที่นั่ง`;
  }

  return `${formatMoney(minValue)}-${formatMoney(maxValue)} ซีซี`;
}

function buildSearchSummary(filters: { sClass: string; coverage: string; repairType: string; brand: string; model: string; year: string; cubicCapacity: string; sumInsured: string }) {
  return [
    filters.sClass ? getSClassLabel(filters.sClass) : '',
    filters.coverage ? getCoverageLabel(filters.coverage) : '',
    filters.repairType ? getRepairTypeLabel(filters.repairType) : '',
    filters.brand,
    filters.model,
    filters.year,
    filters.cubicCapacity ? formatCubicCapacity(filters.cubicCapacity, filters.sClass) : '',
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

function formatSumInsuredRange(min: unknown, max: unknown) {
  const minValue = parseNumber(min);
  const maxValue = parseNumber(max);
  const hasMin = minValue !== null;
  const hasMax = maxValue !== null;

  if (minValue === 0 && maxValue === 0) {
    return 'ไม่คุ้มครอง';
  }

  if (hasMin && hasMax) {
    if (minValue === maxValue) {
      return `${formatMoney(minValue)} บาท`;
    }

    return `${formatMoney(minValue)}-${formatMoney(maxValue)} บาท`;
  }

  if (hasMin) {
    return `${formatMoney(minValue)} บาท`;
  }

  if (hasMax) {
    return `${formatMoney(maxValue)} บาท`;
  }

  return '-';
}

function getCoverageGroup(pkg: Pick<ComparePackage, 'coverageType' | 'coverage' | 'coverageCode'>) {
  const values = [pkg.coverageType, pkg.coverage, pkg.coverageCode].map((value) => value?.trim()).filter(Boolean);
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

function getOwnDamageValue(pkg: ComparePackage) {
  const coverageGroup = getCoverageGroup(pkg);

  if (coverageGroup === '3') {
    return 'ไม่คุ้มครอง';
  }

  return formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured);
}

function getOwnDamageLabel(pkg: ComparePackage) {
  const coverageGroup = getCoverageGroup(pkg);

  if (coverageGroup === '3') {
    return '3.1 ความคุ้มครองความเสียหายต่อรถยนต์';
  }

  return '3.1 ความคุ้มครองความเสียหายต่อรถยนต์ เนื่องจากการชนกับพาหนะทางบก(ร.ย.ภ.10)';
}

function getLostFireValue(pkg: ComparePackage) {
  const coverageGroup = getCoverageGroup(pkg);

  if (coverageGroup === '3+' || coverageGroup === '3') {
    return 'ไม่คุ้มครอง';
  }

  return formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured);
}

function getSectionIcon(icon: string | undefined) {
  if (icon === 'person') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 0 0-16 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      </svg>
    );
  }

  if (icon === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      </svg>
    );
  }

  if (icon === 'people') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41 12 22l-9-9V4h9l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01" />
    </svg>
  );
}

function getComparisonCellClass(kind: string, index: number, value: string) {
  const isGreenColumn = index % 2 === 0;
  const accentTextClass = isGreenColumn ? 'text-[#087f3f]' : 'text-[#0052b8]';
  const accentBgClass = isGreenColumn ? 'bg-[#059447]' : 'bg-[#0076cf]';

  if (kind === 'section') {
    return 'bg-[#eaf5ff] font-semibold text-[#0047BA]';
  }

  if (kind === 'subsection') {
    return 'bg-white text-slate-500';
  }

  if (kind === 'total') {
    return `${accentBgClass} font-[Kanit,sans-serif] text-lg font-bold leading-tight text-white`;
  }

  if (kind === 'payable') {
    return `bg-white font-[Kanit,sans-serif] text-3xl font-semibold leading-tight ${isGreenColumn ? 'text-[#059447]' : 'text-[#0047BA]'}`;
  }

  if (value === 'ไม่มี' || value === 'ไม่คุ้มครอง') {
    return 'bg-white font-semibold text-[#b42318]';
  }

  return `bg-white font-semibold ${accentTextClass}`;
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

  return Math.max(new Date().getFullYear() - parsedYear + 1, 1);
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
      WHEN UPPER(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.GarageCd')), ''))) IN ('G', 'DG')
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
  const comparisonRows = [
    { kind: 'section', icon: 'person', label: 'ความรับผิดต่อบุคคลภายนอก', values: packages.map(() => '') },
    {
      kind: 'row',
      label: '1) ความเสียหายต่อชีวิต ร่างกาย หรืออนามัย / คน',
      values: packages.map((pkg) => formatCoverageAmount(pkg.uom1V, 'บาท/คน'))
    },
    {
      kind: 'row',
      label: 'เฉพาะส่วนเกินวงเงินสูงสุดตาม พ.ร.บ. / ครั้ง',
      values: packages.map((pkg) => formatCoverageAmount(pkg.uom2V, 'บาท/ครั้ง'))
    },
    {
      kind: 'row',
      label: '2) ความเสียหายต่อทรัพย์สินบุคคลภายนอก / ครั้ง',
      values: packages.map((pkg) => formatCoverageAmount(pkg.uom5V, 'บาท/ครั้ง'))
    },
    { kind: 'section', icon: 'shield', label: 'ความเสียหายต่อตัวรถยนต์', values: packages.map(() => '') },
    {
      kind: 'row',
      label: packages.every((pkg) => getCoverageGroup(pkg) === '3')
        ? '3.1 ความคุ้มครองความเสียหายต่อรถยนต์'
        : '3.1 ความคุ้มครองความเสียหายต่อรถยนต์ เนื่องจากการชนกับพาหนะทางบก(ร.ย.ภ.10)',
      labels: packages.map((pkg) => getOwnDamageLabel(pkg)),
      values: packages.map((pkg) => getOwnDamageValue(pkg))
    },
    {
      kind: 'row',
      label: 'ความเสียหายส่วนแรก',
      values: packages.map((pkg) => formatCoverageAmount(pkg.dedod, 'บาท/ครั้ง', 'ไม่มี'))
    },
    {
      kind: 'row',
      label: '3.2 รถยนต์สูญหาย/ไฟไหม้',
      values: packages.map((pkg) => getLostFireValue(pkg))
    },
    { kind: 'section', icon: 'people', label: 'ความคุ้มครองตามเอกสารแนบท้าย', values: packages.map(() => '') },
    { kind: 'subsection', label: '4.1 อุบัติเหตุส่วนบุคคล เสียชีวิต สูญเสียอวัยวะ ทุพพลภาพถาวร', values: packages.map(() => '') },
    {
      kind: 'row',
      label: 'คุ้มครองผู้ขับขี่ 1 คน',
      values: packages.map((pkg) => formatCoverageAmount(pkg.mv411, 'บาท/คน'))
    },
    {
      kind: 'row',
      label: `ผู้โดยสาร${formatSeatText(packages[0]?.seats41, 1)}`,
      values: packages.map((pkg) => formatCoverageAmount(pkg.mv412, 'บาท/คน'))
    },
    {
      kind: 'row',
      label: `4.2 ค่ารักษาพยาบาล${formatSeatText(packages[0]?.seats41)}`,
      values: packages.map((pkg) => formatCoverageAmount(pkg.mv42, 'บาท/คน'))
    },
    {
      kind: 'row',
      label: '4.3 การประกันตัวผู้ขับขี่',
      values: packages.map((pkg) => formatCoverageAmount(pkg.mv43, 'บาท/ครั้ง'))
    },
    { kind: 'section', icon: 'price', label: 'เบี้ยประกัน', values: packages.map(() => '') },
    {
      kind: 'row',
      label: 'เบี้ยประกัน',
      values: packages.map((pkg) => `${formatMoney(pkg.netPrice)} บาท`)
    },
    {
      kind: 'row',
      label: 'พ.ร.บ.',
      values: packages.map((pkg) => {
        const ctpOption = ctpOptionByPackageId.get(pkg.id);
        return ctpOption ? `${formatMoney(ctpOption.total)} บาท` : '-';
      })
    },
    {
      kind: 'total',
      label: 'รวม',
      values: packages.map((pkg) => {
        const ctpOption = ctpOptionByPackageId.get(pkg.id);
        return `${formatMoney(pkg.netPrice + (ctpOption?.total ?? 0))} บาท`;
      })
    },
    {
      kind: 'payable',
      label: 'คงเหลือชำระ',
      values: packages.map((pkg) => {
        const ctpOption = ctpOptionByPackageId.get(pkg.id);
        return `${formatMoney((pkg.payablePrice ?? pkg.netPrice) + (ctpOption?.total ?? 0))} บาท`;
      })
    }
  ];

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-50 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
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
        {isComparisonReady ? (
          <section className="space-y-1 px-1">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="whitespace-nowrap font-[Kanit,sans-serif] text-[24px] font-bold leading-tight text-[#081833] sm:text-2xl">เปรียบเทียบความคุ้มครอง</p>
                {searchSummary ? (
                  <p className="mt-1 text-sm font-medium leading-6 text-[#4b5265]">{searchSummary}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0047BA] shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-[#cfd8ff]">
                {packages.length} แผน
              </span>
            </div>
          </section>
        ) : (
          <>
            {searchSummary ? (
              <section className="rounded-3xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
                ผลลัพธ์สำหรับ: <span className="font-semibold">{searchSummary}</span>
              </section>
            ) : null}

            <section className="rounded-2xl bg-white px-4 py-3 text-sm text-[#434654] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
              เลือกอย่างน้อย 2 แผนเพื่อดูตารางเปรียบเทียบ
            </section>
          </>
        )}

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
            <div className="md:hidden">
              <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
                {packages.map((pkg) => {
                  const ctpOption = ctpOptionByPackageId.get(pkg.id);
                  const payableAmount = (pkg.payablePrice ?? pkg.netPrice) + (ctpOption?.total ?? 0);

                  return (
                    <div key={pkg.id} className="min-w-0 p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eef3ff] ring-1 ring-[#d9e3ff]">
                          {pkg.logoUrl ? (
                            <img src={encodeLogoUrl(pkg.logoUrl)} alt={pkg.company} className="h-full w-full object-contain" />
                          ) : (
                            <span className="px-1 text-center text-[10px] font-bold leading-3 text-[#0047BA]">{pkg.company}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-end">
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
                          <p className="mt-1 overflow-hidden break-words font-[Kanit,sans-serif] text-[11px] font-bold leading-4 text-[#00407f] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{pkg.company}</p>
                          <p className="mt-0.5 text-xs font-semibold leading-4 text-[#4b5265]">{getCoverageLabel(pkg.coverageType || coverage || '')}</p>
                          <p className="mt-1 inline-flex rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#0047BA]">{pkg.repairType || '-'}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl bg-[#004f9f] px-2 py-3 text-center text-white shadow-sm">
                        <p className="font-[Kanit,sans-serif] text-sm font-bold leading-5">คงเหลือชำระ</p>
                        <p className="mt-1 font-[Kanit,sans-serif] text-xl font-semibold leading-none">{formatMoney(payableAmount)} บาท</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                {comparisonRows.map((row) => {
                  if (row.kind === 'section') {
                    return (
                      <div key={`${row.kind}-${row.label}`} className="border-t border-slate-200 bg-[#f0f8ff] px-4 py-4 text-center">
                        <div className="mx-auto flex max-w-[280px] items-center justify-center gap-2 font-[Kanit,sans-serif] text-lg font-bold leading-6 text-[#004b8f]">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0076cf] text-white">
                            {getSectionIcon(row.icon)}
                          </span>
                          <span className="break-words">{row.label}</span>
                        </div>
                      </div>
                    );
                  }

                  if (row.kind === 'subsection') {
                    return (
                      <div key={`${row.kind}-${row.label}`} className="border-t border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#30384a]">
                        {row.label}
                      </div>
                    );
                  }

                  return (
                    <div key={`${row.kind}-${row.label}`} className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200">
                      {row.values.map((value, index) => (
                        <div
                          key={`${row.label}-${index}`}
                          className={`min-w-0 px-4 ${
                            row.kind === 'payable' ? 'py-4' : row.kind === 'total' ? 'py-3' : 'py-4'
                          } ${getComparisonCellClass(row.kind, index, String(value))}`}
                        >
                          <p
                            className={`break-words text-left ${
                              row.kind === 'total' || row.kind === 'payable'
                                ? 'font-[Kanit,sans-serif] text-base font-bold text-current'
                                : 'text-sm font-semibold leading-6 text-[#30384a]'
                            }`}
                          >
                            {'labels' in row && Array.isArray(row.labels) ? row.labels[index] : row.label}
                          </p>
                          <p
                            className={`mt-2 break-words ${
                              row.kind === 'payable'
                                ? 'font-[Kanit,sans-serif] text-2xl font-semibold leading-tight'
                                : row.kind === 'total'
                                  ? 'font-[Kanit,sans-serif] text-lg font-semibold leading-tight'
                                  : 'text-xl font-medium leading-tight'
                            }`}
                          >
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="min-w-[260px] rounded-tl-2xl bg-[#0047BA] px-4 py-4 text-center align-middle font-[Kanit,sans-serif] text-xl font-bold text-white">
                      <span className="flex min-h-[132px] items-center justify-center">ความคุ้มครอง</span>
                    </th>
                    {packages.map((pkg, index) => (
                      <th
                        key={pkg.id}
                        className={`min-w-[220px] border-l border-white/40 px-4 py-4 text-center align-top text-white ${
                          index % 2 === 0 ? 'bg-[#059447]' : 'bg-[#0076cf]'
                        } ${index === packages.length - 1 ? 'rounded-tr-2xl' : ''}`}
                      >
                        <div className="flex items-start justify-end">
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
                        <p className="mt-1 font-[Kanit,sans-serif] text-lg font-bold leading-tight">{getCoverageLabel(pkg.coverageType || coverage || '')}</p>
                        <p className="mx-auto mt-2 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#0047BA]">{pkg.repairType || '-'}</p>
                        <p className="mt-2 text-xs font-medium leading-5 text-white/90">{pkg.company}</p>
                        <div className="mt-3">
                          <CartPackageButton packageId={pkg.id} includeCtp={Boolean(ctpOptionByPackageId.get(pkg.id))} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label}>
                      <th
                        className={`border-t border-slate-200 px-4 text-sm ${
                          row.kind === 'section'
                            ? 'bg-[#eaf5ff] py-3 text-left font-[Kanit,sans-serif] font-bold text-[#0047BA]'
                            : row.kind === 'subsection'
                              ? 'bg-white py-3 text-left font-semibold text-slate-700'
                              : row.kind === 'payable'
                                ? 'bg-[#0047BA] py-5 text-center font-[Kanit,sans-serif] text-xl font-bold text-white'
                                : row.kind === 'total'
                                  ? 'bg-[#0047BA] py-5 text-center font-[Kanit,sans-serif] text-xl font-bold text-white'
                                : 'bg-white py-3 text-left font-semibold text-slate-700'
                        }`}
                        style={row.kind === 'total' || row.kind === 'payable' ? { textAlign: 'center' } : undefined}
                      >
                        {row.kind === 'section' ? (
                          <span className="flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0076cf] text-white">
                              {getSectionIcon(row.icon)}
                            </span>
                            <span>{row.label}</span>
                          </span>
                        ) : row.kind === 'total' || row.kind === 'payable' ? (
                          <span className="block w-full text-center">{row.label}</span>
                        ) : (
                          row.label
                        )}
                      </th>
                      {row.values.map((value, index) => (
                        <td
                          key={`${row.label}-${index}`}
                          className={`whitespace-nowrap border-t border-l border-slate-200 px-4 text-center leading-6 ${
                            row.kind === 'total' || row.kind === 'payable' ? 'py-5' : 'py-3 text-sm'
                          } ${getComparisonCellClass(row.kind, index, String(value))}`}
                        >
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
