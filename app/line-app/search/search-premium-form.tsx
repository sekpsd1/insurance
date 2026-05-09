'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type SearchPremiumOptionRow = {
  coverageType: string | null;
  brand: string;
  model: string;
  year: string | number | null;
};

type CoverageType = '2+' | '3+' | '3';

type SearchPremiumFormProps = {
  optionRows: SearchPremiumOptionRow[];
  initialCoverage?: string;
  initialBrand?: string;
  initialModel?: string;
  initialYear?: string;
};

const COVERAGE_OPTIONS: Array<{ value: CoverageType; label: string }> = [
  { value: '2+', label: 'ประกัน 2+' },
  { value: '3+', label: 'ประกัน 3+' },
  { value: '3', label: 'ประกันชั้น 3' }
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'th'));
}

function normalizeCoverage(value: string | undefined) {
  return COVERAGE_OPTIONS.some((option) => option.value === value) ? (value as CoverageType) : '';
}

function getCoverageLabel(value: string) {
  return COVERAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default function SearchPremiumForm({
  optionRows,
  initialCoverage = '',
  initialBrand = '',
  initialModel = '',
  initialYear = ''
}: SearchPremiumFormProps) {
  const router = useRouter();
  const [coverage, setCoverage] = useState(normalizeCoverage(initialCoverage));
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState(initialModel);
  const [year, setYear] = useState(initialYear);
  const currentYear = new Date().getFullYear();

  const filteredRows = useMemo(() => {
    if (!coverage) {
      return [];
    }

    return optionRows.filter((row) => row.coverageType === coverage);
  }, [coverage, optionRows]);

  const brands = useMemo(() => uniqueValues(filteredRows.map((row) => row.brand)), [filteredRows]);

  const models = useMemo(() => {
    if (!coverage || !brand) {
      return [];
    }

    return uniqueValues(filteredRows.filter((row) => row.brand === brand).map((row) => row.model));
  }, [brand, coverage, filteredRows]);

  const years = useMemo(() => {
    if (!coverage || !brand || !model) {
      return [];
    }

    const fromData = filteredRows
      .filter((row) => row.brand === brand && row.model === model && row.year)
      .map((row) => String(row.year));

    const fallbackYears = Array.from({ length: 16 }, (_, index) => String(currentYear - index));

    return Array.from(new Set([...fromData, ...fallbackYears])).sort((left, right) => Number(right) - Number(left));
  }, [brand, coverage, currentYear, filteredRows, model]);

  function handleCoverageChange(nextCoverage: string) {
    setCoverage(normalizeCoverage(nextCoverage));
    setBrand('');
    setModel('');
    setYear('');
  }

  function handleBrandChange(nextBrand: string) {
    setBrand(nextBrand);
    setModel('');
    setYear('');
  }

  function handleModelChange(nextModel: string) {
    setModel(nextModel);
    setYear('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set('coverage', coverage);
    params.set('brand', brand);
    params.set('model', model);

    if (year) {
      params.set('year', year);
    }

    router.push(`/line-app?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
      <div className="space-y-5">
        <div>
          <label htmlFor="coverage" className="mb-2 block text-base font-semibold text-[#12131a]">
            ประเภทความคุ้มครอง
          </label>
          <div className="relative">
            <select
              id="coverage"
              name="coverage"
              value={coverage}
              onChange={(event) => handleCoverageChange(event.target.value)}
              required
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">เลือกประเภทความคุ้มครอง</option>
              {COVERAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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
          <label htmlFor="brand" className="mb-2 block text-base font-semibold text-[#12131a]">
            ยี่ห้อรถยนต์
          </label>
          <div className="relative">
            <select
              id="brand"
              name="brand"
              value={brand}
              onChange={(event) => handleBrandChange(event.target.value)}
              required
              disabled={!coverage}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{coverage ? 'เลือกยี่ห้อรถ' : 'กรุณาเลือกประเภทความคุ้มครองก่อน'}</option>
              {brands.map((item) => (
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
              name="model"
              value={model}
              onChange={(event) => handleModelChange(event.target.value)}
              required
              disabled={!coverage || !brand}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{brand ? 'เลือกรุ่นรถ' : 'กรุณาเลือกยี่ห้อก่อน'}</option>
              {models.map((item) => (
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
              name="year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              disabled={!coverage || !brand || !model}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">เลือกปีจดทะเบียน</option>
              {years.map((item) => (
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
          <p className="mt-2 text-sm text-[#4b5265]">
            {coverage ? `กำลังดูเฉพาะ ${getCoverageLabel(coverage)} ก่อนเลือกยี่ห้อรถ` : 'กรุณาเลือกประเภทความคุ้มครองก่อนเริ่มค้นหา'}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl bg-[#dfe5ff] px-4 py-4 text-[#3a4258] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0047BA] text-xs font-bold text-white">
            i
          </div>
          <p className="text-sm font-medium leading-6">ระบบจะแสดงราคาทุนสุทธิ โดยไม่มีการบวกค่าคอมมิชชั่น</p>
        </div>
      </section>

      <div className="mt-6">
        <button
          type="submit"
          disabled={!brand || !model}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,71,186,0.28)] transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:bg-[#7f9fe0]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
          </svg>
          ค้นหาแผนประกันราคาทุน
        </button>
      </div>
    </form>
  );
}
