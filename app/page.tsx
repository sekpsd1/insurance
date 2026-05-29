import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="flex flex-wrap gap-4">
        <Link
          href="/line-app/search"
          className="rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
        >
          ไปหน้า Customer
        </Link>
        <Link
          href="/admin"
          className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 transition hover:border-slate-400"
        >
          ไปหน้า Admin
        </Link>
      </div>
    </main>
  );
}
