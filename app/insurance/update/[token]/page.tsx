import { createHash } from 'crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { updateOrderFromMagicLink } from '@/lib/actions';

type InsurerUpdatePageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ updated?: string }>;
};

function hashMagicToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PAYMENT_SUBMITTED: 'ลูกค้าส่งหลักฐานชำระเงินแล้ว',
    PAID: 'ชำระเงินแล้ว',
    SENT_TO_INSURER: 'ส่งให้บริษัทประกันแล้ว',
    INSURER_REVIEWING: 'กำลังตรวจสอบ',
    POLICY_APPROVED: 'อนุมัติกรมธรรม์แล้ว',
    POLICY_ISSUED: 'ออกกรมธรรม์แล้ว',
    REJECTED: 'ไม่อนุมัติ'
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

export default async function InsurerUpdatePage({ params, searchParams }: InsurerUpdatePageProps) {
  const { token } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: {
      tokenHash: hashMagicToken(decodeURIComponent(token))
    },
    include: {
      order: {
        include: {
          user: true,
          pkg: true,
          statusHistory: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          }
        }
      }
    }
  });

  if (!magicToken || magicToken.expiresAt < new Date()) {
    notFound();
  }

  const order = magicToken.order;

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8 text-[#101828]">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Insurance Provider</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">อัปเดตสถานะกรมธรรม์</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            ลิงก์นี้ใช้สำหรับเจ้าหน้าที่บริษัทประกันอัปเดตสถานะกลับมายังระบบโดยตรง
          </p>

          {resolvedSearchParams.updated ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
              บันทึกสถานะเรียบร้อยแล้ว ระบบจำลองการแจ้งอีเมลถึง broker และ LINE ถึงลูกค้าแล้ว
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">เลขที่คำสั่งซื้อ</div>
              <div className="mt-1 font-semibold text-slate-950">{order.orderNumber}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">สถานะปัจจุบัน</div>
              <div className="mt-1 font-semibold text-slate-950">{getStatusLabel(order.status)}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">ผู้เอาประกัน</div>
              <div className="mt-1 font-semibold text-slate-950">{order.customerName ?? order.user.name ?? '-'}</div>
              <div className="mt-1 text-slate-600">{order.customerPhone ?? order.user.phone ?? '-'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">รถยนต์</div>
              <div className="mt-1 font-semibold text-slate-950">{[order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / ') || '-'}</div>
              <div className="mt-1 text-slate-600">{order.plateNumber ?? '-'} {order.plateProvince ? `(${order.plateProvince})` : ''}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <div className="text-slate-500">แพ็กเกจ</div>
              <div className="mt-1 font-semibold text-slate-950">{order.pkg.name}</div>
              <div className="mt-1 text-slate-600">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">อัปเดตกลับมายังระบบ</h2>
          <form action={updateOrderFromMagicLink} className="mt-5 space-y-4">
            <input type="hidden" name="token" value={decodeURIComponent(token)} />

            <div>
              <label htmlFor="actorName" className="mb-1 block text-sm font-semibold text-slate-700">
                ชื่อเจ้าหน้าที่
              </label>
              <input
                id="actorName"
                name="actorName"
                type="text"
                placeholder="เช่น คุณสมชาย"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-semibold text-slate-700">
                สถานะ
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue="INSURER_REVIEWING"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="INSURER_REVIEWING">รับเรื่อง / กำลังตรวจสอบ</option>
                <option value="POLICY_APPROVED">อนุมัติกรมธรรม์แล้ว</option>
                <option value="POLICY_ISSUED">ออกกรมธรรม์แล้ว</option>
                <option value="REJECTED">ไม่อนุมัติ / ขอปฏิเสธ</option>
              </select>
            </div>

            <div>
              <label htmlFor="insurerNote" className="mb-1 block text-sm font-semibold text-slate-700">
                ข้อความเพิ่มเติม
              </label>
              <textarea
                id="insurerNote"
                name="insurerNote"
                rows={5}
                placeholder="เช่น อนุมัติแล้ว รอจัดส่งกรมธรรม์ภายใน 1 วันทำการ"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#0052CC] px-4 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0040a2]"
            >
              บันทึกและแจ้งลูกค้า
            </button>
          </form>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="font-bold text-slate-950">Timeline ล่าสุด</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {order.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-500">ยังไม่มีประวัติสถานะ</p>
            ) : (
              order.statusHistory.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-950">{getStatusLabel(item.status)}</div>
                    <div className="text-xs text-slate-500">{item.createdAt.toLocaleString('th-TH')}</div>
                  </div>
                  {item.message ? <p className="mt-1 text-sm text-slate-600">{item.message}</p> : null}
                </div>
              ))
            )}
          </div>
          <Link href={`/line-app/tracking/${order.orderNumber}`} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
            ดูหน้าติดตามสถานะลูกค้า
          </Link>
        </section>
      </div>
    </main>
  );
}
