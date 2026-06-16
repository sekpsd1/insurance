import { redirect } from 'next/navigation';
import { TrackingOrdersPanel } from './tracking-orders-panel';
import CloseLineMenuButton from '@/app/line-app/_components/close-line-menu-button';

async function findOrder(formData: FormData) {
  'use server';

  const orderNumber = String(formData.get('orderNumber') ?? '').trim();

  if (orderNumber) {
    redirect(`/line-app/tracking/${encodeURIComponent(orderNumber)}`);
  }
}

export default function TrackingSearchPage() {
  return (
    <main className="min-h-screen bg-[#f4f7ff] text-[#101828]">
      <header className="sticky top-0 z-40 bg-[#0052CC] text-white shadow-[0_4px_16px_rgba(0,0,0,0.16)]">
        <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] items-center gap-2 px-4 py-3">
          <CloseLineMenuButton label="กลับไปเมนู" />
          <h1 className="min-w-0 whitespace-nowrap text-right font-[Kanit,sans-serif] text-[clamp(18px,5.4vw,24px)] font-bold leading-none tracking-wide">
            ติดตามคำสั่งซื้อ
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Order Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">ติดตามสถานะคำสั่งซื้อ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรอกเลขที่คำสั่งซื้อเพื่อดูสถานะชำระเงินและสถานะกรมธรรม์ล่าสุด
          </p>

          <TrackingOrdersPanel />

          <form action={findOrder} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <div>
              <label htmlFor="orderNumber" className="mb-1 block text-sm font-medium text-slate-700">
                เลขที่คำสั่งซื้อ
              </label>
              <input
                id="orderNumber"
                name="orderNumber"
                type="text"
                placeholder="เช่น IN-20260509-123456"
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] uppercase outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-2xl bg-[#0052CC] px-4 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0040a2]"
            >
              ตรวจสอบสถานะ
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
