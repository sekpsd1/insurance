"use client";

import { useEffect } from "react";

function getFriendlyMessage(message: string) {
  if (message.includes('Customer phone')) return 'เบอร์โทรต้องมีตัวเลข 9-15 หลัก';
  if (message.includes('Customer email')) return 'รูปแบบอีเมลไม่ถูกต้อง';
  if (message.includes('ID card number')) return 'เลขบัตรประชาชนไม่ถูกต้อง';
  if (message.includes('Plate number')) return 'ทะเบียนรถมีรูปแบบไม่ถูกต้อง';
  if (message.includes('Policy start date')) return 'วันที่คุ้มครองไม่สามารถย้อนหลังได้ และต้องไม่ล่วงหน้าเกิน 1 ปี';
  if (message.includes('Payment slip')) return 'กรุณาแนบสลิปโอนเงินก่อนส่งข้อมูล';
  if (message.includes('Upload file')) return 'ไฟล์ที่อัปโหลดต้องเป็นรูปภาพ PNG, JPG, WebP หรือ GIF และขนาดไม่เกินที่กำหนด';
  if (message.includes('Provider payment URL')) return 'แคมเปญนี้ยังไม่ได้ตั้งค่าลิงก์ชำระเงินของบริษัทประกัน กรุณาติดต่อผู้ดูแลระบบ';
  return 'กรุณาตรวจสอบข้อมูลอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ';
}

export default function LineAppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[line-app] route error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="max-w-md rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-slate-200">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
          Line App Error
        </p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">
          เกิดข้อผิดพลาดในการแสดงหน้า
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{getFriendlyMessage(error.message)}</p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    </main>
  );
}
