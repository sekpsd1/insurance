'use client';

import Link from 'next/link';

const COMPARE_STORAGE_KEY = 'insurance.comparePackageIds';

type RemoveComparePackageButtonProps = {
  href: string;
  remainingIds: string[];
};

export default function RemoveComparePackageButton({
  href,
  remainingIds
}: RemoveComparePackageButtonProps) {
  function syncCompareStorage() {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(remainingIds));
  }

  return (
    <Link
      href={href}
      onClick={syncCompareStorage}
      className="inline-flex shrink-0 items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50"
    >
      ลบ
    </Link>
  );
}
