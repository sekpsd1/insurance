'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCtpOptionForSClass } from '@/lib/ctp';

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
  fullPrice: number;
  netPrice: number;
  discount: number;
};

type CompareSelectionProps = {
  packages: ComparePackageCard[];
  baseQueryString: string;
  vehicleTypeLabel: string;
  registrationYear: string;
  cubicCapacityLabel: string;
};

const MAX_COMPARE_PACKAGES = 4;
const COMPARE_STORAGE_KEY = 'insurance.comparePackageIds';
const CART_STORAGE_KEY = 'insurance.cartPackageIds';

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
  baseQueryString,
  vehicleTypeLabel,
  registrationYear,
  cubicCapacityLabel
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
    } catch {
      window.localStorage.removeItem(COMPARE_STORAGE_KEY);
    }
    setIsCompareStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!isCompareStorageLoaded) {
      return;
    }

    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(selectedIds));
  }, [isCompareStorageLoaded, selectedIds]);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      if (Array.isArray(parsed)) {
        setCartIds(parsed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
    setIsCartStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!isCartStorageLoaded) {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartIds));
  }, [cartIds, isCartStorageLoaded]);

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
    router.push(`/line-app/compare?${params.toString()}`);
  }

  return (
    <>
      <div className="space-y-4">
        {packages.map((pkg) => {
          const isSelected = selectedIdSet.has(pkg.id);
          const isInCart = cartIdSet.has(pkg.id);
          const ctpOption = getCtpOptionForSClass(pkg.sClass);
          const isCtpSelected = ctpPackageIdSet.has(pkg.id);
          const totalPrice = pkg.netPrice + (isCtpSelected && ctpOption ? ctpOption.total : 0);
          const deductibleLabel = getDeductibleLabel(pkg.coverageCode);

          return (
            <div
              key={pkg.id}
              className={`overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] ${
                isSelected ? 'ring-2 ring-[#0052CC]' : ''
              }`}
            >
              <div className="relative p-5">
                <div className="relative mb-4 pr-24">
                  <div className="flex min-w-0 items-start gap-3">
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

                    <div className="min-w-0">
                      <p className="text-sm text-[#434654]">{pkg.company}</p>
                      <h2 className="mt-1 font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#0052CC]">{pkg.name}</h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePackage(pkg.id)}
                    aria-pressed={isSelected}
                    className={`absolute right-0 top-0 inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
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

      {selectedCount > 0 ? (
      <div className="sticky bottom-4 rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
        {error ? <p className="mb-2 text-center text-sm font-medium text-red-600">{error}</p> : null}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#1f2a44]">เก็บไว้เปรียบเทียบ {selectedCount} แผน</p>
            <p className="mt-0.5 text-xs text-[#4b5265]">เก็บได้สูงสุด {MAX_COMPARE_PACKAGES} แผน</p>
          </div>
          <button type="button" onClick={clearCompareSelection} className="shrink-0 text-xs font-semibold text-[#6b7280] underline-offset-4 hover:underline">
            ล้าง
          </button>
        </div>
        <button
          type="button"
          onClick={handleCompare}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#003c9d]"
        >
          ดูรายการเปรียบเทียบ
          <span aria-hidden="true">→</span>
        </button>
        <p className="mt-2 text-center text-xs text-[#4b5265]">เลือกอย่างน้อย 2 แผนเพื่อเปิดตารางเปรียบเทียบ</p>
      </div>
      ) : null}
    </>
  );
}
