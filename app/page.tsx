import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="mb-6 inline-flex w-fit rounded-full bg-brand-100 px-4 py-2 text-sm font-medium text-brand-700">
        LINE Mini App · ประกันภัยรถยนต์
      </div>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
        โครงโปรเจกต์พร้อมสำหรับลูกค้าและแอดมิน
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
        ใช้ Next.js 15 App Router, TypeScript, Tailwind CSS และ Prisma สำหรับเชื่อมต่อ MySQL บน Plesk
      </p>
      <div className="mt-10 flex flex-wrap gap-4">
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
