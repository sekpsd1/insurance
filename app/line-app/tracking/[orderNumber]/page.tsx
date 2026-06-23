import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { RememberTrackingOrder } from '@/app/line-app/_components/tracking-order-memory';
import CloseLineMenuButton from '@/app/line-app/_components/close-line-menu-button';
import {
  getPaymentStatusLabel,
  getStatusHistoryMessageLabel,
  isCustomerVisibleStatusHistory
} from '@/lib/status-labels';

type TrackingPageProps = {
  params: Promise<{ orderNumber: string }>;
};

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'ร่างคำสั่งซื้อ',
    PENDING_PAYMENT: 'รอชำระเงิน',
    PAYMENT_SUBMITTED: 'ส่งหลักฐานชำระเงินแล้ว',
    PENDING: 'รอตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    PAID: 'ชำระเงินแล้ว',
    SENT_TO_INSURER: 'ส่งให้บริษัทประกันแล้ว',
    INSURER_REVIEWING: 'บริษัทประกันกำลังตรวจสอบ',
    POLICY_APPROVED: 'อนุมัติกรมธรรม์แล้ว',
    POLICY_ISSUED: 'ออกกรมธรรม์แล้ว',
    REJECTED: 'ไม่อนุมัติ',
    CANCELLED: 'ยกเลิก'
  };

  return labels[status] ?? status;
}

function getStepStyles(isActive: boolean) {
  return isActive ? 'bg-[#0052CC] text-white' : 'bg-slate-100 text-slate-500';
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export default async function TrackingDetailPage({ params }: TrackingPageProps) {
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: {
      orderNumber: decodeURIComponent(orderNumber)
    },
    include: {
      pkg: true,
      statusHistory: {
        orderBy: {
          createdAt: 'asc'
        }
      }
    }
  });

  if (!order) {
    notFound();
  }

  const steps = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'SENT_TO_INSURER', 'POLICY_ISSUED'];
  const activeIndex = Math.max(steps.indexOf(order.status), order.status === 'POLICY_APPROVED' ? 3 : -1);
  const visibleStatusHistory = order.statusHistory.filter(isCustomerVisibleStatusHistory);
  const ctpTotal = order.ctpSelected ? (order.ctpTotal ?? 0) : 0;
  const paymentAmount = order.paymentAmount ?? (order.pkg.payablePrice ?? order.pkg.netPrice) + ctpTotal;
  const planPayableAmount = Math.max(paymentAmount - ctpTotal, 0);

  return (
    <main className="min-h-screen bg-[#f4f7ff] text-[#101828]">
      <RememberTrackingOrder orderNumber={order.orderNumber} />
      <header className="sticky top-0 z-40 bg-[#0052CC] text-white shadow-[0_4px_16px_rgba(0,0,0,0.16)]">
        <div className="mx-auto grid max-w-md grid-cols-[auto_1fr] items-center gap-2 px-4 py-3">
          <CloseLineMenuButton label="กลับไปเมนู" />
          <h1 className="min-w-0 whitespace-nowrap text-right font-[Kanit,sans-serif] text-[clamp(18px,5.4vw,24px)] font-bold leading-none tracking-wide">
            ติดตามคำสั่งซื้อ
          </h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Order Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-slate-500">{order.pkg.name}</p>

          <div className="mt-5 rounded-2xl bg-[#eef3ff] p-4">
            <div className="text-sm text-slate-600">สถานะปัจจุบัน</div>
            <div className="mt-1 text-xl font-bold text-[#0052CC]">{getStatusLabel(order.status)}</div>
            <div className="mt-2 text-sm text-slate-600">การชำระเงิน: {getPaymentStatusLabel(order.paymentStatus)}</div>
            <div className="mt-3 space-y-2 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span>ยอดคงเหลือชำระแผนหลัก</span>
                <span className="font-semibold text-slate-900">{formatCurrency(planPayableAmount)}</span>
              </div>
              {order.ctpSelected ? (
                <div className="flex items-center justify-between gap-3">
                  <span>พ.ร.บ. {order.ctpRateCode ?? '-'}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(order.ctpTotal)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 font-bold text-slate-950">
                <span>ยอดที่ต้องชำระรวม</span>
                <span>{formatCurrency(paymentAmount)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-slate-950">ขั้นตอนดำเนินการ</h2>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {steps.map((step, index) => (
              <div key={step} className={`rounded-2xl px-2 py-3 text-center text-xs font-semibold ${getStepStyles(index <= activeIndex)}`}>
                {index + 1}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] text-slate-500">
            <span>รอจ่าย</span>
            <span>ส่งสลิป</span>
            <span>จ่ายแล้ว</span>
            <span>ส่งบริษัท</span>
            <span>กรมธรรม์</span>
          </div>
        </section>

        {order.policyPdfUrl ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Policy PDF</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">กรมธรรม์ของคุณ</h2>
            {order.policyNumber ? (
              <p className="mt-1 text-sm text-slate-600">เลขกรมธรรม์: {order.policyNumber}</p>
            ) : null}
            <a
              href={order.policyPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-emerald-600/20"
            >
              เปิดกรมธรรม์ PDF
            </a>
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-slate-950">Timeline</h2>
          <div className="mt-4 space-y-3">
            {visibleStatusHistory.length === 0 ? (
              <p className="text-sm text-slate-500">ยังไม่มีประวัติสถานะ</p>
            ) : (
              visibleStatusHistory.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-950">{getStatusLabel(item.status)}</div>
                    <div className="text-xs text-slate-500">{item.createdAt.toLocaleString('th-TH')}</div>
                  </div>
                  {item.message ? <p className="mt-1 text-sm text-slate-600">{getStatusHistoryMessageLabel(item.message)}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>

        <Link href="/line-app/tracking" className="rounded-2xl bg-white px-4 py-3 text-center font-semibold text-[#0052CC] ring-1 ring-blue-100">
          ค้นหาออเดอร์อื่น
        </Link>
      </div>
    </main>
  );
}
