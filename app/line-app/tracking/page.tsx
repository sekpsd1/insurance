import { redirect } from 'next/navigation';

async function findOrder(formData: FormData) {
  'use server';

  const orderNumber = String(formData.get('orderNumber') ?? '').trim();

  if (orderNumber) {
    redirect(`/line-app/tracking/${encodeURIComponent(orderNumber)}`);
  }
}

export default function TrackingSearchPage() {
  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8 text-[#101828]">
      <div className="mx-auto max-w-md">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Order Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">ติดตามสถานะคำสั่งซื้อ</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรอกเลขที่คำสั่งซื้อเพื่อดูสถานะชำระเงินและสถานะกรมธรรม์ล่าสุด
          </p>

          <form action={findOrder} className="mt-6 space-y-4">
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
