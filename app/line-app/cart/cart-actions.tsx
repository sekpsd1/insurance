'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CART_STORAGE_KEY = 'insurance.cartPackageIds';
const CART_CTP_STORAGE_KEY = 'insurance.cartCtpPackageIds';

type RemoveCartPackageButtonProps = {
  href: string;
  remainingIds: string[];
  remainingCtpIds: string[];
};

type ClearCartButtonProps = {
  href: string;
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

export function CartStorageHydrator() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.has('ids')) {
      setIsChecking(false);
      return;
    }

    const storedIds = getStoredStringList(CART_STORAGE_KEY);
    const storedCtpIds = getStoredStringList(CART_CTP_STORAGE_KEY).filter((id) => storedIds.includes(id));

    if (storedIds.length > 0) {
      storedIds.forEach((id) => params.append('ids', id));
      storedCtpIds.forEach((id) => params.append('ctpIds', id));
      router.replace(`/line-app/cart?${params.toString()}`);
      return;
    }

    setIsChecking(false);
  }, [router]);

  if (!isChecking) {
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

export function ClearCartButton({ href }: ClearCartButtonProps) {
  function clearCartStorage() {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    window.localStorage.removeItem(CART_CTP_STORAGE_KEY);
  }

  return (
    <Link
      href={href}
      onClick={clearCartStorage}
      className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-[0_8px_24px_rgba(0,0,0,0.04)] ring-1 ring-red-100 transition hover:bg-red-50"
    >
      ล้างตะกร้า
    </Link>
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
