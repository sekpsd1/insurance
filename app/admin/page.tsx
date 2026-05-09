import Link from 'next/link';
import { prisma } from '@/lib/prisma';

function getStatusStyles(status: string) {
  switch (status) {
    case 'POLICY_ISSUED':
    case 'POLICY_APPROVED':
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'REJECTED':
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'PAYMENT_SUBMITTED':
    case 'INSURER_REVIEWING':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'ร่างคำสั่งซื้อ',
    PENDING_PAYMENT: 'รอชำระเงิน',
    PAYMENT_SUBMITTED: 'ส่งสลิปแล้ว',
    PENDING: 'รอตรวจสอบ',
    APPROVED: 'อนุมัติแล้ว',
    PAID: 'ชำระเงินแล้ว',
    SENT_TO_INSURER: 'ส่งบริษัทประกัน',
    INSURER_REVIEWING: 'บริษัทประกันตรวจสอบ',
    POLICY_APPROVED: 'อนุมัติกรมธรรม์',
    POLICY_ISSUED: 'ออกกรมธรรม์แล้ว',
    REJECTED: 'ไม่อนุมัติ',
    CANCELLED: 'ยกเลิก'
  };

  return labels[status] ?? status;
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

export default async function AdminPage() {
  const orders = await prisma.order.findMany({
    take: 30,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: true,
      pkg: true,
      statusHistory: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      }
    }
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Order Monitor</p>
        <h2 className="text-3xl font-bold tracking-tight text-white">ติดตามคำสั่งซื้อ</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">
          หน้านี้ใช้ดูสถานะออเดอร์และเปิดอีเมล Magic Link สำหรับบริษัทประกัน ส่วนการอัปเดตสถานะหลักจะให้บริษัทประกันทำผ่านลิงก์
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">รายการออเดอร์ล่าสุด</h3>
              <p className="text-sm text-slate-500">แอดมินเป็นผู้ดูแลข้อมูลประกันและ monitor งาน</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
              {orders.length} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4 sm:px-6">Order</th>
                <th className="px-5 py-4 sm:px-6">Customer / Car</th>
                <th className="px-5 py-4 sm:px-6">Package</th>
                <th className="px-5 py-4 sm:px-6">Payment</th>
                <th className="px-5 py-4 sm:px-6">Status</th>
                <th className="px-5 py-4 sm:px-6 text-right">Magic Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                    ยังไม่มีออเดอร์ในระบบ
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-semibold text-slate-900">{order.orderNumber}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString('th-TH')}</div>
                      <Link href={`/line-app/tracking/${order.orderNumber}`} className="mt-2 inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                        Tracking
                      </Link>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.customerName ?? order.user.name ?? '-'}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.customerPhone ?? order.user.phone ?? '-'}</div>
                      <div className="mt-2 text-sm uppercase tracking-wide text-slate-700">
                        {order.plateNumber ?? '-'} {order.plateProvince ? `(${order.plateProvince})` : ''}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {[order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / ') || '-'}
                      </div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.pkg.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.pkg.company}</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">
                        {order.paymentMethod === 'BANK_TRANSFER' ? 'โอนเงิน' : order.paymentMethod === 'CARD_GATEWAY' ? 'Gateway' : '-'}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{order.paymentStatus}</div>
                      {order.slipUrl ? (
                        <a
                          href={order.slipUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 ring-1 ring-cyan-100"
                        >
                          ดูสลิป
                        </a>
                      ) : null}
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyles(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.statusHistory[0]?.message ? (
                        <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{order.statusHistory[0].message}</div>
                      ) : null}
                    </td>

                    <td className="px-5 py-5 text-right sm:px-6">
                      <Link
                        href={`/admin/orders/${order.id}/email-preview`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        เปิดอีเมลบริษัทประกัน
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
