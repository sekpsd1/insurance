'use client';

import { useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'insurance.cartPackageIds';

type CartPackageButtonProps = {
  packageId: string;
};

function readCartIds() {
  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    window.localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
}

export default function CartPackageButton({ packageId }: CartPackageButtonProps) {
  const [isInCart, setIsInCart] = useState(false);

  useEffect(() => {
    setIsInCart(readCartIds().includes(packageId));
  }, [packageId]);

  function toggleCart() {
    const currentIds = readCartIds();
    const nextIds = currentIds.includes(packageId)
      ? currentIds.filter((id) => id !== packageId)
      : [...currentIds, packageId];

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextIds));
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
