import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { submitCheckout } from '@/lib/actions';

type CheckoutPageProps = {
  params: Promise<{ orderId: string }>;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      pkg: true
    }
  });

  if (!order) {
    notFound();
  }

  const amount = order.paymentAmount ?? order.pkg.netPrice;
  const bankDetails = [
    order.pkg.paymentBankName,
    order.pkg.paymentAccountNumber ? `เลขที่บัญชี: ${order.pkg.paymentAccountNumber}` : null,
    order.pkg.paymentAccountName ? `ชื่อบัญชี: ${order.pkg.paymentAccountName}` : null
  ].filter((detail): detail is string => Boolean(detail));
  const hasBankTransferSetup = bankDetails.length > 0 || Boolean(order.pkg.paymentQrUrl || order.pkg.paymentNotes);
  const hasGatewaySetup = Boolean(order.pkg.paymentUrl);

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-5 text-[#101828]">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Checkout</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">เลือกวิธีชำระเงิน</h1>
          <div className="mt-4 rounded-2xl bg-[#eef3ff] p-4">
            <div className="text-sm text-slate-600">เลขที่คำสั่งซื้อ</div>
            <div className="mt-1 font-semibold text-slate-950">{order.orderNumber}</div>
            <div className="mt-3 text-sm text-slate-600">คงเหลือชำระ</div>
            <div className="mt-1 text-2xl font-bold text-[#0052CC]">{formatCurrency(amount)}</div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">โอนเงินและแนบสลิป</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">เหมาะสำหรับลูกค้าที่ต้องการโอนเงินเอง แล้วให้แอดมินตรวจสอบสลิป</p>
          </div>

          <div className="mb-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <div className="font-semibold text-slate-950">บัญชีรับโอนของบริษัทประกัน</div>
            {hasBankTransferSetup ? (
              <div className="mt-2 space-y-2">
                {bankDetails.map((detail) => (
                  <div key={detail}>{detail}</div>
                ))}
                {order.pkg.paymentQrUrl ? (
                  <img
                    src={order.pkg.paymentQrUrl}
                    alt="QR code สำหรับชำระเงิน"
                    className="mt-3 max-h-64 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                  />
                ) : null}
                {order.pkg.paymentNotes ? (
                  <div className="whitespace-pre-line rounded-xl bg-white p-3 text-slate-600 ring-1 ring-slate-200">
                    {order.pkg.paymentNotes}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-100">
                ยังไม่ได้ตั้งค่าบัญชีรับชำระสำหรับแคมเปญนี้ กรุณาติดต่อเจ้าหน้าที่ก่อนโอนเงิน
              </div>
            )}
          </div>

          <form action={submitCheckout} className="space-y-4">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="paymentMethod" value="BANK_TRANSFER" />
            <div>
              <label htmlFor="slipFile" className="mb-1 block text-sm font-medium text-slate-700">
                แนบสลิปโอนเงิน
              </label>
              <input
                id="slipFile"
                name="slipFile"
                type="file"
                accept="image/*"
                required
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-[16px] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0052CC] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={!hasBankTransferSetup}
              className="w-full rounded-2xl bg-[#0052CC] px-4 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0040a2] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              ยืนยันการโอนเงิน
            </button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">จ่ายผ่านบัตร / Gateway</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">ระบบจะพาไปยังลิงก์ชำระเงินของบริษัทประกันที่ตั้งค่าไว้ใน campaign นี้</p>
          </div>

          {hasGatewaySetup ? (
            <form action={submitCheckout}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="paymentMethod" value="CARD_GATEWAY" />
              <button
                type="submit"
                className="w-full rounded-2xl bg-slate-950 px-4 py-4 text-base font-semibold text-white transition hover:bg-slate-800"
              >
                ไปที่ลิงก์ชำระเงินของบริษัทประกัน
              </button>
            </form>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              แคมเปญนี้ยังไม่ได้ตั้งค่าลิงก์ชำระเงินออนไลน์
            </div>
          )}
        </section>

        <Link href={`/line-app/form/${order.packageId}${order.ctpSelected ? '?includeCtp=1' : ''}`} className="rounded-2xl bg-white px-4 py-3 text-center font-semibold text-[#0052CC] ring-1 ring-blue-100">
          กลับไปแก้ไขข้อมูลกรมธรรม์
        </Link>
      </div>
    </main>
  );
}
