import type { ReactNode } from 'react';
import { AdminNav } from './_components/admin-nav';

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
          <AdminNav />
        </div>
      </header>
      {children}
    </main>
  );
}
