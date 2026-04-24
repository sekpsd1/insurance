import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

type LineAppSearchParams = {
  brand?: string;
  model?: string;
  year?: string;
};

type InsurancePackageRow = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  details: string | null;
  repairType: string | null;
  coverage: string | null;
  fullPrice: number;
  netPrice: number;
  discount: number;
  createdAt: Date;
};

function normalizeSearchValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function buildSearchSummary(filters: { brand: string; model: string; year: string }) {
  return [filters.brand, filters.model, filters.year].filter(Boolean).join(" ");
}

export default async function LineAppPage({
  searchParams
}: {
  searchParams?: Promise<LineAppSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const brand = normalizeSearchValue(resolvedSearchParams.brand);
  const model = normalizeSearchValue(resolvedSearchParams.model);
  const year = normalizeSearchValue(resolvedSearchParams.year);
  const hasFilters = Boolean(brand || model || year);

  const searchConditions: Prisma.Sql[] = [];

  if (brand) {
    searchConditions.push(Prisma.sql`(name LIKE ${`%${brand}%`} OR company LIKE ${`%${brand}%`} OR details LIKE ${`%${brand}%`})`);
  }

  if (model) {
    searchConditions.push(Prisma.sql`(name LIKE ${`%${model}%`} OR company LIKE ${`%${model}%`} OR details LIKE ${`%${model}%`})`);
  }

  if (year) {
    searchConditions.push(Prisma.sql`(name LIKE ${`%${year}%`} OR company LIKE ${`%${year}%`} OR details LIKE ${`%${year}%`})`);
  }

  const whereClause =
    searchConditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(searchConditions, ' AND ')}`
      : Prisma.empty;

  console.log('Database URL:', process.env.DATABASE_URL);
  const packages = await prisma.$queryRaw<InsurancePackageRow[]>`
    SELECT
      id,
      name,
      company,
      logoUrl,
      details,
      repairType,
      coverage,
      fullPrice,
      netPrice,
      discount,
      createdAt
    FROM InsurancePackage
    ${whereClause}
    ORDER BY createdAt DESC
  `;
  console.log('[line-app] raw packages', packages);
  const insurancePackages = packages;
  const searchSummary = buildSearchSummary({ brand, model, year });

  console.log('[line-app] insurance packages loaded', {
    count: insurancePackages.length,
    packages: insurancePackages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      repairType: pkg.repairType,
      coverage: pkg.coverage,
    })),
  });

  return (
    <main className="flex min-h-screen flex-col bg-[#faf8ff] text-[#191b23] antialiased">
      <header className="sticky top-0 z-10 flex w-full items-center justify-between bg-[#0052CC] px-4 py-3 text-white shadow-sm">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <button type="button" aria-label="Back" className="-ml-2 rounded-full p-2 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-[Kanit,sans-serif] text-lg font-semibold tracking-wide">เลือกแผนประกันราคาทุน</h1>
          <button type="button" aria-label="Menu" className="-mr-2 rounded-full p-2 transition-colors hover:bg-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col space-y-6 px-4 py-6">
        {hasFilters ? (
          <section className="rounded-2xl border border-[#cfd8ff] bg-[#eef3ff] px-4 py-3 text-sm font-medium text-[#24406f] shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
            ผลลัพธ์สำหรับ: <span className="font-semibold">{searchSummary}</span>
          </section>
        ) : null}

        <section className="rounded-xl bg-[#e1e2ec] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0052CC] text-sm font-bold text-white">
              i
            </div>
            <div>
              <h2 className="font-[Kanit,sans-serif] font-semibold text-[#0052CC]">ค้นพบ 12 แผนที่เหมาะกับคุณ</h2>
              <p className="mt-1 text-sm text-[#434654]">ราคาต้นทุนจากบริษัทประกัน 100%</p>
            </div>
          </div>
        </section>

        <div className="space-y-4">
          {insurancePackages.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-8 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
              <p className="font-[Kanit,sans-serif] text-lg font-semibold text-[#0052CC]">
                ขออภัย ไม่พบแผนประกันสำหรับข้อมูลนี้
              </p>
              <p className="mt-2 text-sm leading-6 text-[#434654]">
                กรุณาลองปรับข้อมูลรถยนต์ หรือกลับไปค้นหาใหม่อีกครั้ง
              </p>
            </div>
          ) : (
            insurancePackages.map((pkg) => (
              <div
                key={pkg.id}
                className="overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
              >
                <div className="relative p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(195,198,214,0.2)] bg-[#ededf8]">
                        {pkg.logoUrl ? (
                          <img src={pkg.logoUrl} alt={pkg.company} className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-xs font-semibold text-[#434654]">LOGO</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h2 className="font-[Kanit,sans-serif] text-xl font-bold leading-tight text-[#0052CC]">{pkg.name}</h2>
                        <p className="mt-1 text-sm text-[#434654]">{pkg.company}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#0f4ec7] px-3 py-1 text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(15,78,199,0.18)]">
                            {getText(pkg.repairType, 'ยังไม่ได้ระบุประเภทการซ่อม')}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[#0f4ec7] px-3 py-1 text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(15,78,199,0.18)]">
                            {getText(pkg.coverage, 'ยังไม่ได้ระบุความคุ้มครอง')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-full bg-[#109e06]/10 px-3 py-1 text-[#109e06] shadow-sm">
                      <span className="text-[16px] leading-none">💰</span>
                      <span className="font-[Kanit,sans-serif] text-xs font-semibold tracking-wide">
                        ประหยัด {formatMoney(Math.max(pkg.fullPrice - pkg.netPrice, 0))}.-
                      </span>
                    </div>
                  </div>

                  {pkg.details ? (
                    <p className="mb-5 text-sm leading-6 text-[#434654]">{pkg.details}</p>
                  ) : null}

                  <div className="mb-5 space-y-2 rounded-lg bg-[#faf8ff] p-4">
                    <div className="flex items-center justify-between gap-4 text-sm text-[#434654]">
                      <span>ราคาตลาดทั่วไป:</span>
                      <span className="line-through">{formatMoney(pkg.fullPrice)} บาท</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-base font-semibold text-[#0052CC]">
                      <span>เบี้ยประกันราคาทุน:</span>
                      <span>{formatMoney(pkg.netPrice)} บาท</span>
                    </div>

                    <div className="flex items-center justify-between gap-4 text-sm font-medium text-[#109e06]">
                      <span>ค่าบริการแพลตฟอร์ม:</span>
                      <span>0 บาท (ฟรี!)</span>
                    </div>

                    <div className="my-2 h-px w-full bg-[rgba(195,198,214,0.2)]" />

                    <div className="flex items-center justify-between gap-4 text-lg font-bold text-[#0052CC]">
                      <span>ยอดรวมสุทธิ:</span>
                      <span>{formatMoney(pkg.netPrice)} บาท</span>
                    </div>
                  </div>
                  <Link
                    href={`/line-app/form/${pkg.id}`}
                    className="flex w-full items-center justify-center gap-2 bg-[#0052CC] py-4 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
                  >
                    ดูรายละเอียด / เลือกแผนนี้
                    <span aria-hidden="true" className="text-sm">→</span>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}