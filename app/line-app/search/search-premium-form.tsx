'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type RepairType = 'dealer' | 'garage';
type CoverageType = '1' | '2+' | '3+' | '3';

type SearchPremiumOptionRow = {
  sClass: string;
  coverageType: string | null;
  repairType: RepairType | null;
  brand: string;
  model: string;
  minCarAge: number | null;
  maxCarAge: number | null;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  sumInsuredValues: number[];
};

type SearchPremiumFormProps = {
  optionRows: SearchPremiumOptionRow[];
  initialSClass?: string;
  initialCoverage?: string;
  initialRepairType?: string;
  initialBrand?: string;
  initialModel?: string;
  initialYear?: string;
  initialCubicCapacity?: string;
  initialSumInsured?: string;
};

const COVERAGE_OPTIONS: Array<{ value: CoverageType; label: string }> = [
  { value: '1', label: 'ประเภท 1' },
  { value: '2+', label: 'ประเภท 2 พลัส' },
  { value: '3+', label: 'ประเภท 3 พลัส' },
  { value: '3', label: 'ประเภท 3' }
];

const REPAIR_TYPE_OPTIONS: Array<{ value: RepairType; label: string }> = [
  { value: 'dealer', label: 'ซ่อมห้าง' },
  { value: 'garage', label: 'ซ่อมอู่' }
];

const SCLASS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '110', label: 'รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู' },
  { value: '320', label: 'รถกระบะ 2 ประตู' },
  { value: '210', label: 'รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า' }
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'th'));
}

function normalizeCoverage(value: string | undefined) {
  if (value === '2.1' || value === '2.2') {
    return '2+';
  }

  if (value === '3.1' || value === '3.2') {
    return '3+';
  }

  return COVERAGE_OPTIONS.some((option) => option.value === value) ? (value as CoverageType) : '';
}

function normalizeRepairType(value: string | undefined) {
  return REPAIR_TYPE_OPTIONS.some((option) => option.value === value) ? (value as RepairType) : '';
}

function formatSumInsured(value: number) {
  if (value === 0) {
    return 'ไม่มีทุนประกัน';
  }

  return value.toLocaleString('th-TH');
}

function formatCubicCapacity(value: number) {
  if (value >= 9999) {
    return 'มากกว่า 3,000 ซีซี';
  }

  return `${value.toLocaleString('th-TH')} ซีซี`;
}

function formatCubicCapacityRange(min: number, max: number) {
  if (min === 0 && max >= 9999) {
    return 'ทุกขนาดเครื่องยนต์';
  }

  if (min === 0) {
    return `ไม่เกิน ${formatCubicCapacity(max)}`;
  }

  if (max >= 9999) {
    return `ตั้งแต่ ${formatCubicCapacity(min)} ขึ้นไป`;
  }

  if (min === max) {
    return formatCubicCapacity(min);
  }

  return `${formatCubicCapacity(min)} - ${formatCubicCapacity(max)}`;
}

function getCarAgeFromRegistrationYear(year: string) {
  const parsed = Number.parseInt(year, 10);
  return Number.isFinite(parsed) ? Math.max(new Date().getFullYear() - parsed, 0) : null;
}

function rowMatchesRegistrationYear(row: SearchPremiumOptionRow, year: string) {
  const carAge = getCarAgeFromRegistrationYear(year);

  if (carAge === null) {
    return false;
  }

  return (row.minCarAge ?? 0) <= carAge && (row.maxCarAge ?? 999) >= carAge;
}

function SelectChevron() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[#4b5265]">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </span>
  );
}

