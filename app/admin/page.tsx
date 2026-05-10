import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { sendEmailOutboxItem } from '@/lib/actions';
import {
  getEmailActionLabel,
  getEmailStatusLabel,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel
} from '@/lib/status-labels';

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

function getEmailStatusStyles(status: string) {
  switch (status) {
    case 'QUEUED':
      return 'bg-sky-50 text-sky-700 ring-sky-200';
    case 'SENT':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'ERROR':
    case 'MISSING_RECIPIENT':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value ?? 0);
}

function canSendEmail(status: string, recipient: string | null) {
  return Boolean(recipient) && status !== 'SENT' && status !== 'MISSING_RECIPIENT';
}

export default async function AdminPage() {
  const [orders, emailOutboxRows] = await Promise.all([
    prisma.order.findMany({
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
        },
        emailOutbox: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    }),
    prisma.emailOutbox.findMany({
      take: 50,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        order: {
          include: {
            pkg: true
          }
        }
      }
    })
  ]);
  const emailOutbox = emailOutboxRows
    .filter((email, index, rows) => {
      const dedupeKey = email.orderId ?? email.id;
      return rows.findIndex((row) => (row.orderId ?? row.id) === dedupeKey) === index;
    })
    .slice(0, 20);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Order Monitor</p>
        <h2 className="text-3xl font-bold tracking-tight text-white">ติดตามคำสั่งซื้อ</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">
          ใช้สำหรับดูสถานะออเดอร์ คิวอีเมลบริษัทประกัน และเปิด Magic Link ให้บริษัทประกันอัปเดตสถานะกรมธรรม์
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">รายการออเดอร์ล่าสุด</h3>
              <p className="text-sm text-slate-500">ตรวจสอบลูกค้า รถ แพ็กเกจ การชำระเงิน และสถานะการส่งอีเมล</p>
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
                <th className="px-5 py-4 sm:px-6">ออเดอร์</th>
                <th className="px-5 py-4 sm:px-6">ลูกค้า / รถ</th>
                <th className="px-5 py-4 sm:px-6">แพ็กเกจ</th>
                <th className="px-5 py-4 sm:px-6">การชำระเงิน</th>
                <th className="px-5 py-4 sm:px-6">สถานะ</th>
                <th className="px-5 py-4 sm:px-6">อีเมล</th>
                <th className="px-5 py-4 sm:px-6 text-right">Magic Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={7}>
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
                        ติดตามออเดอร์
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
                      <div className="font-medium text-slate-900">{getPaymentMethodLabel(order.paymentMethod)}</div>
                      <div className="mt-1 text-sm text-slate-500">{getPaymentStatusLabel(order.paymentStatus)}</div>
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
                        {getOrderStatusLabel(order.status)}
                      </span>
                      {order.statusHistory[0]?.message ? (
                        <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">{order.statusHistory[0].message}</div>
                      ) : null}
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      {order.emailOutbox[0] ? (
                        <>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEmailStatusStyles(order.emailOutbox[0].status)}`}>
                            {getEmailStatusLabel(order.emailOutbox[0].status)}
                          </span>
                          <div className="mt-2 max-w-xs text-xs leading-5 text-slate-500">
                            {order.emailOutbox[0].recipient ?? 'ยังไม่มีอีเมลผู้รับ'}
                          </div>
                        </>
                      ) : order.pkg.providerEmail ? (
                        <span className="text-xs text-slate-500">ยังไม่เข้าคิวส่ง</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                          ยังไม่มีอีเมลผู้รับ
                        </span>
                      )}
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

      <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">คิวอีเมลบริษัทประกัน</h3>
              <p className="text-sm text-slate-500">รายการอีเมลล่าสุดที่สร้างจาก checkout และ Magic Link preview</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
              {emailOutbox.length} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4 sm:px-6">สร้างเมื่อ</th>
                <th className="px-5 py-4 sm:px-6">ออเดอร์</th>
                <th className="px-5 py-4 sm:px-6">ผู้รับ</th>
                <th className="px-5 py-4 sm:px-6">หัวข้อ</th>
                <th className="px-5 py-4 sm:px-6">สถานะ</th>
                <th className="px-5 py-4 sm:px-6 text-right">คำสั่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {emailOutbox.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={6}>
                    ยังไม่มีรายการอีเมลบริษัทประกัน
                  </td>
                </tr>
              ) : (
                emailOutbox.map((email) => (
                  <tr key={email.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-5 text-sm text-slate-500 sm:px-6">
                      {new Date(email.createdAt).toLocaleString('th-TH')}
                    </td>
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-semibold text-slate-900">{email.order?.orderNumber ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{email.order?.pkg.company ?? '-'}</div>
                    </td>
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{email.recipient ?? '-'}</div>
                      {email.errorMessage ? (
                        <div className="mt-1 max-w-xs text-xs leading-5 text-rose-600">{email.errorMessage}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-sm text-slate-700 sm:px-6">{email.subject}</td>
                    <td className="px-5 py-5 sm:px-6">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getEmailStatusStyles(email.status)}`}>
                        {getEmailStatusLabel(email.status)}
                      </span>
                      {email.sentAt ? (
                        <div className="mt-1 text-xs text-slate-500">
                          ส่งเมื่อ {new Date(email.sentAt).toLocaleString('th-TH')}
                        </div>
                      ) : null}
                      {email.status === 'MISSING_RECIPIENT' ? (
                        <div className="mt-1 max-w-xs text-xs leading-5 text-rose-600">
                          เพิ่มอีเมลบริษัทประกันในหน้า Insurance Campaigns ก่อนส่ง
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-right sm:px-6">
                      {canSendEmail(email.status, email.recipient) ? (
                        <form action={sendEmailOutboxItem}>
                          <input type="hidden" name="emailOutboxId" value={email.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                          >
                            {getEmailActionLabel(email.status)}
                          </button>
                        </form>
                      ) : email.status === 'SENT' ? (
                        <span className="text-xs font-semibold text-emerald-700">เรียบร้อย</span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">ส่งไม่ได้</span>
                      )}
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
