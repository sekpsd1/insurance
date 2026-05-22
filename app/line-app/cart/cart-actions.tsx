'use client';

import Link from 'next/link';

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
      className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
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