export default function SearchPremiumForm({
  optionRows,
  initialSClass = '',
  initialCoverage = '',
  initialRepairType = '',
  initialBrand = '',
  initialModel = '',
  initialYear = '',
  initialCubicCapacity = '',
  initialSumInsured = ''
}: SearchPremiumFormProps) {
  const router = useRouter();
  const [sClass, setSClass] = useState(initialSClass);
  const [coverage, setCoverage] = useState(normalizeCoverage(initialCoverage));
  const [repairType, setRepairType] = useState(normalizeRepairType(initialRepairType));
  const [brand, setBrand] = useState(initialBrand);
  const [model, setModel] = useState(initialModel);
  const [year, setYear] = useState(initialYear);
  const [cubicCapacity, setCubicCapacity] = useState(initialCubicCapacity);
  const [sumInsured, setSumInsured] = useState(initialSumInsured);

  const availableRepairTypes = useMemo(() => {
    if (!sClass || !coverage) {
      return [];
    }

    return Array.from(
      new Set(
        optionRows
          .filter((row) => row.sClass === sClass && row.coverageType === coverage && row.repairType)
          .map((row) => row.repairType as RepairType)
      )
    );
  }, [coverage, optionRows, sClass]);

  const filteredRows = useMemo(() => {
    if (!sClass || !coverage || !repairType) {
      return [];
    }

    return optionRows.filter((row) => row.sClass === sClass && row.coverageType === coverage && row.repairType === repairType);
  }, [coverage, optionRows, repairType, sClass]);

  const isRepairAutoSwitchPending = Boolean(
      coverage &&
      repairType &&
      availableRepairTypes.length === 1 &&
      !availableRepairTypes.includes(repairType as RepairType)
  );

  const brands = useMemo(() => uniqueValues(filteredRows.map((row) => row.brand)), [filteredRows]);

  const models = useMemo(() => {
    if (!brand) {
      return [];
    }

    return uniqueValues(filteredRows.filter((row) => row.brand === brand).map((row) => row.model));
  }, [brand, filteredRows]);

  const years = useMemo(() => {
    if (!brand || !model) {
      return [];
    }

    const currentYear = new Date().getFullYear();
    const yearSet = new Set<string>();

    filteredRows
      .filter((row) => row.brand === brand && row.model === model)
      .forEach((row) => {
        const minAge = row.minCarAge ?? 0;
        const maxAge = row.maxCarAge ?? minAge;

        for (let age = minAge; age <= maxAge; age += 1) {
          yearSet.add(String(currentYear - age));
        }
      });

    return Array.from(yearSet).sort((left, right) => Number(right) - Number(left));
  }, [brand, filteredRows, model]);

  const cubicCapacityOptions = useMemo(() => {
    if (!brand || !model || !year) {
      return [];
    }

    const optionMap = new Map<string, { value: string; label: string; sortValue: number }>();

    filteredRows
      .filter((row) => row.brand === brand && row.model === model && rowMatchesRegistrationYear(row, year))
      .forEach((row) => {
        const min = row.minCubicCapacity ?? 0;
        const max = row.maxCubicCapacity ?? min;
        const value = max >= 9999 ? String(min || max) : String(max);
        const label = formatCubicCapacityRange(min, max);
        optionMap.set(`${min}-${max}`, {
          value,
          label,
          sortValue: min || max
        });
      });

    return Array.from(optionMap.values()).sort((left, right) => left.sortValue - right.sortValue);
  }, [brand, filteredRows, model, year]);

  const sumInsuredOptions = useMemo(() => {
    if (!brand || !model || !year || !cubicCapacity) {
      return [];
    }

    const selectedCapacity = Number.parseInt(cubicCapacity, 10);
    const values = filteredRows
      .filter(
        (row) =>
          row.brand === brand &&
          row.model === model &&
          rowMatchesRegistrationYear(row, year) &&
          (row.minCubicCapacity ?? 0) <= selectedCapacity &&
          (row.maxCubicCapacity ?? 999999) >= selectedCapacity
      )
      .flatMap((row) => row.sumInsuredValues)
      .filter((value) => value >= 0);

    return Array.from(new Set(values)).sort((left, right) => left - right);
  }, [brand, cubicCapacity, filteredRows, model, year]);

  useEffect(() => {
    if (coverage && availableRepairTypes.length === 1 && repairType !== availableRepairTypes[0]) {
      setRepairType(availableRepairTypes[0]);
    }
  }, [availableRepairTypes, coverage, repairType]);

  useEffect(() => {
    if (isRepairAutoSwitchPending) {
      return;
    }

    if (brand && !brands.includes(brand)) {
      setBrand('');
      setModel('');
      setYear('');
      setCubicCapacity('');
      setSumInsured('');
    }
  }, [brand, brands, isRepairAutoSwitchPending]);

  useEffect(() => {
    if (isRepairAutoSwitchPending) {
      return;
    }

    if (model && !models.includes(model)) {
      setModel('');
      setYear('');
      setCubicCapacity('');
      setSumInsured('');
    }
  }, [isRepairAutoSwitchPending, model, models]);

  useEffect(() => {
    if (isRepairAutoSwitchPending) {
      return;
    }

    if (year && !years.includes(year)) {
      setYear('');
      setCubicCapacity('');
      setSumInsured('');
    }
  }, [isRepairAutoSwitchPending, year, years]);

  useEffect(() => {
    if (isRepairAutoSwitchPending) {
      return;
    }

    if (cubicCapacity && !cubicCapacityOptions.some((option) => option.value === cubicCapacity)) {
      setCubicCapacity('');
      setSumInsured('');
    }
  }, [cubicCapacity, cubicCapacityOptions, isRepairAutoSwitchPending]);

  useEffect(() => {
    if (isRepairAutoSwitchPending) {
      return;
    }

    if (sumInsured && !sumInsuredOptions.some((option) => String(option) === sumInsured)) {
      setSumInsured('');
    }
  }, [isRepairAutoSwitchPending, sumInsured, sumInsuredOptions]);

  function resetAfterSClass(nextSClass: string) {
    setSClass(nextSClass);
    setCoverage('');
    setRepairType('');
    setBrand('');
    setModel('');
    setYear('');
    setCubicCapacity('');
    setSumInsured('');
  }

  function resetAfterCoverage(nextCoverage: string) {
    const normalizedCoverage = normalizeCoverage(nextCoverage);
    const nextAvailableRepairTypes = Array.from(
      new Set(
        optionRows
          .filter((row) => row.sClass === sClass && row.coverageType === normalizedCoverage && row.repairType)
          .map((row) => row.repairType as RepairType)
      )
    );

    setCoverage(normalizedCoverage);
    if (nextAvailableRepairTypes.length === 1) {
      setRepairType(nextAvailableRepairTypes[0]);
    }
    setSumInsured('');
  }

  function resetAfterRepairType(nextRepairType: string) {
    setRepairType(normalizeRepairType(nextRepairType));
    setSumInsured('');
  }

  function resetAfterBrand(nextBrand: string) {
    setBrand(nextBrand);
    setModel('');
    setYear('');
    setCubicCapacity('');
    setSumInsured('');
  }

  function resetAfterModel(nextModel: string) {
    setModel(nextModel);
    setYear('');
    setCubicCapacity('');
    setSumInsured('');
  }

  function resetAfterYear(nextYear: string) {
    setYear(nextYear);
    setCubicCapacity('');
    setSumInsured('');
  }

  function resetAfterCubicCapacity(nextCubicCapacity: string) {
    setCubicCapacity(nextCubicCapacity);
    setSumInsured('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    params.set('sClass', sClass);
    params.set('coverage', coverage);
    params.set('repairType', repairType);
    params.set('brand', brand);
    params.set('model', model);
    params.set('year', year);
    params.set('cubicCapacity', cubicCapacity);
    params.set('sumInsured', sumInsured);

    router.push(`/line-app?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
      <div className="space-y-5">
        <div>
          <label htmlFor="sClass" className="mb-2 block text-base font-semibold text-[#12131a]">
            ประเภทรถ
          </label>
          <div className="relative">
            <select
              id="sClass"
              name="sClass"
              value={sClass}
              onChange={(event) => resetAfterSClass(event.target.value)}
              required
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">-- เลือกประเภทรถ --</option>
              {SCLASS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="coverage" className="mb-2 block text-base font-semibold text-[#12131a]">
            ประเภทกรมธรรม์
          </label>
          <div className="relative">
            <select
              id="coverage"
              name="coverage"
              value={coverage}
              onChange={(event) => resetAfterCoverage(event.target.value)}
              required
              disabled={!sClass}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{sClass ? '-- เลือกประเภทกรมธรรม์ --' : 'กรุณาเลือกประเภทรถก่อน'}</option>
              {COVERAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="repairType" className="mb-2 block text-base font-semibold text-[#12131a]">
            ความคุ้มครอง
          </label>
          <div className="relative">
            <select
              id="repairType"
              name="repairType"
              value={repairType}
              onChange={(event) => resetAfterRepairType(event.target.value)}
              required
              disabled={!coverage}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{coverage ? '-- เลือกความคุ้มครอง --' : 'กรุณาเลือกประเภทกรมธรรม์ก่อน'}</option>
              {REPAIR_TYPE_OPTIONS.filter((item) => availableRepairTypes.includes(item.value)).map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="brand" className="mb-2 block text-base font-semibold text-[#12131a]">
            ยี่ห้อรถ
          </label>
          <div className="relative">
            <select
              id="brand"
              name="brand"
              value={brand}
              onChange={(event) => resetAfterBrand(event.target.value)}
              required
              disabled={!repairType}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{repairType ? '-- เลือกยี่ห้อรถ --' : 'กรุณาเลือกความคุ้มครองก่อน'}</option>
              {brands.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="model" className="mb-2 block text-base font-semibold text-[#12131a]">
            รุ่นรถ
          </label>
          <div className="relative">
            <select
              id="model"
              name="model"
              value={model}
              onChange={(event) => resetAfterModel(event.target.value)}
              required
              disabled={!brand}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{brand ? '-- เลือกรุ่นรถ --' : 'กรุณาเลือกยี่ห้อก่อน'}</option>
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <SelectChevron />
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
              onChange={(event) => resetAfterYear(event.target.value)}
              required
              disabled={!model}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{model ? '-- เลือกปีจดทะเบียน --' : 'กรุณาเลือกรุ่นรถก่อน'}</option>
              {years.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="cubicCapacity" className="mb-2 block text-base font-semibold text-[#12131a]">
            ขนาดเครื่องยนต์
          </label>
          <div className="relative">
            <select
              id="cubicCapacity"
              name="cubicCapacity"
              value={cubicCapacity}
              onChange={(event) => resetAfterCubicCapacity(event.target.value)}
              required
              disabled={!year}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{year ? '-- เลือกขนาดเครื่องยนต์ --' : 'กรุณาเลือกปีจดทะเบียนก่อน'}</option>
              {cubicCapacityOptions.map((item) => (
                <option key={`${item.value}-${item.label}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        <div>
          <label htmlFor="sumInsured" className="mb-2 block text-base font-semibold text-[#12131a]">
            เลือกทุนประกัน
          </label>
          <div className="relative">
            <select
              id="sumInsured"
              name="sumInsured"
              value={sumInsured}
              onChange={(event) => setSumInsured(event.target.value)}
              required
              disabled={!cubicCapacity}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{cubicCapacity ? '-- ทุนประกัน --' : 'กรุณาเลือกขนาดเครื่องยนต์ก่อน'}</option>
              {sumInsuredOptions.map((item) => (
                <option key={item} value={item}>
                  {formatSumInsured(item)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl bg-[#dfe5ff] px-4 py-4 text-[#3a4258] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0047BA] text-xs font-bold text-white">
            i
          </div>
          <p className="text-sm font-medium leading-6">
            ระบบจะกรองจากประเภทรถ ประเภทกรมธรรม์ ความคุ้มครอง อายุรถ ขนาดเครื่องยนต์ และทุนประกันตามตารางเบี้ยของบริษัทประกัน
          </p>
        </div>
      </section>

      <div className="mt-6">
        <button
          type="submit"
          disabled={!sClass || !coverage || !repairType || !brand || !model || !year || !cubicCapacity || !sumInsured}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,71,186,0.28)] transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:bg-[#7f9fe0]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
          </svg>
          ค้นหาแผนประกัน
        </button>
      </div>
    </form>
  );
}
