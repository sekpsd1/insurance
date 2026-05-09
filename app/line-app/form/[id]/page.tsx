import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createPolicyDraftOrder } from '@/lib/actions';

type FormPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lineId?: string }>;
};

export async function generateMetadata({ params }: FormPageProps): Promise<Metadata> {
  const { id } = await params;
  const pkg = await prisma.insurancePackage.findUnique({
    where: { id }
  });

  return {
    title: pkg ? `${pkg.name} | Policy Info` : 'Policy Info'
  };
}

function Field({
  label,
  name,
  placeholder,
  type = 'text',
  required = true,
  multiline = false,
  inputMode
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  inputMode?: 'text' | 'tel' | 'numeric';
}) {
  const baseClass =
    'w-full rounded-lg border-0 bg-[#dedfe8] px-5 text-[16px] font-semibold text-slate-900 outline-none placeholder:text-[#777b89] focus:bg-white focus:ring-4 focus:ring-blue-100';

  return (
    <div>
      <label htmlFor={name} className="mb-3 block text-[15px] font-bold text-[#2f3442]">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={4}
          placeholder={placeholder}
          required={required}
          className={`${baseClass} min-h-[116px] py-4 leading-7`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          className={`${baseClass} h-[76px] py-4`}
        />
      )}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children
}: {
  icon: 'person' | 'car';
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] bg-white px-6 py-8 shadow-[0_18px_42px_rgba(13,35,87,0.08)] sm:px-9 sm:py-10">
      <div className="flex items-center gap-4 text-[#0648ad]">
        {icon === 'person' ? (
          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
            <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.02-8 4.5V21h16v-2.5c0-2.48-3.58-4.5-8-4.5Z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
            <path d="M18.92 6.01A2.99 2.99 0 0 0 16.08 4H7.92a2.99 2.99 0 0 0-2.84 2.01L3 12v8h3v-2h12v2h3v-8l-2.08-5.99ZM7.92 6h8.16c.43 0 .81.27.95.68L18.2 10H5.8l1.17-3.32c.14-.41.52-.68.95-.68ZM6.5 15.5A1.5 1.5 0 1 1 8 14a1.5 1.5 0 0 1-1.5 1.5Zm11 0A1.5 1.5 0 1 1 19 14a1.5 1.5 0 0 1-1.5 1.5Z" />
          </svg>
        )}
        <h2 className="text-[27px] font-black leading-none tracking-[-0.01em]">{title}</h2>
      </div>
      <div className="mt-7 border-t border-[#dde1ed]" />
      <div className="mt-7 space-y-6">{children}</div>
    </section>
  );
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

  const lineId =
    resolvedSearchParams.lineId?.trim() ||
    process.env.DEMO_LINE_ID?.trim() ||
    `demo-${packageId}`;

  return (
    <main className="min-h-screen bg-[#f4f5ff] pb-10 text-[#101828]">
      <header className="sticky top-0 z-10 bg-[#0648ad] text-white shadow-sm">
        <div className="mx-auto flex h-[102px] max-w-md items-center justify-center px-7">
          <Link
            href="/line-app"
            aria-label="กลับ"
            className="absolute left-7 flex h-11 w-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19 8 12l7-7" />
            </svg>
          </Link>
          <h1 className="text-center text-[27px] font-black leading-tight tracking-[-0.01em]">กรอกข้อมูลผู้เอาประกัน</h1>
        </div>
      </header>

      <form action={createPolicyDraftOrder} className="mx-auto flex max-w-md flex-col gap-8 px-4 pt-7 sm:gap-11 sm:px-7">
        <input type="hidden" name="packageId" value={packageItem.id} />
        <input type="hidden" name="lineId" value={lineId} />
        <input type="hidden" name="carBrand" value={packageItem.brand ?? ''} />
        <input type="hidden" name="carModel" value={packageItem.model ?? ''} />
        <input type="hidden" name="carYear" value={packageItem.year ?? ''} />

        <SectionCard icon="person" title="ข้อมูลส่วนตัว">
          <Field label="ชื่อ - นามสกุล" name="customerName" placeholder="ระบุชื่อและนามสกุลตามบัตรประชาชน" />
          <Field label="เบอร์โทรศัพท์" name="customerPhone" placeholder="08X-XXX-XXXX" type="tel" inputMode="tel" />
          <Field
            label="ที่อยู่สำหรับจัดส่งเอกสาร"
            name="customerAddress"
            placeholder="บ้านเลขที่, ซอย, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
            multiline
          />
        </SectionCard>

        <SectionCard icon="car" title="ข้อมูลรถยนต์">
          <Field label="ทะเบียนรถ" name="plateNumber" placeholder="เช่น กค 1234" />
          <div>
            <label htmlFor="plateProvince" className="mb-3 block text-[15px] font-bold text-[#2f3442]">
              จังหวัดที่จดทะเบียน
            </label>
            <div className="relative">
              <select
                id="plateProvince"
                name="plateProvince"
                required
                defaultValue=""
                className="h-[76px] w-full appearance-none rounded-lg border-0 bg-[#dedfe8] px-5 pr-14 text-[16px] font-semibold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="" disabled>
                  เลือกจังหวัด
                </option>
                {[
                  'กรุงเทพมหานคร',
                  'กระบี่',
                  'กาญจนบุรี',
                  'ขอนแก่น',
                  'ชลบุรี',
                  'เชียงใหม่',
                  'นครราชสีมา',
                  'นนทบุรี',
                  'ปทุมธานี',
                  'พระนครศรีอยุธยา',
                  'ภูเก็ต',
                  'ระยอง',
                  'สงขลา',
                  'สมุทรปราการ',
                  'สุราษฎร์ธานี'
                ].map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-5 top-1/2 h-8 w-8 -translate-y-1/2 text-[#4f5564]" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </SectionCard>

        <button
          type="submit"
          className="mt-7 h-[78px] rounded-xl bg-[#0648ad] px-4 text-[20px] font-black text-white shadow-[0_8px_18px_rgba(6,72,173,0.24)] transition hover:bg-[#003f98] active:scale-[0.99] sm:mt-10 sm:h-[102px] sm:text-[22px]"
        >
          ยืนยันข้อมูลและชำระเงิน
        </button>
      </form>
    </main>
  );
}
