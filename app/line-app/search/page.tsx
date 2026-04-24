"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const carBrands = ["Toyota", "Honda", "Isuzu", "Mazda", "Nissan", "Mitsubishi"];
const carModels = ["Vios", "City", "D-Max", "CX-5", "Almera", "Pajero Sport"];
const carYears = ["2024", "2023", "2022", "2021", "2020", "2019"];

export default function SearchInsurancePage() {
  const router = useRouter();
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  const canSearch = useMemo(() => Boolean(brand && model && year), [brand, model, year]);

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (brand) params.set("brand", brand);
    if (model) params.set("model", model);
    if (year) params.set("year", year);

    router.push(`/line-app?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-[#f4f5ff] text-[#12131a]">
      <header className="sticky top-0 z-10 bg-[#0047BA] text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <button
            type="button"
            aria-label="ย้อนกลับ"
            onClick={() => router.back()}
            className="rounded-full p-1.5 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <h1 className="font-[Kanit,sans-serif] text-xl font-bold tracking-wide">ค้นหาเบี้ยประกัน</h1>
          <div className="h-9 w-9" />
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] max-w-md flex-col px-4 pb-6 pt-6">
        <section className="rounded-3xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70 backdrop-blur-md">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e9efff] text-[#0047BA] shadow-inner">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7h11.2a2 2 0 0 1 1.9 1.5L21 13" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13h14a2 2 0 0 1 2 2v2H3v-2a2 2 0 0 1 2-2Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 17.5h.01M16.5 17.5h.01" />
              </svg>
            </div>

            <div>
              <h2 className="font-[Kanit,sans-serif] text-2xl font-bold leading-tight text-[#0047BA]">
                ข้อมูลรถยนต์ของคุณ
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#4b5265]">
                กรุณาระบุรายละเอียดเพื่อคำนวณราคาทุนแบบง่ายๆ
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
          <div className="space-y-5">
            <div>
              <label htmlFor="brand" className="mb-2 block text-base font-semibold text-[#12131a]">
                ยี่ห้อรถยนต์
              </label>
              <div className="relative">
                <select
                  id="brand"
                  value={brand}
                  onChange={(event) => setBrand(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition placeholder:text-[#6b7280] focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
                >
                  <option value="">เลือกยี่ห้อรถ (เช่น Toyota, Honda)</option>
                  {carBrands.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#4b5265]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="model" className="mb-2 block text-base font-semibold text-[#12131a]">
                รุ่นรถยนต์
              </label>
              <div className="relative">
                <select
                  id="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
                >
                  <option value="">เลือกรุ่นรถ</option>
                  {carModels.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#4b5265]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="year" className="mb-2 block text-base font-semibold text-[#12131a]">
                ปีจดทะเบียน
              </label>
              <div className="relative">
                <select
                  id="year"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
                >
                  <option value="">เลือกปี (เช่น 2023)</option>
                  {carYears.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#4b5265]">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl bg-[#dfe5ff] px-4 py-4 text-[#3a4258] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0047BA] text-xs font-bold text-white">
              i
            </div>
            <p className="text-sm font-medium leading-6">
              ระบบจะแสดงราคาทุนสุทธิ โดยไม่มีการบวกค่าคอมมิชชั่น
            </p>
          </div>
        </section>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,71,186,0.28)] transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
            </svg>
            ค้นหาแผนประกันราคาทุน
          </button>
        </div>
      </div>
    </main>
  );
}
