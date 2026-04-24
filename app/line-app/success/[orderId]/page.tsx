import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

type SuccessPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderSuccessPage({ params }: SuccessPageProps) {
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

  const receiptOrder = order as typeof order & {
    plateNumber: string | null;
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="overflow-hidden rounded-[28px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200">
          <div className="bg-gradient-to-r from-brand-600 to-cyan-500 px-6 py-6 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/80">
                  Receipt
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">สั่งซื้อสำเร็จ</h1>
              </div>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-2xl backdrop-blur">
                ✓
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/85">
              ระบบได้สร้างรายการสั่งซื้อและบันทึกข้อมูลเรียบร้อยแล้ว
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
              <span>Order Detail</span>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                {order.status}
              </span>
            </div>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <dl className="space-y-4">
              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">เลขคำสั่งซื้อ</dt>
                <dd className="text-right text-sm font-semibold tracking-wide text-slate-900">
                  {receiptOrder.orderNumber}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">แพ็กเกจประกัน</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">
                  {receiptOrder.pkg.name}
                </dd>
              </div>

              <div className="flex items-start justify-between gap-6">
                <dt className="text-sm text-slate-500">เลขทะเบียนรถ</dt>
                <dd className="text-right text-sm font-semibold uppercase tracking-wide text-slate-900">
                  {receiptOrder.plateNumber ?? '-'}
                </dd>
              </div>
            </dl>

            <div className="my-5 border-t border-dashed border-slate-200" />

            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">สถานะปัจจุบัน</span>
                <span className="font-semibold text-slate-900">{receiptOrder.status}</span>
              </div>
            </div>
          </div>
        </section>

        <Link
          href="/line-app"
          className="rounded-2xl bg-brand-600 px-4 py-3 text-center font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700"
        >
          กลับไปหน้าแพ็กเกจ
        </Link>
      </div>
    </main>
  );
}
