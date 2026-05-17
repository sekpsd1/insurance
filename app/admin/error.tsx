"use client";

import { useEffect } from 'react';

function getFriendlyMessage(message: string) {
  if (message.includes('Provider email')) return 'อีเมลบริษัทประกันไม่ถูกต้อง กรุณาตรวจสอบข้อมูลผู้ติดต่อของแคมเปญ';
  if (message.includes('Provider phone')) return 'เบอร์โทรบริษัทประกันต้องมีตัวเลข 9-15 หลัก';
  if (message.includes('Payment URL')) return 'ลิงก์ชำระเงินต้องเป็น URL ที่ถูกต้อง และใน production ต้องเป็น HTTPS';
  if (message.includes('CSV')) return 'ไฟล์ CSV ไม่ถูกต้องหรือมีขนาดใหญ่เกินกำหนด';
  if (message.includes('Upload file')) return 'ไฟล์อัปโหลดต้องเป็นรูปภาพ PNG, JPG, WebP หรือ GIF และขนาดไม่เกินที่กำหนด';
  if (message.includes('EMAIL_PROVIDER')) return 'ยังไม่ได้ตั้งค่าระบบส่งอีเมลจริงสำหรับ production';
  return 'ดำเนินการไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง';
}

export default function AdminError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[admin] route error:', error);
  }, [error]);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-88px)] max-w-2xl items-center px-4 py-10">
      <div className="w-full rounded-3xl border border-white/10 bg-white p-6 text-center text-slate-900 shadow-2xl shadow-black/20">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-600">Admin Error</p>
        <h1 className="mt-3 text-2xl font-bold">ไม่สามารถดำเนินการได้</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{getFriendlyMessage(error.message)}</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          กลับไปลองอีกครั้ง
        </button>
      </div>
    </section>
  );
}
