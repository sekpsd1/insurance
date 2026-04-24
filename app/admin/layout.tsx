import type { ReactNode } from 'react';

export default function AdminLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-cyan-300">
              Admin Area
            </p>
            <h1 className="text-lg font-semibold text-white">LINE Mini App · Admin</h1>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
