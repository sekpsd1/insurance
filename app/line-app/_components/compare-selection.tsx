'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CtpOption } from '@/lib/ctp';

type ComparePackageCard = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
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
};

type CompareSelectionProps = {
  packages: ComparePackageCard[];
  ctpOptionsBySClass: Record<string, CtpOption>;
  baseQueryString: string;
  vehicleTypeLabel: string;
  registrationYear: string;
  cubicCapacityLabel: string;
  initialCtpPackageIds?: string[];
};

const CART_STORAGE_KEY = 'insurance.cartPackageIds';
const CART_CTP_STORAGE_KEY = 'insurance.cartCtpPackageIds';
const MAX_COMPARE_PACKAGES = 2;

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function getCoverageLabel(value: string) {
  if (value === '1') return 'ประเภท 1';
  if (value === '2+') return 'ประเภท 2 พลัส';
  if (value === '3+') return 'ประเภท 3 พลัส';
  if (value === '3') return 'ประเภท 3';
  return value;
}

function getCoverageGroup(pkg: Pick<ComparePackageCard, 'coverageType' | 'coverage' | 'coverageCode'>) {
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

function getSClassShortLabel(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();

  if (!normalized) {
    return fallback || '-';
  }

  return `รหัส ${normalized}`;
}

function formatSumInsuredRange(min: unknown, max: unknown) {
  const minValue = min == null ? null : Number(min);
  const maxValue = max == null ? null : Number(max);
  const hasMin = minValue !== null && Number.isFinite(minValue);
  const hasMax = maxValue !== null && Number.isFinite(maxValue);

  if (minValue === 0 && maxValue === 0) {
    return 'ไม่คุ้มครอง';
  }

  if (!hasMin && !hasMax) {
    return '-';
  }

  if (hasMin && hasMax && minValue !== maxValue) {
    return `${formatMoney(minValue)}-${formatMoney(maxValue)} บาท`;
  }

  return `${formatMoney(hasMin ? minValue : maxValue ?? 0)} บาท`;
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

  return `${formatMoney(parsed)} ${unit}`;
}

function formatSeatText(value: unknown, offset = 0) {
  const parsed = parseNumber(value);

  if (parsed == null) {
    return '';
  }

  const seatCount = Math.max(parsed - offset, 0);
  return ` (จำนวน ${formatMoney(seatCount)} คน)`;
}

function buildCoverageDetailRows(pkg: ComparePackageCard, coverageGroup: string, selectedSumInsuredLabel: string) {
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

function encodeLogoUrl(logoUrl: string) {
  return logoUrl
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

function DetailIcon({ icon, tone }: { icon: 'car' | 'shield' | 'money' | 'star' | 'wrench' | 'tag' | 'ctp'; tone: 'blue' | 'indigo' | 'green' | 'amber' | 'slate' | 'orange' }) {
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
    shield: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l6 2v5c0 4-2.4 7-6 9-3.6-2-6-5-6-9V6l6-2Zm0 4v7m-3.2-3.2L12 15l3.2-3.2" />
    ),
    money: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14v10H5V7Zm3 3h.01M16 14h.01M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" />
    ),
    star: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 4Z" />
    ),
    wrench: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.7 5.3a4 4 0 0 0 3 5.4l-7.9 7.9a2 2 0 0 1-2.8 0l-2.6-2.6a2 2 0 0 1 0-2.8l7.9-7.9a4 4 0 0 0 2.4 0ZM7.5 14.5l2 2" />
    ),
    tag: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11V5h6l9 9-6 6-9-9Zm4-3h.01" />
    ),
    ctp: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 5h8l2 2v12H7V5Zm8 0v3h3M9 12h6M9 15h4" />
    )
  }[icon];

  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${toneClass}`}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        {icons}
      </svg>
    </span>
  );
}

export default function CompareSelection({
  packages,
  ctpOptionsBySClass,
  baseQueryString,
  vehicleTypeLabel,
  registrationYear,
  cubicCapacityLabel,
  initialCtpPackageIds = []
}: CompareSelectionProps) {
  const router = useRouter();
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [ctpPackageIds, setCtpPackageIds] = useState<string[]>(() => initialCtpPackageIds);
  const [failedLogoIds, setFailedLogoIds] = useState<string[]>([]);
  const [expandedDetailIds, setExpandedDetailIds] = useState<string[]>([]);
  const [isCartStorageLoaded, setIsCartStorageLoaded] = useState(false);
  const selectedCount: number = 0;
  const error = '';

  const cartIdSet = useMemo(() => new Set(cartIds), [cartIds]);
  const ctpPackageIdSet = useMemo(() => new Set(ctpPackageIds), [ctpPackageIds]);
  const failedLogoIdSet = useMemo(() => new Set(failedLogoIds), [failedLogoIds]);
  const expandedDetailIdSet = useMemo(() => new Set(expandedDetailIds), [expandedDetailIds]);

  useEffect(() => {
    setCtpPackageIds((current) => Array.from(new Set([...current, ...initialCtpPackageIds])));
  }, [initialCtpPackageIds]);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      if (Array.isArray(parsed)) {
        setCartIds(parsed.filter((value): value is string => typeof value === 'string'));
      }

      const rawCtpValue = window.localStorage.getItem(CART_CTP_STORAGE_KEY);
      const parsedCtp = rawCtpValue ? JSON.parse(rawCtpValue) : [];
      if (Array.isArray(parsedCtp)) {
        const cartCtpIds = parsedCtp.filter((value): value is string => typeof value === 'string');
        setCtpPackageIds((current) => Array.from(new Set([...current, ...cartCtpIds])));
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      window.localStorage.removeItem(CART_CTP_STORAGE_KEY);
    }
    setIsCartStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!isCartStorageLoaded) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartIds));
    window.localStorage.setItem(CART_CTP_STORAGE_KEY, JSON.stringify(ctpPackageIds.filter((id) => cartIds.includes(id))));
  }, [cartIds, ctpPackageIds, isCartStorageLoaded]);

  function markLogoFailed(id: string) {
    setFailedLogoIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function clearCartSelection() {
    setCartIds([]);
    setCtpPackageIds([]);
  }

  function clearCompareSelection() {
    return undefined;
  }

  function toggleCart(id: string) {
    setCartIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleCtp(id: string) {
    setCtpPackageIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleDetails(id: string) {
    setExpandedDetailIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function buildFormHref(id: string, includeCtp: boolean) {
    const params = new URLSearchParams(baseQueryString);

    if (includeCtp) {
      params.set('includeCtp', '1');
    } else {
      params.delete('includeCtp');
    }

    const query = params.toString();
    return query ? `/line-app/form/${id}?${query}` : `/line-app/form/${id}`;
  }

  function handleCompare() {
    return undefined;
  }

  function handleCart() {
    const params = new URLSearchParams(baseQueryString);
    cartIds.forEach((id) => params.append('ids', id));
    ctpPackageIds.filter((id) => cartIds.includes(id)).forEach((id) => params.append('ctpIds', id));
    router.push(`/line-app/cart?${params.toString()}`);
  }

  return (
    <>
      <div className="space-y-3">
        {packages.map((pkg) => {
          const isInCart = cartIdSet.has(pkg.id);
          const ctpOption = pkg.sClass ? ctpOptionsBySClass[pkg.sClass] ?? null : null;
          const isCtpSelected = ctpPackageIdSet.has(pkg.id);
          const ctpTotal = isCtpSelected && ctpOption ? ctpOption.total : 0;
          const totalPrice = pkg.netPrice + ctpTotal;
          const payableTotal = (pkg.payablePrice ?? pkg.netPrice) + ctpTotal;
          const deductibleLabel = getDeductibleLabel(pkg.coverageCode);
          const isDetailsOpen = expandedDetailIdSet.has(pkg.id);
          const selectedSumInsuredLabel = formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured);
          const coverageGroup = getCoverageGroup(pkg);
          const coverageDetailRows = buildCoverageDetailRows(pkg, coverageGroup, selectedSumInsuredLabel);
          const isTypeTwoPlus = coverageGroup === '2+';
          const isTypeThreePlus = coverageGroup === '3+';
          const isTypeThree = coverageGroup === '3';

          return (
            <div
              key={pkg.id}
              className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)]"
            >
              <div className="relative p-2">
                <div className="relative mb-1.5 flex items-start gap-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[rgba(195,198,214,0.35)] bg-[#eef3ff] shadow-sm">
                    {pkg.logoUrl && !failedLogoIdSet.has(pkg.id) ? (
                      <img
                        src={encodeLogoUrl(pkg.logoUrl)}
                        alt={pkg.company}
                        onError={() => markLogoFailed(pkg.id)}
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <span className="px-1 text-center text-xs font-bold leading-4 text-[#0052CC]">
                        {pkg.company.slice(0, 6)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[12px] leading-4 text-[#434654]">{pkg.company}</p>
                  </div>

                </div>

                <p className="mb-1.5 break-words font-[Kanit,sans-serif] text-[13px] font-bold leading-tight text-[#0052CC]">
                  {[pkg.brand, pkg.model, registrationYear].filter(Boolean).join(' · ') || '-'}
                </p>

                <div className="mb-2 overflow-hidden rounded-xl border border-[#dfe4ef] bg-white shadow-[0_6px_18px_rgba(15,32,67,0.06)]">
                  <div className="space-y-1.5 p-2.5 text-[12px] text-[#2f3545]">
                    <div className="flex items-start gap-2">
                      <DetailIcon icon="car" tone="blue" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-[#1f2a44]">{getSClassShortLabel(pkg.sClass, vehicleTypeLabel)}</span>
                          <span className="text-right leading-5">{vehicleTypeLabel || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DetailIcon icon="shield" tone="indigo" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium text-[#4b5265]">ประเภท</span>
                        <span className="text-right font-semibold text-[#1f2a44]">{getCoverageLabel(pkg.coverageType || '')}</span>
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

                <div className="mb-2 overflow-hidden rounded-xl bg-[#eef1f4] shadow-[0_8px_22px_rgba(15,32,67,0.08)]">
                  <div className="border-b border-[#d8dde7] px-3 py-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-[Kanit,sans-serif] text-sm font-bold text-[#1f2a44]">สรุปค่าใช้จ่าย</h3>
                      {ctpOption ? (
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#1f2a44]">
                          <span>เพิ่ม พ.ร.บ.</span>
                          <input
                            type="checkbox"
                            checked={isCtpSelected}
                            onChange={() => toggleCtp(pkg.id)}
                            className="h-5 w-5 rounded border-slate-300 text-[#0052CC] focus:ring-[#0052CC]"
                          />
                        </label>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1.5 px-3 py-2 text-[12px] text-[#2f3545]">
                    <div className="flex items-center gap-2">
                      <DetailIcon icon="tag" tone="orange" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium">เบี้ยประกัน</span>
                        <span className="text-right font-semibold">{formatMoney(pkg.netPrice)} บาท</span>
                      </div>
                    </div>

                    {ctpOption ? (
                      <div className="flex items-center gap-2">
                        <DetailIcon icon="ctp" tone="blue" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium">พ.ร.บ. เพิ่มเติม</span>
                          <span className="text-right font-semibold">{isCtpSelected ? `${formatMoney(ctpOption.total)} บาท` : '-'}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[#d8dde7] px-3 py-1.5 text-sm font-bold text-[#1f2a44]">
                    <span>รวม</span>
                    <span>{formatMoney(totalPrice)} บาท</span>
                  </div>
                </div>

                <div className="mb-2 rounded-xl border border-[#d6c27a] bg-[#fffdf4] px-3 py-2 shadow-[0_8px_20px_rgba(154,118,20,0.10)]">
                  <p className="text-sm font-semibold text-[#4b3a0b]">คงเหลือชำระ</p>
                  <p className="mt-0.5 font-[Kanit,sans-serif] text-xl font-bold leading-tight text-[#111827]">{formatMoney(payableTotal)} บาท</p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleCart(pkg.id)}
                  aria-pressed={isInCart}
                  className={`mb-2 flex w-full items-center justify-center gap-2 border py-2.5 font-[Kanit,sans-serif] text-base font-semibold transition-colors ${
                    isInCart
                      ? 'border-[#0052CC] bg-[#eef3ff] text-[#0052CC]'
                      : 'border-[#0052CC] bg-white text-[#0052CC] hover:bg-[#eef3ff]'
                  }`}
                >
                  <span aria-hidden="true">{isInCart ? '✓' : '+'}</span>
                  {isInCart ? 'อยู่ในตะกร้าแล้ว' : 'เก็บใส่ตะกร้า'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDetails(pkg.id)}
                    aria-expanded={isDetailsOpen}
                    className="flex items-center justify-center border border-[#0052CC] bg-white py-3 font-[Kanit,sans-serif] text-base font-semibold text-[#0052CC] transition-colors hover:bg-[#eef3ff]"
                  >
                    ดูรายละเอียด
                  </button>
                  <a
                    href={buildFormHref(pkg.id, isCtpSelected)}
                    className="flex items-center justify-center gap-2 bg-[#0052CC] py-3 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
                  >
                    เลือกแผนนี้
                    <span aria-hidden="true" className="text-sm">→</span>
                  </a>
                </div>

                {isDetailsOpen ? (
                  <div className="mt-3 rounded-xl border border-[#dfe4ef] bg-[#f8faff] px-3 py-3 text-sm leading-6 text-[#4b5265]">
                    <div className="space-y-2">
                      {coverageDetailRows.map((row, index) => {
                        if (row.kind === 'heading') {
                          return (
                            <p key={`${row.label}-${index}`} className={index === 0 ? 'font-semibold text-[#0052CC]' : 'pt-2 font-semibold text-[#0052CC]'}>
                              {row.label}
                            </p>
                          );
                        }

                        if (row.kind === 'subheading') {
                          return (
                            <p key={`${row.label}-${index}`} className="text-xs font-semibold text-[#4b5265]">
                              {row.label}
                            </p>
                          );
                        }

                        return (
                          <div key={`${row.label}-${index}`} className="flex items-start justify-between gap-3">
                            <span className="font-medium text-[#1f2a44]">{row.label}</span>
                            <span className="shrink-0 text-right font-semibold text-[#1f2a44]">{row.value}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="hidden">
                    {isTypeTwoPlus ? (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">รถสูญหาย/ไฟไหม้</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{selectedSumInsuredLabel}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">ความเสียหายต่อตัวรถ</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{selectedSumInsuredLabel}</span>
                        </div>
                      </div>
                    ) : isTypeThreePlus ? (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">รถสูญหาย/ไฟไหม้</span>
                          <span className="text-right font-semibold text-[#1f2a44]">ไม่คุ้มครอง</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">ความเสียหายต่อตัวรถ</span>
                          <span className="text-right font-semibold text-[#1f2a44]">{selectedSumInsuredLabel}</span>
                        </div>
                      </div>
                    ) : isTypeThree ? (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">รถสูญหาย/ไฟไหม้</span>
                          <span className="text-right font-semibold text-[#1f2a44]">ไม่คุ้มครอง</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-[#1f2a44]">ความเสียหายต่อตัวรถ</span>
                          <span className="text-right font-semibold text-[#1f2a44]">ไม่คุ้มครอง</span>
                        </div>
                      </div>
                    ) : (
                      'รายละเอียดความคุ้มครองตามเงื่อนไขแผนที่เลือก'
                    )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {cartIds.length > 0 || selectedCount > 0 ? (
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-[#d8dcec] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(4,16,61,0.10)] backdrop-blur">
        {error ? <p className="mb-2 text-center text-xs font-medium text-red-600">{error}</p> : null}
        <p className="mb-2 text-center text-[11px] font-medium text-[#4b5265]">
          ถ้าต้องการเปรียบเทียบ ให้เลือกแผนใส่ตะกร้า
        </p>
        <div className={`grid gap-2 ${cartIds.length > 0 && selectedCount > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {cartIds.length > 0 ? (
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleCart}
                className="relative flex h-14 w-full flex-col items-center justify-center rounded-2xl bg-[#0047BA] px-2 text-center font-[Kanit,sans-serif] text-sm font-semibold leading-tight text-white transition hover:bg-[#003c9d] [&>span:not(:first-child)]:hidden"
              >
                <span>ดูตะกร้า / เปรียบเทียบ ({cartIds.length} แผน)</span>
                <span>ดูตะกร้า</span>
                <span className="text-xs font-medium opacity-90">{cartIds.length} แผน</span>
              </button>
              <button type="button" onClick={clearCartSelection} className="mt-1 w-full text-center text-[11px] font-semibold text-[#6b7280] underline-offset-4 hover:underline">
                ล้างตะกร้า
              </button>
            </div>
          ) : null}

          {selectedCount > 0 ? (
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleCompare}
                className="flex h-14 w-full flex-col items-center justify-center rounded-2xl bg-[#0047BA] px-2 text-center font-[Kanit,sans-serif] text-sm font-semibold leading-tight text-white transition hover:bg-[#003c9d]"
              >
                <span>ดูเปรียบเทียบ</span>
                <span className="text-xs font-medium opacity-90">{selectedCount} / {MAX_COMPARE_PACKAGES} แผน</span>
              </button>
              <button type="button" onClick={clearCompareSelection} className="mt-1 w-full text-center text-[11px] font-semibold text-[#6b7280] underline-offset-4 hover:underline">
                ล้างเปรียบเทียบ
              </button>
            </div>
          ) : null}
        </div>
        {selectedCount === 1 ? (
          <p className="mt-1 text-center text-[11px] text-[#4b5265]">เลือกอย่างน้อย 2 แผนเพื่อเปิดตารางเปรียบเทียบ</p>
        ) : null}
      </div>
      ) : null}
    </>
  );
}
