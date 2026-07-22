import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { uploadOrderDocumentsFromAdmin } from '@/lib/actions';
import {
  getEmailStatusLabel,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getStatusHistoryMessageLabel
} from '@/lib/status-labels';

type AdminOrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

const orderProgressSteps = [
  { status: 'PENDING_PAYMENT', label: 'รอชำระ' },
  { status: 'PAYMENT_SUBMITTED', label: 'ส่งหลักฐาน' },
  { status: 'SENT_TO_INSURER', label: 'ส่งบริษัท' },
  { status: 'POLICY_APPROVED', label: 'อนุมัติ' },
  { status: 'POLICY_ISSUED', label: 'ออกกรมธรรม์' }
];

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function formatDateTime(value: Date | null | undefined) {
  return value ? value.toLocaleString('th-TH') : '-';
}

function getOrderDocumentLabel(documentType: string) {
  if (documentType === 'POLICY') return 'กรมธรรม์';
  if (documentType === 'ENDORSEMENT') return 'เอกสารสลักหลัง';
  return 'เอกสารประกอบ';
}

function getOrderProgressIndex(status: string) {
  if (status === 'PAID') return 1;
  if (status === 'INSURER_REVIEWING') return 2;

  const index = orderProgressSteps.findIndex((step) => step.status === status);
  return index >= 0 ? index : -1;
}

