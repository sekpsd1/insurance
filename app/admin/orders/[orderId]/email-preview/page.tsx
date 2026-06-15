import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { createInsurerMagicLinkPreview } from '@/lib/actions';
import { buildProviderEmail } from '@/lib/provider-email';

type EmailPreviewPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ token?: string }>;
};

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
  const email = buildProviderEmail({
    order,
    magicLinkPath
  });

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Provider Email</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">ตัวอย่างอีเมลแจ้งงานถึงบริษัทประกัน</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          หน้านี้แสดง subject และข้อความเดียวกับอีเมลที่ระบบส่งให้บริษัทประกันหลังลูกค้ายืนยันออเดอร์
          พร้อม Magic Link สำหรับอัปเดตสถานะกรมธรรม์
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <article className="rounded-3xl bg-white p-6 text-slate-950 shadow-2xl shadow-black/10">
          <div className="border-b border-slate-200 pb-5">
            <div className="text-sm text-slate-500">
              ถึง: {email.recipient || 'ยังไม่ได้กำหนดอีเมลบริษัทประกัน'}
            </div>
            <div className="mt-3 rounded-2xl bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Subject</div>
              <h3 className="mt-1 text-xl font-bold leading-snug">{email.subject}</h3>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email Body</div>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-800">{email.body}</pre>
          </div>

          {!email.recipient ? (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
              ยังไม่ได้ตั้งค่า provider email สำหรับ campaign/package นี้ ให้ไปกรอกที่หน้า Insurance Campaigns ก่อนส่งจริง
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl bg-blue-50 p-5">
            <div className="font-semibold text-blue-950">Magic Link สำหรับบริษัทประกัน</div>
            {token ? (
              <>
                <p className="mt-2 break-all text-sm text-blue-800">{magicLinkPath}</p>
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
