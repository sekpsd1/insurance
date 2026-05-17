import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AdminLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
              Admin Area
            </p>
            <h1 className="text-lg font-semibold text-white">LINE Mini App · Admin</h1>
          </div>
          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/admin"
              prefetch={false}
              className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/10"
            >
              Orders
            </Link>
            <Link
              href="/admin/insurance/packages"
              prefetch={false}
              className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/10"
            >
              Packages
            </Link>
            <Link
              href="/admin/insurance"
              prefetch={false}
              className="rounded-full bg-cyan-500 px-4 py-2 text-slate-950 transition hover:bg-cyan-400"
            >
              Insurance Campaigns
            </Link>
            <Link
              href="/admin/readiness"
              prefetch={false}
              className="rounded-full border border-white/10 px-4 py-2 text-white transition hover:bg-white/10"
            >
              Readiness
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
