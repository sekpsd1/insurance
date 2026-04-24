"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global] route error:", error);
  }, [error]);

  return (
    <html lang="th">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <main className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
            Application Error
          </p>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            เกิดข้อผิดพลาดของระบบ
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            กรุณาลองรีเฟรชหน้าอีกครั้ง หากยังพบปัญหาให้ตรวจสอบ log ใน terminal
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              ลองใหม่
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
