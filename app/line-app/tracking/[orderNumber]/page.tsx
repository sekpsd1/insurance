import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
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

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8 text-[#101828]">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Order Tracking</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-slate-500">{order.pkg.name}</p>

          <div className="mt-5 rounded-2xl bg-[#eef3ff] p-4">
            <div className="text-sm text-slate-600">สถานะปัจจุบัน</div>
            <div className="mt-1 text-xl font-bold text-[#0052CC]">{getStatusLabel(order.status)}</div>
            <div className="mt-2 text-sm text-slate-600">การชำระเงิน: {getPaymentStatusLabel(order.paymentStatus)}</div>
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
