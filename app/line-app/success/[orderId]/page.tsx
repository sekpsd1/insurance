import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { RememberTrackingOrder } from '@/app/line-app/_components/tracking-order-memory';
import {
  getPaymentMethodLabel,
  getStatusHistoryMessageLabel,
  isCustomerVisibleStatusHistory
} from '@/lib/status-labels';

type SuccessPageProps = {
  params: Promise<{ orderId: string }>;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function getOrderDocumentLabel(documentType: string) {
  if (documentType === 'POLICY') return 'กรมธรรม์';
  if (documentType === 'ENDORSEMENT') return 'เอกสารสลักหลัง';
  return 'เอกสารประกอบ';
}

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

export default async function OrderSuccessPage({ params }: SuccessPageProps) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      pkg: true,
      statusHistory: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 4
      },
      documents: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  if (!order) {
    notFound();
  }

  const visibleStatusHistory = order.statusHistory.filter(isCustomerVisibleStatusHistory);

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8 text-[#101828]">
      <RememberTrackingOrder orderNumber={order.orderNumber} />
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200">
          <div className="bg-[#0052CC] px-6 py-6 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">Payment Success</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">รับคำสั่งซื้อเรียบร้อย</h1>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-2xl font-bold">
                ✓
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/85">
              ระบบบันทึกข้อมูลแล้ว คุณสามารถใช้เลขคำสั่งซื้อนี้เพื่อติดตามสถานะได้ตลอดเวลา
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
              <span>Order Detail</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                {getStatusLabel(order.status)}
              </span>
            </div>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <dl className="space-y-4">
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">เลขที่คำสั่งซื้อ</dt>
                <dd className="text-right text-sm font-semibold tracking-wide text-slate-900">{order.orderNumber}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">แพ็กเกจประกัน</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{order.pkg.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">ผู้เอาประกัน</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{order.customerName ?? '-'}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">ทะเบียนรถ</dt>
                <dd className="text-right text-sm font-semibold uppercase tracking-wide text-slate-900">{order.plateNumber ?? '-'}</dd>
              </div>
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">ยอดชำระ</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{formatCurrency(order.paymentAmount)}</dd>
              </div>
              {order.ctpSelected ? (
                <div className="flex items-start justify-between gap-6">
                  <dt className="text-sm text-slate-500">พ.ร.บ.</dt>
                  <dd className="text-right text-sm font-semibold text-slate-900">
                    {order.ctpRateCode ?? '-'} / {formatCurrency(order.ctpTotal)}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">วิธีชำระเงิน</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">
                  {getPaymentMethodLabel(order.paymentMethod)}
                </dd>
              </div>
            </dl>

            {order.gatewayUrl ? (
              <a
                href={order.gatewayUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 font-semibold text-white"
              >
                เปิดลิงก์ชำระเงิน
              </a>
            ) : null}
          </div>
        </section>

        {order.documents.length > 0 || order.policyPdfUrl ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-emerald-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Policy PDF</p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">กรมธรรม์ของคุณ</h2>
            {order.policyNumber ? (
              <p className="mt-1 text-sm text-slate-600">เลขกรมธรรม์: {order.policyNumber}</p>
            ) : null}
            {order.documents.length > 0 ? (
              <div className="mt-4 space-y-2">
                {order.documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-emerald-600 px-4 py-3 text-left font-semibold text-white shadow-lg shadow-emerald-600/20"
                  >
                    <span>{getOrderDocumentLabel(document.documentType)}</span>
                    <span className="truncate text-sm font-medium text-white/85">{document.fileName}</span>
                  </a>
                ))}
              </div>
            ) : (
              <a
                href={order.policyPdfUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-emerald-600/20"
              >
                เปิดกรมธรรม์ PDF
              </a>
            )}
          </section>
        ) : null}

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-bold text-slate-950">Timeline ล่าสุด</h2>
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

        <Link
          href={`/line-app/tracking/${order.orderNumber}`}
          className="rounded-2xl bg-[#0052CC] px-4 py-4 text-center font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0040a2]"
        >
          ติดตามสถานะคำสั่งซื้อ
        </Link>
        <Link href="/line-app/menu" className="rounded-2xl bg-white px-4 py-3 text-center font-semibold text-[#0052CC] ring-1 ring-blue-100">
          กลับไปเมนู
        </Link>
      </div>
    </main>
  );
}
