import Link from "next/link";

export default function LineAppNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Not Found
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">
          ไม่พบหน้าที่ร้องขอ
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          หน้าที่คุณเปิดอาจถูกย้ายหรือไม่พร้อมใช้งานในตอนนี้
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href="/line-app"
            className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            กลับหน้าแพ็กเกจ
          </Link>
        </div>
      </div>
    </main>
  );
}
