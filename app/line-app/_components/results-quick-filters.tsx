'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type RepairType = 'dealer' | 'garage';
type CoverageType = '1' | '2+' | '3+' | '3';

type QuickFilterOptionRow = {
  coverageType: CoverageType;
  repairType: RepairType;
  sumInsuredValues: number[];
};

type ResultsQuickFiltersProps = {
  optionRows: QuickFilterOptionRow[];
  baseQueryString: string;
  searchHref: string;
  currentCoverage: string;
  currentRepairType: string;
  currentSumInsured: string;
  vehicleTitle: string;
  vehicleSubtitle: string;
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

function formatSumInsured(value: number) {
  if (value === 0) {
    return 'ไม่มีทุนประกัน';
  }

  return `${value.toLocaleString('th-TH')} บาท`;
}

function getCoverageLabel(value: string) {
  return COVERAGE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getRepairTypeLabel(value: string) {
  return REPAIR_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function getNextSumInsured(options: number[], currentValue: string) {
  if (options.some((value) => String(value) === currentValue)) {
    return currentValue;
  }

  return options.length > 0 ? String(options[0]) : '';
}

export default function ResultsQuickFilters({
  optionRows,
  baseQueryString,
  searchHref,
  currentCoverage,
  currentRepairType,
  currentSumInsured,
  vehicleTitle,
  vehicleSubtitle
}: ResultsQuickFiltersProps) {
  const router = useRouter();

  const availableCoverageOptions = useMemo(() => {
    const availableValues = new Set(optionRows.map((row) => row.coverageType));
    return COVERAGE_OPTIONS.filter((option) => availableValues.has(option.value));
  }, [optionRows]);

  const availableRepairOptions = useMemo(() => {
    const availableValues = new Set(
      optionRows
        .filter((row) => row.coverageType === currentCoverage)
        .map((row) => row.repairType)
    );

    return REPAIR_TYPE_OPTIONS.filter((option) => availableValues.has(option.value));
  }, [currentCoverage, optionRows]);

  const availableSumInsuredOptions = useMemo(() => {
    const values = optionRows
      .filter((row) => row.coverageType === currentCoverage && row.repairType === currentRepairType)
      .flatMap((row) => row.sumInsuredValues);

    return Array.from(new Set(values)).sort((left, right) => left - right);
  }, [currentCoverage, currentRepairType, optionRows]);

  function navigate(nextCoverage: string, nextRepairType: string, nextSumInsured: string) {
    const params = new URLSearchParams(baseQueryString);
    params.delete('page');
    params.set('coverage', nextCoverage);
    params.set('repairType', nextRepairType);

    if (nextSumInsured) {
      params.set('sumInsured', nextSumInsured);
    } else {
      params.delete('sumInsured');
    }

    router.push(`/line-app?${params.toString()}`);
  }

  function selectCoverage(nextCoverage: CoverageType) {
    const nextRepairOptions = REPAIR_TYPE_OPTIONS.filter((option) =>
      optionRows.some((row) => row.coverageType === nextCoverage && row.repairType === option.value)
    );
    const nextRepairType = nextRepairOptions.some((option) => option.value === currentRepairType)
      ? currentRepairType
      : nextRepairOptions[0]?.value ?? '';
    const nextSumOptions = optionRows
      .filter((row) => row.coverageType === nextCoverage && row.repairType === nextRepairType)
      .flatMap((row) => row.sumInsuredValues);
    const nextSumInsured = getNextSumInsured(Array.from(new Set(nextSumOptions)).sort((left, right) => left - right), currentSumInsured);

    if (nextRepairType) {
      navigate(nextCoverage, nextRepairType, nextSumInsured);
    }
  }

  function selectRepairType(nextRepairType: RepairType) {
    const nextSumOptions = optionRows
      .filter((row) => row.coverageType === currentCoverage && row.repairType === nextRepairType)
      .flatMap((row) => row.sumInsuredValues);
    const nextSumInsured = getNextSumInsured(Array.from(new Set(nextSumOptions)).sort((left, right) => left - right), currentSumInsured);

    navigate(currentCoverage, nextRepairType, nextSumInsured);
  }

  function selectSumInsured(nextSumInsured: string) {
    navigate(currentCoverage, currentRepairType, nextSumInsured);
  }

  if (optionRows.length === 0 || !currentCoverage || !currentRepairType) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-[#e6ebff]">
      <div className="flex items-center justify-between gap-3 border-b border-[#edf1fb] px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1f2a44]">{vehicleTitle}</p>
          <p className="mt-0.5 truncate text-xs text-[#667085]">{vehicleSubtitle}</p>
        </div>
        <Link
          href={searchHref}
          className="shrink-0 rounded-full border border-[#cfd8ff] bg-[#f6f8ff] px-3 py-2 text-xs font-semibold text-[#0052CC] transition hover:bg-[#eef3ff]"
        >
          แก้ข้อมูลรถ
        </Link>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#434654]">ประเภทกรมธรรม์</p>
          <div className="flex flex-wrap gap-2">
            {availableCoverageOptions.map((option) => {
              const isActive = option.value === currentCoverage;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectCoverage(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#0052CC] text-white shadow-[0_6px_16px_rgba(0,82,204,0.22)]'
                      : 'bg-[#eef3ff] text-[#0052CC] hover:bg-[#dde7ff]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-[#434654]">ความคุ้มครอง</p>
          <div className="flex flex-wrap gap-2">
            {availableRepairOptions.map((option) => {
              const isActive = option.value === currentRepairType;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectRepairType(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#0052CC] text-white shadow-[0_6px_16px_rgba(0,82,204,0.22)]'
                      : 'bg-[#eef3ff] text-[#0052CC] hover:bg-[#dde7ff]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-[#434654]">ทุนประกัน</span>
          <select
            value={currentSumInsured}
            onChange={(event) => selectSumInsured(event.target.value)}
            className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#f6f8ff] px-4 py-3 text-[16px] font-semibold text-[#1f2a44] outline-none transition focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-[#0052CC]/10"
          >
            {availableSumInsuredOptions.map((value) => (
              <option key={value} value={value}>
                {formatSumInsured(value)}
              </option>
            ))}
          </select>
        </label>

        <p className="rounded-2xl bg-[#eef3ff] px-3 py-2 text-xs leading-5 text-[#4c6394]">
          กำลังแสดง {getCoverageLabel(currentCoverage)} / {getRepairTypeLabel(currentRepairType)} เปลี่ยนตัวเลือกด้านบนได้โดยไม่ต้องกรอกรถใหม่
        </p>
      </div>
    </section>
  );
}
