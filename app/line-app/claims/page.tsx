import Link from 'next/link';

export default function ClaimsPage() {
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
          <h1 className="px-10 text-center font-[Kanit,sans-serif] text-[clamp(18px,5vw,23px)] font-bold leading-none tracking-wide">
            แจ้งเคลม
          </h1>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-7">
        <div className="rounded-[24px] border border-[#d9e4f5] bg-white p-6 text-center shadow-[0_10px_28px_rgba(4,16,61,0.08)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e7f0ff] text-[#0052CC]">
            <svg viewBox="0 0 24 24" className="h-9 w-9 fill-current" aria-hidden="true">
              <path d="M6.62 10.79a15.47 15.47 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.11.37 2.29.56 3.5.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.57 21 3 13.43 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.19 2.39.56 3.5a1 1 0 0 1-.24 1.01l-2.2 2.28Z" />
            </svg>
          </span>

          <p className="mt-5 text-sm font-semibold text-[#5b6475]">ศูนย์รับแจ้งเคลม</p>
          <h2 className="mt-2 font-[Kanit,sans-serif] text-[clamp(22px,6vw,28px)] font-bold leading-tight text-[#003f91]">
            คุ้มภัยโตเกียวมารีนประกันภัย
          </h2>
          <p className="mt-2 text-base font-medium text-[#4b5265]">Tokio Marine Safety Insurance</p>

          <a
            href="tel:022578000"
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0052CC] px-5 py-4 text-white shadow-[0_8px_18px_rgba(0,82,204,0.25)] transition hover:bg-[#0047BA]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-current" aria-hidden="true">
              <path d="M6.62 10.79a15.47 15.47 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.11.37 2.29.56 3.5.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.57 21 3 13.43 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.21.19 2.39.56 3.5a1 1 0 0 1-.24 1.01l-2.2 2.28Z" />
            </svg>
            <span className="text-left">
              <span className="block text-sm font-medium leading-none text-white/85">โทรแจ้งเคลม</span>
              <span className="mt-1 block text-[clamp(24px,7vw,31px)] font-bold leading-none">0-2257-8000</span>
            </span>
          </a>

          <p className="mt-4 text-sm leading-6 text-[#677085]">กดปุ่มเพื่อโทรออกถึงศูนย์รับแจ้งเคลม</p>
        </div>
      </section>
    </main>
  );
}
