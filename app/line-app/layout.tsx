import type { ReactNode } from 'react';

export default function LineAppLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600">
              Customer Area
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              LINE Mini App · Insurance Quote
            </h1>
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
