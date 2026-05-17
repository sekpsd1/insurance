"use client";

import { useEffect } from 'react';

function getFriendlyMessage(message: string) {
  if (message.includes('Magic link is invalid or expired')) {
    return 'Magic Link นี้หมดอายุ ถูกใช้ไปแล้ว หรือไม่ถูกต้อง กรุณาขอลิงก์ใหม่จาก broker';
  }

  if (message.includes('Insurer note')) {
    return 'ข้อความเพิ่มเติมยาวเกินไป กรุณาย่อข้อความแล้วลองบันทึกอีกครั้ง';
  }

  if (message.includes('Actor name')) {
    return 'ชื่อเจ้าหน้าที่ไม่ถูกต้องหรือยาวเกินไป กรุณาตรวจสอบแล้วลองใหม่';
  }

  return 'บันทึกสถานะไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง';
}

export default function InsuranceUpdateError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[insurance/update] route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7ff] px-4 py-10 text-[#101828]">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Insurance Provider</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">ไม่สามารถบันทึกสถานะได้</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{getFriendlyMessage(error.message)}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-2xl bg-[#0052CC] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0040a2]"
        >
          กลับไปลองอีกครั้ง
        </button>
      </section>
    </main>
  );
}
