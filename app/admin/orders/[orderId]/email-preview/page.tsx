import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createInsurerMagicLinkPreview } from '@/lib/actions';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@/lib/status-labels';

type EmailPreviewPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export default async function InsurerEmailPreviewPage({ params, searchParams }: EmailPreviewPageProps) {
  const { orderId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = resolvedSearchParams.token?.trim();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      pkg: true
    }
  });

  if (!order) {
    notFound();
  }

  const magicLinkPath = token ? `/insurance/update/${encodeURIComponent(token)}` : '';

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Provider Email</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">ตัวอย่างอีเมลถึงบริษัทประกัน</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          ใน production ระบบจะส่งอีเมลนี้อัตโนมัติหลังลูกค้ายืนยันออเดอร์ พร้อม Magic Link สำหรับอัปเดตสถานะ
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
          <div className="border-b border-slate-200 pb-5">
            <div className="text-sm text-slate-500">
              ถึง: {order.pkg.providerEmail || 'ยังไม่ได้กำหนดอีเมลบริษัทประกัน'}
            </div>
            <h3 className="mt-2 text-2xl font-bold">คำขอออกกรมธรรม์ใหม่ #{order.orderNumber}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              กรุณาตรวจสอบรายละเอียดคำสั่งซื้อและกด Magic Link เพื่ออัปเดตสถานะกลับมายังระบบ
            </p>
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">บริษัทประกัน</dt>
              <dd className="mt-1 font-semibold">{order.pkg.providerName || order.pkg.company}</dd>
              <dd className="mt-1 text-slate-600">{order.pkg.providerContactName || '-'}</dd>
              <dd className="mt-1 text-slate-600">{order.pkg.providerPhone || '-'}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">ผู้เอาประกัน</dt>
              <dd className="mt-1 font-semibold">{order.customerName ?? order.user.name ?? '-'}</dd>
              <dd className="mt-1 text-slate-600">{order.customerPhone ?? order.user.phone ?? '-'}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <dt className="text-slate-500">รถยนต์</dt>
              <dd className="mt-1 font-semibold">{[order.carBrand, order.carModel, order.carCubicCapacity, order.carYear].filter(Boolean).join(' / ') || '-'}</dd>
              <dd className="mt-1 text-slate-600">{order.plateNumber ?? '-'} {order.plateProvince ? `(${order.plateProvince})` : ''}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <dt className="text-slate-500">แพ็กเกจ</dt>
              <dd className="mt-1 font-semibold">{order.pkg.name}</dd>
              <dd className="mt-1 text-slate-600">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</dd>
              {order.ctpSelected ? (
                <dd className="mt-1 text-slate-600">พ.ร.บ. {order.ctpRateCode ?? '-'}: {formatCurrency(order.ctpTotal)}</dd>
              ) : null}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <dt className="text-slate-500">การชำระเงิน</dt>
              <dd className="mt-1 font-semibold">{getPaymentMethodLabel(order.paymentMethod)}</dd>
              <dd className="mt-1 text-slate-600">{getPaymentStatusLabel(order.paymentStatus)}</dd>
            </div>
          </dl>

          {!order.pkg.providerEmail ? (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              ยังไม่ได้ตั้งค่า provider email สำหรับ campaign/package นี้ ให้ไปกรอกที่หน้า Insurance Campaigns ก่อนส่งจริง
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl bg-blue-50 p-5">
            <div className="font-semibold text-blue-950">Magic Link สำหรับบริษัทประกัน</div>
            {token ? (
              <>
                <p className="mt-2 break-all text-sm text-blue-800">http://localhost:3000{magicLinkPath}</p>
                <Link
                  href={magicLinkPath}
                  target="_blank"
                  className="mt-4 inline-flex rounded-xl bg-[#0052CC] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0040a2]"
                >
                  เปิดหน้าอัปเดตสถานะ
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-blue-800">ยังไม่ได้สร้าง token สำหรับ preview รอบนี้</p>
            )}
          </div>
        </article>

        <aside className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-2xl shadow-black/10">
          <h3 className="text-lg font-semibold">เครื่องมือทดสอบ</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            กดสร้าง Magic Link เพื่อจำลองอีเมลที่ระบบจะส่งให้บริษัทประกัน ในระบบจริง action นี้จะเกิดหลัง checkout อัตโนมัติ
          </p>
          <form action={createInsurerMagicLinkPreview} className="mt-5">
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              สร้าง Magic Link
            </button>
          </form>
          <Link href="/admin" className="mt-3 flex w-full justify-center rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
            กลับหน้าออเดอร์
          </Link>
        </aside>
      </div>
    </section>
  );
}
