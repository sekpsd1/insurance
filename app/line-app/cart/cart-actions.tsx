'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CART_STORAGE_KEY = 'insurance.cartPackageIds';
const CART_CTP_STORAGE_KEY = 'insurance.cartCtpPackageIds';
const COMPARE_STORAGE_KEY = 'insurance.comparePackageIds';
const COMPARE_CTP_STORAGE_KEY = 'insurance.compareCtpPackageIds';

type RemoveCartPackageButtonProps = {
  href: string;
  remainingIds: string[];
  remainingCtpIds: string[];
};

type CoverageDetailRow = {
  kind: 'heading' | 'subheading' | 'row';
  label: string;
  value?: string;
};

type CartPlanActionsProps = {
  formHref: string;
  coverageDetailRows: CoverageDetailRow[];
};

type CartCompareSelectorProps = {
  baseQueryString: string;
  selectedCtpIds: string[];
  packages: Array<{
    id: string;
    title: string;
    subtitle: string;
  }>;
};

function getStoredStringList(key: string) {
  try {
    const rawValue = window.localStorage.getItem(key);
    const parsed = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export function CartStorageHydrator({ showLoading = true }: { showLoading?: boolean }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasUrlIds = params.has('ids');
    const hasKnownCartState = window.localStorage.getItem(CART_STORAGE_KEY) !== null;
    const storedIds = getStoredStringList(CART_STORAGE_KEY);
    const storedCtpIds = getStoredStringList(CART_CTP_STORAGE_KEY).filter((id) => storedIds.includes(id));

    if (hasUrlIds) {
      if (hasKnownCartState && storedIds.length === 0) {
        router.replace('/line-app/cart');
        return;
      }

      setIsChecking(false);
      return;
    }

    if (storedIds.length > 0) {
      storedIds.forEach((id) => params.append('ids', id));
      storedCtpIds.forEach((id) => params.append('ctpIds', id));
      router.replace(`/line-app/cart?${params.toString()}`);
      return;
    }

    setIsChecking(false);
  }, [router]);

  if (!showLoading || !isChecking) {
    return null;
  }

  return (
    <section className="rounded-3xl bg-white p-5 text-center text-sm font-semibold text-[#0052CC] shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
      กำลังเปิดตะกร้าที่บันทึกไว้...
    </section>
  );
}

export function RemoveCartPackageButton({
  href,
  remainingIds,
  remainingCtpIds
}: RemoveCartPackageButtonProps) {
  function syncCartStorage() {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(remainingIds));
    window.localStorage.setItem(CART_CTP_STORAGE_KEY, JSON.stringify(remainingCtpIds));
  }

  return (
    <Link
      href={href}
      onClick={syncCartStorage}
      className="absolute right-0 top-0 inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
    >
      ลบ
    </Link>
  );
}

export function ClearCartButton() {
  const router = useRouter();

  function clearCartStorage() {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]));
    window.localStorage.setItem(CART_CTP_STORAGE_KEY, JSON.stringify([]));
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify([]));
    window.localStorage.setItem(COMPARE_CTP_STORAGE_KEY, JSON.stringify([]));
    router.replace('/line-app/cart');
  }

  return (
    <button
      type="button"
      onClick={clearCartStorage}
      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-red-100 transition hover:bg-red-50"
    >
      ล้างตะกร้า
    </button>
  );
}

export function CartCompareSelector({
  baseQueryString,
  selectedCtpIds,
  packages
}: CartCompareSelectorProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (packages.length === 2 ? packages.map((pkg) => pkg.id) : []));
  const [error, setError] = useState('');

  function togglePackage(id: string) {
    setError('');
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= 2) {
        return current;
      }

      return [...current, id];
    });
  }

  function openCompare() {
    if (selectedIds.length !== 2) {
      setError('กรุณาเลือก 2 แผนเพื่อเปรียบเทียบ');
      return;
    }

    const params = new URLSearchParams(baseQueryString);
    selectedIds.forEach((id) => params.append('ids', id));
    selectedCtpIds.filter((id) => selectedIds.includes(id)).forEach((id) => params.append('ctpIds', id));
    router.push(`/line-app/compare?${params.toString()}`);
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="whitespace-nowrap font-[Kanit,sans-serif] text-[15px] font-bold leading-6 text-[#0047BA] sm:text-base">เลือกแผนเพื่อเปรียบเทียบ</p>
          <p className="mt-1 text-sm leading-6 text-[#4b5265]">เลือกได้ 2 แผนจากรายการในตะกร้า</p>
        </div>
        <span className="min-w-[44px] whitespace-nowrap rounded-full bg-[#eef3ff] px-2 py-1 text-center text-xs font-semibold text-[#0052CC]">
          {selectedIds.length} / 2
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {packages.map((pkg) => {
          const isSelected = selectedIds.includes(pkg.id);
          const isDisabled = !isSelected && selectedIds.length >= 2;

          return (
            <label
              key={pkg.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                isSelected
                  ? 'border-[#0052CC] bg-[#eef3ff]'
                  : isDisabled
                    ? 'border-[#e5e7eb] bg-[#f8fafc] opacity-60'
                    : 'border-[#dfe4ef] bg-white hover:bg-[#f8faff]'
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => togglePackage(pkg.id)}
                className="mt-1 h-5 w-5 rounded border-slate-300 text-[#0052CC] focus:ring-[#0052CC]"
              />
              <span className="min-w-0">
                <span className="block font-[Kanit,sans-serif] text-sm font-semibold leading-5 text-[#1f2a44]">{pkg.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-[#4b5265]">{pkg.subtitle}</span>
              </span>
            </label>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={openCompare}
        className="mt-4 w-full rounded-2xl bg-[#0047BA] px-4 py-4 font-[Kanit,sans-serif] text-base font-semibold text-white transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:bg-[#b8c6e6]"
      >
        เปรียบเทียบ 2 แผน
      </button>
    </section>
  );
}

export function CartPlanActions({ formHref, coverageDetailRows }: CartPlanActionsProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setIsDetailsOpen((current) => !current)}
          className="flex items-center justify-center border border-[#0052CC] bg-white py-3 font-[Kanit,sans-serif] text-base font-semibold text-[#0052CC] transition-colors hover:bg-[#eef3ff]"
        >
          ดูรายละเอียด
        </button>
        <Link
          href={formHref}
          className="flex items-center justify-center gap-2 bg-[#0052CC] py-3 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
        >
          เลือกแผนนี้
          <span aria-hidden="true">→</span>
        </Link>
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
        </div>
      ) : null}
    </>
  );
}
