'use client';

import { useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'insurance.cartPackageIds';
const CART_CTP_STORAGE_KEY = 'insurance.cartCtpPackageIds';

type CartPackageButtonProps = {
  packageId: string;
  includeCtp?: boolean;
};

function readStorageIds(key: string) {
  try {
    const rawValue = window.localStorage.getItem(key);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export default function CartPackageButton({ packageId, includeCtp = false }: CartPackageButtonProps) {
  const [isInCart, setIsInCart] = useState(false);

  useEffect(() => {
    setIsInCart(readStorageIds(CART_STORAGE_KEY).includes(packageId));
  }, [packageId]);

  function toggleCart() {
    const currentCartIds = readStorageIds(CART_STORAGE_KEY);
    const currentCtpIds = readStorageIds(CART_CTP_STORAGE_KEY);
    const isCurrentlyInCart = currentCartIds.includes(packageId);
    const nextIds = isCurrentlyInCart
      ? currentCartIds.filter((id) => id !== packageId)
      : [...currentCartIds, packageId];
    const nextCtpIds = isCurrentlyInCart
      ? currentCtpIds.filter((id) => id !== packageId)
      : includeCtp && !currentCtpIds.includes(packageId)
        ? [...currentCtpIds, packageId]
        : currentCtpIds;

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextIds));
    window.localStorage.setItem(CART_CTP_STORAGE_KEY, JSON.stringify(nextCtpIds.filter((id) => nextIds.includes(id))));
    setIsInCart(nextIds.includes(packageId));
  }

  return (
    <button
      type="button"
      onClick={toggleCart}
      aria-pressed={isInCart}
      className={`inline-flex w-full items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        isInCart
          ? 'bg-[#0052CC] text-white shadow-sm'
          : 'bg-white text-[#0052CC] ring-1 ring-[#cfd8ff] hover:bg-[#eef3ff]'
      }`}
    >
      {isInCart ? 'อยู่ในตะกร้าแล้ว' : 'เก็บใส่ตะกร้า'}
    </button>
  );
}
