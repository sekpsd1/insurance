import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createPolicyDraftOrder } from '@/lib/actions';
import { isCtpSelected } from '@/lib/ctp';
import { getCtpOptionForSClass } from '@/lib/ctp-rates';
import { PolicyFormDraftAutosave, PolicyFormEnhancements } from './policy-form-draft-autosave';
import { ThaiAddressFields } from './thai-address-fields';

type FormPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    lineId?: string;
    sClass?: string;
    coverage?: string;
    repairType?: string;
    brand?: string;
    model?: string;
    year?: string;
    cubicCapacity?: string;
    sumInsured?: string;
    includeCtp?: string;
    formError?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'รายละเอียดแจ้งทำประกันภัย'
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
    'w-full rounded-md border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100';

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[14px] font-bold text-[#2f3442]">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          rows={4}
          placeholder={placeholder}
          required={required}
          className={`${baseClass} min-h-[78px] py-2.5 leading-6`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          inputMode={inputMode}
          placeholder={placeholder}
          required={required}
          className={`${baseClass} h-11 py-2`}
        />
      )}
    </div>
  );
}

const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม'
];

function DatePartsField({ label, name }: { label: string; name: string }) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];
  const selectClass =
    'h-11 min-w-0 appearance-none rounded-md border border-slate-200 bg-white px-2 text-center text-[13px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100';

  return (
    <div>
      <label className="mb-2 block text-[14px] font-bold text-[#2f3442]">{label}</label>
      <input type="hidden" name={name} data-date-composed={name} />
      <div className="grid grid-cols-[0.9fr_1.35fr_1fr] gap-2">
        <select data-date-part-for={name} data-date-part="day" required defaultValue="" aria-label={`${label} วัน`} className={selectClass}>
          <option value="" disabled>
            วัน
          </option>
          {Array.from({ length: 31 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0');
            return (
              <option key={day} value={day}>
                {index + 1}
              </option>
            );
          })}
        </select>
        <select data-date-part-for={name} data-date-part="month" required defaultValue="" aria-label={`${label} เดือน`} className={selectClass}>
          <option value="" disabled>
            เดือน
          </option>
          {THAI_MONTHS.map((month, index) => {
            const value = String(index + 1).padStart(2, '0');
            return (
              <option key={value} value={value}>
                {month}
              </option>
            );
          })}
        </select>
        <select data-date-part-for={name} data-date-part="year" required defaultValue="" aria-label={`${label} ปี`} className={selectClass}>
          <option value="" disabled>
            ปี
          </option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year + 543}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PolicyEndDatePreview({ label, sourceName }: { label: string; sourceName: string }) {
  return (
    <div>
      <div className="mb-2 block text-[14px] font-bold text-[#2f3442]">{label}</div>
      <div
        data-policy-end-date-for={sourceName}
        className="flex h-11 items-center rounded-md border border-slate-200 bg-slate-50 px-3.5 text-[14px] font-semibold text-slate-500 shadow-sm"
      >
        ระบบคำนวณอัตโนมัติ
      </div>
    </div>
  );
}