function getOrderProgressStepStyles(index: number, activeIndex: number, status: string) {
  if (status === 'REJECTED' || status === 'CANCELLED') {
    return index <= Math.max(activeIndex, 0)
      ? 'bg-rose-500 text-white'
      : 'bg-slate-200 text-slate-400';
  }

  if (index < activeIndex) return 'bg-emerald-500 text-white';
  if (index === activeIndex) return 'bg-cyan-600 text-white';
  return 'bg-slate-200 text-slate-400';
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value || '-'}</div>
    </div>
  );
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { orderId } = await params;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      pkg: true,
      statusHistory: {
        orderBy: {
          createdAt: 'desc'
        }
      },
      emailOutbox: {
        orderBy: {
          createdAt: 'desc'
        }
      },
      magicLinks: {
        orderBy: {
          createdAt: 'desc'
        }
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

  const activeIndex = getOrderProgressIndex(order.status);
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const vehicle = [order.carBrand, order.carModel, order.carCubicCapacity, order.carYear].filter(Boolean).join(' / ') || '-';
  const plate = [order.plateNumber, order.plateProvince].filter(Boolean).join(' ') || '-';
  const customerAddress = [order.customerAddress, order.subDistrict, order.district, order.province, order.postalCode]
    .filter(Boolean)
    .join(' ') || '-';
  const deliveryAddress =
    order.deliveryAddressMode === 'other'
      ? [order.deliveryRecipientName, order.deliveryRecipientPhone, order.deliveryAddress].filter(Boolean).join(' / ')
      : customerAddress;

  return (
    <section className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Order Detail</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">{order.orderNumber}</h2>
          <p className="mt-2 text-sm text-slate-300">สร้างเมื่อ {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="inline-flex rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            กลับหน้าออเดอร์
          </Link>
          <Link
            href={`/admin/orders/${order.id}/email-preview`}
            className="inline-flex rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            เปิด Magic Link
          </Link>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold">สถานะคำสั่งซื้อ</h3>
                <p className="mt-1 text-sm text-slate-500">{getOrderStatusLabel(order.status)}</p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                {getPaymentStatusLabel(order.paymentStatus)}
              </span>
            </div>
            <div className="mt-5 grid grid-cols-5 gap-3">
              {orderProgressSteps.map((step, index) => (
                <div key={step.status} className="text-center">
                  <div
                    className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${getOrderProgressStepStyles(
                      index,
                      activeIndex,
                      order.status
                    )}`}
                  >
                    {index + 1}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-slate-600">{step.label}</div>
                </div>
              ))}
            </div>
            {order.status === 'REJECTED' || order.status === 'CANCELLED' ? (
              <div className="mt-5 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">
                คำสั่งซื้อนี้สิ้นสุดแล้ว
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">ข้อมูลลูกค้าและรถ</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <InfoItem label="ชื่อลูกค้า" value={customerName} />
              <InfoItem label="เบอร์โทร" value={customerPhone} />
              <InfoItem label="อีเมล" value={order.customerEmail ?? order.user.email ?? '-'} />
              <InfoItem label="เลขบัตรประชาชน" value={order.idCardNumber ?? '-'} />
              <InfoItem label="รถยนต์" value={vehicle} />
              <InfoItem label="ทะเบียน" value={plate} />
              <InfoItem label="เลขตัวถัง" value={order.chassisNumber ?? '-'} />
              <InfoItem label="เริ่มคุ้มครองภาคสมัครใจ" value={formatDateTime(order.policyStartDate)} />
              {order.ctpSelected ? <InfoItem label="เริ่มคุ้มครอง พ.ร.บ." value={formatDateTime(order.ctpPolicyStartDate)} /> : null}
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                <div className="text-xs font-semibold text-slate-500">ที่อยู่ผู้เอาประกัน</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{customerAddress}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                <div className="text-xs font-semibold text-slate-500">ที่อยู่จัดส่งกรมธรรม์</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{deliveryAddress || '-'}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2 xl:col-span-3">
                <div className="text-xs font-semibold text-slate-500">เอกสารรถ / กรมธรรม์</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.vehicleDocumentUrl ? (
                    <a
                      href={order.vehicleDocumentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                    >
                      เปิด{order.vehicleDocumentType ?? 'เอกสารรถ'}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-500">ยังไม่มีเอกสารรถ</span>
                  )}
                  {order.documents.length > 0 ? (
                    order.documents.map((document) => (
                      <a
                        key={document.id}
                        href={document.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                      >
                        เปิด{getOrderDocumentLabel(document.documentType)}: {document.fileName}
                      </a>
                    ))
                  ) : order.policyPdfUrl ? (
                    <a
                      href={order.policyPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      เปิด PDF กรมธรรม์
                    </a>
                  ) : null}
                </div>
                {order.policyNumber ? <div className="mt-2 text-sm font-semibold text-slate-700">เลขกรมธรรม์: {order.policyNumber}</div> : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">แพ็กเกจและการชำระเงิน</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <InfoItem label="แพ็กเกจ" value={order.pkg.name} />
              <InfoItem label="บริษัทประกัน" value={order.pkg.providerName ?? order.pkg.company} />
              <InfoItem label="ประเภทซ่อม" value={order.pkg.repairType ?? '-'} />
              <InfoItem label="ความคุ้มครอง" value={order.pkg.coverage ?? '-'} />
              {order.ctpSelected ? (
                <InfoItem label="พ.ร.บ." value={`${order.ctpRateCode ?? '-'} / ${formatCurrency(order.ctpTotal)}`} />
              ) : null}
              <InfoItem label="ยอดชำระ" value={formatCurrency(order.paymentAmount ?? order.pkg.netPrice)} />
              <InfoItem label="วิธีชำระเงิน" value={getPaymentMethodLabel(order.paymentMethod)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.slipUrl ? (
                <a
                  href={order.slipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  เปิดสลิปชำระเงิน
                </a>
              ) : null}
              {order.gatewayUrl ? (
                <a
                  href={order.gatewayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                >
                  เปิดลิงก์ชำระเงิน
                </a>
              ) : null}
              {order.cardAuthorizationFormUrl ? (
                <a
                  href={order.cardAuthorizationFormUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  เปิดแบบฟอร์มตัดบัตร
                </a>
              ) : null}
              {order.cardFrontImageUrl ? (
                <a
                  href={order.cardFrontImageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white"
                >
                  เปิดรูปหน้าบัตรเครดิต
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">แนบเอกสารกรมธรรม์</h3>
            <p className="mt-1 text-sm text-slate-500">แนบได้หลายไฟล์ เช่น กรมธรรม์ เอกสารสลักหลัง และเอกสารประกอบ</p>
            <form action={uploadOrderDocumentsFromAdmin} className="mt-4 space-y-4">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="block text-sm font-semibold text-slate-700">
                ประเภทเอกสาร
                <select name="policyDocumentType" defaultValue="POLICY" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-950">
                  <option value="POLICY">กรมธรรม์</option>
                  <option value="ENDORSEMENT">เอกสารสลักหลัง</option>
                  <option value="OTHER">เอกสารประกอบ</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                ไฟล์ PDF
                <input name="policyDocumentFiles" type="file" accept="application/pdf" multiple required className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2.5 file:font-semibold file:text-white" />
              </label>
              <button className="w-full rounded-xl bg-cyan-600 px-4 py-3 font-semibold text-white" type="submit">แนบเอกสาร</button>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">บริษัทประกัน</h3>
            <div className="mt-4 space-y-3 text-sm">
              <InfoItem label="ผู้รับอีเมล" value={order.pkg.providerEmail ?? '-'} />
              <InfoItem label="ผู้ติดต่อ" value={order.pkg.providerContactName ?? '-'} />
              <InfoItem label="เบอร์บริษัทประกัน" value={order.pkg.providerPhone ?? '-'} />
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">Email Outbox</h3>
            <div className="mt-4 space-y-3">
              {order.emailOutbox.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีรายการอีเมล</p>
              ) : (
                order.emailOutbox.map((email) => (
                  <div key={email.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{getEmailStatusLabel(email.status)}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(email.createdAt)}</span>
                    </div>
                    <div className="mt-1 text-slate-600">{email.recipient ?? '-'}</div>
                    {email.errorMessage ? <div className="mt-2 text-rose-600">{email.errorMessage}</div> : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
            <h3 className="text-lg font-bold">Timeline ภายใน</h3>
            <div className="mt-4 space-y-3">
              {order.statusHistory.length === 0 ? (
                <p className="text-sm text-slate-500">ยังไม่มีประวัติสถานะ</p>
              ) : (
                order.statusHistory.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-950">{getOrderStatusLabel(item.status)}</span>
                      <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                    </div>
                    {item.message ? (
                      <p className="mt-1 text-slate-600">{getStatusHistoryMessageLabel(item.message)}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">
                      {item.actorType}
                      {item.actorName ? ` · ${item.actorName}` : ''}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
