import { prisma } from '@/lib/prisma';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';

type FormPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lineId?: string }>;
};

function formatOrderNumber(date = new Date()) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `IN-${ymd}-${suffix}`;
}

export async function generateMetadata({ params }: FormPageProps): Promise<Metadata> {
  const { id } = await params;
  const pkg = await prisma.insurancePackage.findUnique({
    where: { id }
  });

  return {
    title: pkg ? `${pkg.name} | LINE Mini App` : 'LINE Mini App'
  };
}

export default async function PackageFormPage({ params, searchParams }: FormPageProps) {
  const { id: packageId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const packageItem = await prisma.insurancePackage.findUnique({
    where: { id: packageId }
  });

  if (!packageItem) {
    notFound();
  }

  const selectedPackage = packageItem as NonNullable<typeof packageItem>;

  const lineId =
    resolvedSearchParams.lineId?.trim() ||
    process.env.DEMO_LINE_ID?.trim() ||
    `demo-${packageId}`;

  async function createOrder(formData: FormData) {
    'use server';

    const name = String(formData.get('name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const plateNumber = String(formData.get('plateNumber') ?? '').trim();
    const submittedLineId = String(formData.get('lineId') ?? lineId).trim();

    if (!name || !phone || !plateNumber) {
      throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน');
    }

    const user = await prisma.user.upsert({
      where: {
        lineId: submittedLineId
      },
      create: {
        lineId: submittedLineId,
        name,
        phone
      },
      update: {
        name,
        phone
      }
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: formatOrderNumber(),
        status: 'PENDING',
        user: {
          connect: {
            id: user.id
          }
        },
        pkg: {
          connect: {
            id: selectedPackage.id
          }
        },
        plateNumber
      }
    });

    redirect(`/line-app/success/${order.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-5">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">
            Selected Package
          </p>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
            {selectedPackage.name}
          </h1>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>{selectedPackage.company}</span>
            <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
              {selectedPackage.netPrice.toLocaleString()} ฿
            </span>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">กรอกข้อมูลผู้เอาประกัน</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              ใช้ข้อมูลนี้เพื่อสร้างรายการสั่งซื้อและเชื่อมต่อกับลูกค้าในระบบ
            </p>
          </div>

          <form action={createOrder} className="space-y-4">
            <input type="hidden" name="lineId" value={lineId} />

            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">
                ชื่อ-นามสกุล
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="เช่น สมชาย ใจดี"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
                เบอร์โทรศัพท์
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="08x-xxx-xxxx"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                required
              />
            </div>

            <div>
              <label htmlFor="plateNumber" className="mb-1 block text-sm font-medium text-slate-700">
                เลขทะเบียนรถยนต์
              </label>
              <input
                id="plateNumber"
                name="plateNumber"
                type="text"
                autoComplete="off"
                placeholder="เช่น 1กข 1234"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] uppercase outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
                required
              />
            </div>

            <button
              type="submit"
              className="mt-2 w-full rounded-2xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 active:scale-[0.99]"
            >
              ยืนยันและสั่งซื้อ
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
