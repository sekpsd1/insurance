import Link from 'next/link';

const insuranceTypes = [
  {
    title: 'ประกันภัยบ้าน',
    description: 'คุ้มครองบ้านและทรัพย์สิน',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M12 3.1 2.7 10v10.6h7v-6.2h4.6v6.2h7V10L12 3.1Zm0 2.35 6.9 5.1v8.25h-2.3v-6.2H7.4v6.2H5.1v-8.25L12 5.45Z" />
      </svg>
    )
  },
  {
    title: 'ประกันภัยอุบัติเหตุส่วนบุคคล',
    description: 'ความคุ้มครองอุบัติเหตุส่วนบุคคล',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="M12 2.5 4.25 5.6v5.65c0 4.83 3.28 8.82 7.75 10.25 4.47-1.43 7.75-5.42 7.75-10.25V5.6L12 2.5Zm0 2.16 5.45 2.18v4.41c0 3.48-2.18 6.6-5.45 7.9-3.27-1.3-5.45-4.42-5.45-7.9V6.84L12 4.66Z" />
        <path d="M10.95 8.1h2.1v2.05h2.05v2.1h-2.05v2.05h-2.1V12.25H8.9v-2.1h2.05V8.1Z" />
      </svg>
    )
  },
  {
    title: 'ประกันเดินทาง',
    description: 'ความคุ้มครองระหว่างการเดินทาง',
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
        <path d="m21.25 11.1-8.15-3.02V3.9c0-.76-.59-1.4-1.35-1.4-.76 0-1.35.64-1.35 1.4v4.18L2.25 11.1v2.1l8.15-1.45v5.12l-2.2 1.52v1.82l3.65-1.1 3.65 1.1v-1.82l-2.2-1.52v-5.12l8.15 1.45v-2.1Z" />
      </svg>
    )
  }
];

export default function OtherInsurancePage() {
  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex h-[68px] max-w-md items-center justify-center px-4">
          <Link
            href="/line-app/menu"
            aria-label="กลับไปเมนู"
            className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="px-10 text-center font-[Kanit,sans-serif] text-[clamp(17px,5vw,22px)] font-bold leading-none tracking-wide">
            ประกันประเภทอื่นๆ
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-5">
        <div className="space-y-3">
          {insuranceTypes.map((insurance) => (
            <button
              key={insurance.title}
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center gap-4 rounded-2xl border border-[#dbe4f3] bg-white p-4 text-left opacity-80 shadow-[0_8px_24px_rgba(4,16,61,0.06)]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0052CC] text-white">
                {insurance.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#003f91]">{insurance.title}</span>
                <span className="mt-1 block text-sm leading-5 text-[#4b5265]">{insurance.description}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">เร็วๆ นี้</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
