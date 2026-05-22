'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CtpOption } from '@/lib/ctp';

type ComparePackageCard = {
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

const MAX_COMPARE_PACKAGES = 4;
const COMPARE_STORAGE_KEY = 'insurance.comparePackageIds';
const COMPARE_CTP_STORAGE_KEY = 'insurance.compareCtpPackageIds';
const CART_STORAGE_KEY = 'insurance.cartPackageIds';
const CART_CTP_STORAGE_KEY = 'insurance.cartCtpPackageIds';

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

function formatSumInsuredRange(min: number | null | undefined, max: number | null | undefined) {
  if (min === 0 && max === 0) {
    return 'ไม่มีทุนประกัน';
  }

  if (!min && !max) {
    return '-';
  }

  if (min && max && min !== max) {
    return `${formatMoney(min)}-${formatMoney(max)} บาท`;
  }

  return `${formatMoney(min ?? max ?? 0)} บาท`;
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
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${toneClass}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [cartIds, setCartIds] = useState<string[]>([]);
  const [ctpPackageIds, setCtpPackageIds] = useState<string[]>([]);
  const [failedLogoIds, setFailedLogoIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isCompareStorageLoaded, setIsCompareStorageLoaded] = useState(false);
  const [isCartStorageLoaded, setIsCartStorageLoaded] = useState(false);

  const selectedCount = selectedIds.length;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const cartIdSet = useMemo(() => new Set(cartIds), [cartIds]);
  const ctpPackageIdSet = useMemo(() => new Set(ctpPackageIds), [ctpPackageIds]);
  const failedLogoIdSet = useMemo(() => new Set(failedLogoIds), [failedLogoIds]);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(COMPARE_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      if (Array.isArray(parsed)) {
        setSelectedIds(parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_COMPARE_PACKAGES));
      }

      const rawCtpValue = window.localStorage.getItem(COMPARE_CTP_STORAGE_KEY);
      const parsedCtp = rawCtpValue ? JSON.parse(rawCtpValue) : [];
      const storedCtpIds = Array.isArray(parsedCtp) ? parsedCtp.filter((value): value is string => typeof value === 'string') : [];
      setCtpPackageIds(Array.from(new Set([...storedCtpIds, ...initialCtpPackageIds])));
    } catch {
      window.localStorage.removeItem(COMPARE_STORAGE_KEY);
      window.localStorage.removeItem(COMPARE_CTP_STORAGE_KEY);
    }
    setIsCompareStorageLoaded(true);
  }, [initialCtpPackageIds]);

  useEffect(() => {
    if (!isCompareStorageLoaded) {
      return;
    }

    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(selectedIds));
    window.localStorage.setItem(COMPARE_CTP_STORAGE_KEY, JSON.stringify(ctpPackageIds));
  }, [ctpPackageIds, isCompareStorageLoaded, selectedIds]);

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

  function togglePackage(id: string) {
    setError('');
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= MAX_COMPARE_PACKAGES) {
        setError(`เลือกได้สูงสุด ${MAX_COMPARE_PACKAGES} แผน`);
        return current;
      }

      return [...current, id];
    });
  }

  function clearCompareSelection() {
    setError('');
    setSelectedIds([]);
  }

  function clearCartSelection() {
    setCartIds([]);
    setCtpPackageIds([]);
  }

  function toggleCart(id: string) {
    setCartIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleCtp(id: string) {
    setCtpPackageIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
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
    if (selectedIds.length < 2) {
      setError('กรุณาเก็บอย่างน้อย 2 แผนเพื่อเปรียบเทียบ');
      return;
    }

    const params = new URLSearchParams(baseQueryString);
    selectedIds.forEach((id) => params.append('ids', id));
    ctpPackageIds.filter((id) => selectedIds.includes(id)).forEach((id) => params.append('ctpIds', id));
    router.push(`/line-app/compare?${params.toString()}`);
  }

  function handleCart() {
    const params = new URLSearchParams(baseQueryString);
    cartIds.forEach((id) => params.append('ids', id));
    ctpPackageIds.filter((id) => cartIds.includes(id)).forEach((id) => params.append('ctpIds', id));
    router.push(`/line-app/cart?${params.toString()}`);
  }

  return (
    <>
      <div className="space-y-4">
        {packages.map((pkg) => {
          const isSelected = selectedIdSet.has(pkg.id);
          const isInCart = cartIdSet.has(pkg.id);
          const ctpOption = pkg.sClass ? ctpOptionsBySClass[pkg.sClass] ?? null : null;
          const isCtpSelected = ctpPackageIdSet.has(pkg.id);
          const ctpTotal = isCtpSelected && ctpOption ? ctpOption.total : 0;
          const totalPrice = pkg.netPrice + ctpTotal;
          const payableTotal = (pkg.payablePrice ?? pkg.netPrice) + ctpTotal;
          const deductibleLabel = getDeductibleLabel(pkg.coverageCode);

          return (
            <div
              key={pkg.id}
              className={`overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] ${
                isSelected ? 'ring-2 ring-[#0052CC]' : ''
              }`}
            >
              <div className="relative p-5">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(195,198,214,0.35)] bg-[#eef3ff] shadow-sm">
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
                    <p className="text-sm leading-5 text-[#434654]">{pkg.company}</p>
                    <p className="mt-1 font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#0052CC]">
                      {[pkg.brand, pkg.model].filter(Boolean).join(' · ') || '-'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePackage(pkg.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[#0052CC] text-white shadow-[0_2px_8px_rgba(0,82,204,0.25)]'
                        : 'bg-[#eef3ff] text-[#0052CC] hover:bg-[#dde7ff]'
                    }`}
                  >
                    <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                    {isSelected ? 'เลือกเทียบแล้ว' : 'เลือกเทียบ'}
                  </button>
                </div>

                <div className="mb-4 overflow-hidden rounded-2xl border border-[#dfe4ef] bg-white shadow-[0_6px_18px_rgba(15,32,67,0.06)]">
                  <div className="space-y-3 p-4 text-sm text-[#2f3545]">
                    <div className="flex items-start gap-3">
                      <DetailIcon icon="car" tone="blue" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-[#1f2a44]">{getSClassShortLabel(pkg.sClass, vehicleTypeLabel)}</span>
                          <span className="text-right leading-5">{vehicleTypeLabel || '-'}</span>
                        </div>
                        {(registrationYear || cubicCapacityLabel) ? (
                          <p className="mt-1 text-xs text-[#667085]">
                            {[registrationYear ? `ปี ${registrationYear}` : '', cubicCapacityLabel].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DetailIcon icon="shield" tone="indigo" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium text-[#4b5265]">ประเภท</span>
                        <span className="text-right font-semibold text-[#1f2a44]">{getCoverageLabel(pkg.coverageType || '')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DetailIcon icon="money" tone="green" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium text-[#4b5265]">ทุนประกัน</span>
                        <span className="text-right font-semibold text-[#1f2a44]">{formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DetailIcon icon="star" tone="amber" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium text-[#4b5265]">ความเสียหายส่วนแรก</span>
                        <span className="text-right font-semibold text-[#1f2a44]">{deductibleLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <DetailIcon icon="wrench" tone="slate" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium text-[#4b5265]">ประเภทการซ่อม</span>
                        <span className="text-right font-semibold text-[#1f2a44]">{getText(pkg.repairType, 'อู่ประกัน')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 overflow-hidden rounded-2xl bg-[#eef1f4] shadow-[0_8px_22px_rgba(15,32,67,0.08)]">
                  <div className="border-b border-[#d8dde7] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-[Kanit,sans-serif] text-base font-bold text-[#1f2a44]">สรุปค่าใช้จ่าย</h3>
                      {ctpOption ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#1f2a44]">
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

                  <div className="space-y-3 px-4 py-4 text-sm text-[#2f3545]">
                    <div className="flex items-center gap-3">
                      <DetailIcon icon="tag" tone="orange" />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="font-medium">เบี้ยประกัน</span>
                        <span className="text-right font-semibold">{formatMoney(pkg.netPrice)} บาท</span>
                      </div>
                    </div>

                    {ctpOption ? (
                      <div className="flex items-center gap-3">
                        <DetailIcon icon="ctp" tone="blue" />
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                          <span className="font-medium">พ.ร.บ. เพิ่มเติม</span>
                          <span className="text-right font-semibold">{isCtpSelected ? `${formatMoney(ctpOption.total)} บาท` : '-'}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-[#d8dde7] px-4 py-4 text-lg font-bold text-[#1f2a44]">
                    <span>รวม</span>
                    <span>{formatMoney(totalPrice)} บาท</span>
                  </div>
                </div>

                <div className="mb-5 rounded-2xl border border-[#d6c27a] bg-[#fffdf4] px-4 py-4 shadow-[0_8px_20px_rgba(154,118,20,0.10)]">
                  <p className="text-sm font-semibold text-[#4b3a0b]">คงเหลือชำระ</p>
                  <p className="mt-1 font-[Kanit,sans-serif] text-3xl font-bold leading-tight text-[#111827]">{formatMoney(payableTotal)} บาท</p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleCart(pkg.id)}
                  aria-pressed={isInCart}
                  className={`mb-3 flex w-full items-center justify-center gap-2 border py-3 font-[Kanit,sans-serif] text-base font-semibold transition-colors ${
                    isInCart
                      ? 'border-[#0052CC] bg-[#eef3ff] text-[#0052CC]'
                      : 'border-[#0052CC] bg-white text-[#0052CC] hover:bg-[#eef3ff]'
                  }`}
                >
                  <span aria-hidden="true">{isInCart ? '✓' : '+'}</span>
                  {isInCart ? 'อยู่ในตะกร้าแล้ว' : 'เก็บใส่ตะกร้า'}
                </button>

                <a
                  href={buildFormHref(pkg.id, isCtpSelected)}
                  className="flex w-full items-center justify-center gap-2 bg-[#0052CC] py-4 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
                >
                  ดูรายละเอียด / เลือกแผนนี้
                  <span aria-hidden="true" className="text-sm">→</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {cartIds.length > 0 || selectedCount > 0 ? (
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-[#d8dcec] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(4,16,61,0.10)] backdrop-blur">
        {error ? <p className="mb-2 text-center text-xs font-medium text-red-600">{error}</p> : null}
        <div className={`grid gap-2 ${cartIds.length > 0 && selectedCount > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {cartIds.length > 0 ? (
            <div className="min-w-0">
              <button
                type="button"
                onClick={handleCart}
                className="flex h-14 w-full flex-col items-center justify-center rounded-2xl bg-[#0047BA] px-2 text-center font-[Kanit,sans-serif] text-sm font-semibold leading-tight text-white transition hover:bg-[#003c9d]"
              >
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
