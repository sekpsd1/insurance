import Link from 'next/link';

const menuItems = [
  {
    href: '/line-app/search',
    title: 'ค้นหาเบี้ยประกัน',
    description: 'กรอกรายละเอียดรถยนต์เพื่อดูข้อเสนอเบี้ยประกันภัย',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M10.5 4a6.5 6.5 0 0 1 5.18 10.43l3.45 3.44a.9.9 0 1 1-1.27 1.27l-3.45-3.45A6.5 6.5 0 1 1 10.5 4Zm0 1.8a4.7 4.7 0 1 0 0 9.4 4.7 4.7 0 0 0 0-9.4Z" />
      </svg>
    )
  },
  {
    href: '/line-app/cart',
    title: 'ตะกร้า',
    description: 'ดูแผนที่เก็บไว้ เลือกแผนทำประกัน หรือเลือกเปรียบเทียบ',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M7 18.5a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Zm9 0a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5ZM5.4 4.25a.9.9 0 0 0-.88-.75H2.75a.9.9 0 0 0 0 1.8h1.03l1.95 9.74A2.45 2.45 0 0 0 8.13 17h8.55a2.45 2.45 0 0 0 2.34-1.74l1.55-5.16A2.05 2.05 0 0 0 18.6 7.45H6.04L5.4 4.25Z" />
      </svg>
    )
  },
  {
    href: '/line-app/tracking',
    title: 'ติดตามคำสั่งซื้อ',
    description: 'ดูประวัติคำสั่งซื้อและสถานะกรมธรรม์ล่าสุด',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        <path d="M12 2.75a8.75 8.75 0 0 0-8.75 8.75c0 6.55 7.9 9.55 8.24 9.67a1.45 1.45 0 0 0 1.02 0c.34-.12 8.24-3.12 8.24-9.67A8.75 8.75 0 0 0 12 2.75Zm0 4.4a4.35 4.35 0 1 1 0 8.7 4.35 4.35 0 0 1 0-8.7Zm0 1.8a2.55 2.55 0 1 0 0 5.1 2.55 2.55 0 0 0 0-5.1Z" />
      </svg>
    )
  }
];

export default function LineAppMenuPage() {
  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-md items-center justify-center px-4 py-4">
          <h1 className="font-[Kanit,sans-serif] text-xl font-bold leading-none tracking-wide">เมนูหลัก</h1>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-md flex-col gap-5 px-4 py-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#f4f9ff] to-[#dfeeff] px-5 py-6 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#0052CC]">LINE MINI APP</p>
          <h2 className="mt-2 font-[Kanit,sans-serif] text-2xl font-bold leading-tight text-[#0f172a]">ประกันภัยไร้คอม</h2>
          <p className="mt-2 text-sm leading-6 text-[#4b5265]">เลือกเมนูที่ต้องการใช้งาน</p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <div className="flex flex-col gap-3">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-2xl border border-[#dbe4f3] bg-white p-4 text-left transition hover:border-[#0052CC] hover:bg-[#f6fbff]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0052CC] text-white shadow-[0_8px_18px_rgba(0,82,204,0.22)]">
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-[Kanit,sans-serif] text-lg font-bold leading-tight text-[#003f91]">{item.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-[#4b5265]">{item.description}</span>
                </span>
                <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-[#0052CC]" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