function FileField({
  label,
  name,
  accept,
  helper
}: {
  label: string;
  name: string;
  accept: string;
  helper?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[14px] font-bold text-[#2f3442]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        required
        className="w-full rounded-md border border-dashed border-slate-300 bg-white px-3.5 py-3 text-[13px] font-semibold text-slate-700 shadow-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-[#0648ad] file:px-3 file:py-2 file:text-sm file:font-bold file:text-white focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100"
      />
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
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
    <section className="rounded-lg border border-slate-100 bg-white px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.07)] sm:px-6">
      <div className="flex items-center gap-3 text-[#0648ad]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
          {icon === 'person' ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.02-8 4.5V21h16v-2.5c0-2.48-3.58-4.5-8-4.5Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
              <path d="M18.92 6.01A2.99 2.99 0 0 0 16.08 4H7.92a2.99 2.99 0 0 0-2.84 2.01L3 12v8h3v-2h12v2h3v-8l-2.08-5.99ZM7.92 6h8.16c.43 0 .81.27.95.68L18.2 10H5.8l1.17-3.32c.14-.41.52-.68.95-.68ZM6.5 15.5A1.5 1.5 0 1 1 8 14a1.5 1.5 0 0 1-1.5 1.5Zm11 0A1.5 1.5 0 1 1 19 14a1.5 1.5 0 0 1-1.5 1.5Z" />
            </svg>
          )}
        </div>
        <h2 className="text-[22px] font-black leading-none tracking-[-0.01em] sm:text-[24px]">{title}</h2>
      </div>
      <div className="mt-4 border-t border-slate-100" />
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return value?.trim() ?? '';
}

function buildResultsHref(searchParams: Awaited<NonNullable<FormPageProps['searchParams']>>) {
  const params = new URLSearchParams();
  const filterKeys = ['sClass', 'coverage', 'repairType', 'brand', 'model', 'year', 'cubicCapacity', 'sumInsured'] as const;

  filterKeys.forEach((key) => {
    const value = normalizeSearchValue(searchParams[key]);

    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `/line-app?${query}` : '/line-app';
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export default async function PackageFormPage({ params, searchParams }: FormPageProps) {
  const { id: packageId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const resultsHref = buildResultsHref(resolvedSearchParams);
  const formError = normalizeSearchValue(resolvedSearchParams.formError);
  const packageItem = await prisma.insurancePackage.findUnique({
    where: { id: packageId }
  });

  if (!packageItem) {
    notFound();
  }

  const [ctpOption, businessHolidays] = await Promise.all([
    getCtpOptionForSClass(packageItem.sClass),
    prisma.businessHoliday.findMany({
      orderBy: {
        date: 'asc'
      },
      select: {
        date: true
      }
    })
  ]);
  const includeCtp = isCtpSelected(resolvedSearchParams.includeCtp) && Boolean(ctpOption);
  const holidayDates = businessHolidays.map((holiday) => toDateKey(holiday.date));
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7f9ff] via-[#f3f6ff] to-white pb-6 text-[#101828]">
      <header className="sticky top-0 z-10 bg-[#0648ad] text-white shadow-[0_10px_30px_rgba(6,72,173,0.18)]">
        <div className="mx-auto flex h-[68px] max-w-md items-center justify-center px-5">
          <Link
            href={resultsHref}
            aria-label="กลับ"
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19 8 12l7-7" />
            </svg>
          </Link>
          <h1 className="px-10 text-center text-[18px] font-black leading-tight sm:text-[20px]">รายละเอียดแจ้งทำประกันภัย</h1>
        </div>
      </header>

      <form id="policy-info-form" action={createPolicyDraftOrder} encType="multipart/form-data" className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-28 pt-5 sm:px-6">
        <PolicyFormDraftAutosave formId="policy-info-form" />
        <PolicyFormEnhancements formId="policy-info-form" includeCtp={includeCtp} holidayDates={holidayDates} />
        <input type="hidden" name="packageId" value={packageItem.id} />
        {includeCtp ? <input type="hidden" name="includeCtp" value="1" /> : null}
        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[14px] font-bold leading-6 text-red-700">
            {formError}
          </div>
        ) : null}

        <SectionCard icon="person" title="ข้อมูลผู้เอาประกัน">
          <Field label="ชื่อ - นามสกุล" name="customerName" placeholder="ระบุชื่อและนามสกุลตามบัตรประชาชน" />
          <Field label="เบอร์โทรศัพท์" name="customerPhone" placeholder="08X-XXX-XXXX" type="tel" inputMode="tel" />
          <Field label="อีเมล" name="customerEmail" placeholder="name@example.com" type="email" required={false} />
          <Field label="เลขบัตรประชาชน" name="idCardNumber" placeholder="กรอกเลขบัตรประชาชน 13 หลัก" inputMode="numeric" />
          <ThaiAddressFields />
        </SectionCard>

        <SectionCard icon="person" title="วันที่คุ้มครอง">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DatePartsField label="วันที่คุ้มครองภาคสมัครใจ" name="policyStartDate" />
            <PolicyEndDatePreview label="สิ้นสุดภาคสมัครใจ" sourceName="policyStartDate" />
          </div>
          {includeCtp ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DatePartsField label="วันที่คุ้มครอง พ.ร.บ." name="ctpPolicyStartDate" />
                <PolicyEndDatePreview label="สิ้นสุด พ.ร.บ." sourceName="ctpPolicyStartDate" />
              </div>
              <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] font-semibold leading-5 text-amber-800 ring-1 ring-amber-100">
                หากเริ่มคุ้มครองภายในวันที่สั่งซื้อ ระบบจะล็อกหลังเวลา 16:00 วันเสาร์-อาทิตย์ และวันหยุดสถาบันการเงิน แต่การเลือกวันล่วงหน้าสามารถทำได้
              </p>
            </>
          ) : null}
        </SectionCard>

        <SectionCard icon="car" title="ข้อมูลรถยนต์">
          <div className="rounded-lg bg-blue-50/80 p-3.5 ring-1 ring-blue-100">
            <div className="mb-3 text-[13px] font-black text-[#0648ad]">รายละเอียดรถยนต์</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ยี่ห้อรถ" name="carBrand" placeholder="เช่น TOYOTA" />
              <Field label="รุ่นรถ" name="carModel" placeholder="เช่น HILUX REVO" />
              <Field label="ขนาด" name="carCubicCapacity" placeholder="เช่น 2,001 ซีซี" />
              <Field label="ปีจดทะเบียน" name="carYear" placeholder="เช่น 2022" inputMode="numeric" />
            </div>
          </div>
          <Field label="ทะเบียนรถ" name="plateNumber" placeholder="เช่น กค 1234" />
          <div>
            <label htmlFor="plateProvince" className="mb-2 block text-[14px] font-bold text-[#2f3442]">
              จังหวัดที่จดทะเบียน
            </label>
            <div className="relative">
              <select
                id="plateProvince"
                name="plateProvince"
                required
                defaultValue=""
                className="h-11 w-full appearance-none rounded-md border border-slate-200 bg-white px-3.5 pr-11 text-[14px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100"
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
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#4f5564]" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
          <Field label="เลขตัวถัง" name="chassisNumber" placeholder="กรอกเลขตัวถังรถ" />
          <input type="hidden" name="vehicleDocumentType" value="เอกสารรถ" />
          <FileField
            label="แนบไฟล์เอกสารรถ"
            name="vehicleDocumentFile"
            accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,application/pdf"
            helper="แนบสำเนาทะเบียนรถหรือกรมธรรม์เดิมอย่างใดอย่างหนึ่ง รองรับรูปภาพและ PDF"
          />
        </SectionCard>

        <SectionCard icon="person" title="ที่อยู่จัดส่งกรมธรรม์">
          <div className="grid grid-cols-1 gap-3 text-[14px] font-bold text-slate-800">
            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3.5 py-3">
              <input type="radio" name="deliveryAddressMode" value="same" defaultChecked className="h-4 w-4 accent-[#0648ad]" />
              ที่อยู่เดียวกับผู้เอาประกัน
            </label>
            <label className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3.5 py-3">
              <input type="radio" name="deliveryAddressMode" value="other" className="h-4 w-4 accent-[#0648ad]" />
              ใช้ที่อยู่อื่น
            </label>
          </div>
          <div data-delivery-other-section className="space-y-4">
            <Field label="ชื่อผู้รับเอกสาร" name="deliveryRecipientName" placeholder="ชื่อ - นามสกุลผู้รับเอกสาร" required={false} />
            <Field label="เบอร์โทรผู้รับเอกสาร" name="deliveryRecipientPhone" placeholder="08X-XXX-XXXX" type="tel" inputMode="tel" required={false} />
            <Field
              label="ที่อยู่จัดส่งเอกสาร"
              name="deliveryAddress"
              placeholder="บ้านเลขที่, ซอย, ถนน, ตำบล, อำเภอ, จังหวัด, รหัสไปรษณีย์"
              required={false}
              multiline
            />
          </div>
        </SectionCard>

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_-14px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center rounded-lg bg-[#0648ad] px-4 text-[18px] font-black text-white shadow-[0_10px_22px_rgba(6,72,173,0.24)] transition hover:bg-[#003f98] active:scale-[0.99]"
            >
              ยืนยันข้อมูลและชำระเงิน
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
