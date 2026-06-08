'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Orders', exact: true },
  { href: '/admin/leads', label: 'Type 1 Leads' },
  { href: '/admin/insurance/packages', label: 'Packages' },
  { href: '/admin/insurance', label: 'Insurance Campaigns', exact: true },
  { href: '/admin/readiness', label: 'Readiness' }
];

type AdminRole = 'admin' | 'sales';

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname() ?? '';

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return null;
  }

  const visibleNavItems =
    role === 'sales'
      ? navItems.filter((item) => item.href === '/admin' || item.href === '/admin/leads')
      : navItems;

  return (
    <div className="flex items-center gap-3">
      <nav className="flex items-center gap-2 text-sm font-semibold">
        {visibleNavItems.map((item) => {
          const isActive = isActivePath(pathname, item.href, item.exact);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={
                isActive
                  ? 'rounded-full bg-cyan-500 px-4 py-2 text-slate-950 transition hover:bg-cyan-400'
                  : 'rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/10'
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action="/admin/logout" method="post">
        <button
          type="submit"
          className="rounded-full border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 hover:text-white"
        >
          Logout
        </button>
      </form>
    </div>
  );
}
