'use client';

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createTypeOneQuoteLead } from '@/lib/actions';

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

function getVehicleOptionCoverage(coverage: string) {
  return coverage === '2+' || coverage === '3+' ? '3' : coverage;
}

function formatSumInsured(value: number) {
  if (value === 0) {
    return 'ไม่คุ้มครอง';
  }

  return value.toLocaleString('th-TH');
}

function formatCubicCapacity(value: number) {
  if (value >= 9999) {
    return 'มากกว่า 3,000 ซีซี';
  }

  return `${value.toLocaleString('th-TH')} ซีซี`;
}

function isSeatBasedVehicleType(sClass: string) {
  return sClass === '210';
}

function formatSeatCount(value: number) {
  return `${value.toLocaleString('th-TH')} ที่นั่ง`;
}

function formatCubicCapacityRange(min: number, max: number, seatBased = false) {
  if (seatBased) {
    if (min === 0 && max >= 9999) {
      return 'ทุกจำนวนที่นั่ง';
    }

    if (min === 0) {
      return `ไม่เกิน ${formatSeatCount(max)}`;
    }

    if (max >= 9999) {
      return `ตั้งแต่ ${formatSeatCount(min)} ขึ้นไป`;
    }

    if (min === max) {
      return formatSeatCount(min);
    }

    return `${formatSeatCount(min)} - ${formatSeatCount(max)}`;
  }

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
  return Number.isFinite(parsed) ? Math.max(new Date().getFullYear() - parsed + 1, 1) : null;
}

function getRegistrationYearFromCarAge(age: number) {
  const currentYear = new Date().getFullYear();
  return age <= 0 ? currentYear : currentYear - age + 1;
}

function getMaxCarAgeForSelection(coverage: string, repairType: string) {
  if (repairType === 'dealer') {
    return 7;
  }

  if (coverage === '2+' && repairType === 'garage') {
    return 20;
  }

  if ((coverage === '3+' || coverage === '3') && repairType === 'garage') {
    return 30;
  }

  return null;
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

type LiffProfile = {
  userId: string;
  displayName?: string;
};

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  getProfile: () => Promise<LiffProfile>;
};

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

function loadLiffSdk() {
  const currentWindow = window as Window & { liff?: LiffClient };

  if (currentWindow.liff) {
    return Promise.resolve(currentWindow.liff);
  }

  return new Promise<LiffClient>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => (currentWindow.liff ? resolve(currentWindow.liff) : reject(new Error('LIFF SDK did not load'))), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('LIFF SDK failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.onload = () => (currentWindow.liff ? resolve(currentWindow.liff) : reject(new Error('LIFF SDK did not load')));
    script.onerror = () => reject(new Error('LIFF SDK failed to load'));
    document.head.appendChild(script);
  });
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
  const [noCampaignModalOpen, setNoCampaignModalOpen] = useState(false);
  const [dismissedNoCampaignKey, setDismissedNoCampaignKey] = useState('');
  const [leadCustomerName, setLeadCustomerName] = useState('');
  const [leadCustomerPhone, setLeadCustomerPhone] = useState('');
  const [leadLineId, setLeadLineId] = useState('');
  const [leadLineDisplayName, setLeadLineDisplayName] = useState('');
  const [hasLiffProfile, setHasLiffProfile] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadSuccessNumber, setLeadSuccessNumber] = useState('');
  const isSeatBasedSelection = isSeatBasedVehicleType(sClass);
  const [leadError, setLeadError] = useState('');
  const [isLeadPending, startLeadTransition] = useTransition();

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

  const vehicleSelectionRows = useMemo(() => {
    if (!sClass || !coverage) {
      return [];
    }

    const vehicleOptionCoverage = getVehicleOptionCoverage(coverage);
    return optionRows.filter((row) => row.sClass === sClass && (coverage === '1' || row.coverageType === vehicleOptionCoverage));
  }, [coverage, optionRows, sClass]);

  const isRepairAutoSwitchPending = Boolean(
      coverage &&
      repairType &&
      availableRepairTypes.length === 1 &&
      !availableRepairTypes.includes(repairType as RepairType)
  );
  const noCampaignKey = [sClass, coverage, repairType, brand, model, year, cubicCapacity].join('|');

  const brands = useMemo(() => uniqueValues(vehicleSelectionRows.map((row) => row.brand)), [vehicleSelectionRows]);

  const models = useMemo(() => {
    if (!brand) {
      return [];
    }

    return uniqueValues(vehicleSelectionRows.filter((row) => row.brand === brand).map((row) => row.model));
  }, [brand, vehicleSelectionRows]);

  const years = useMemo(() => {
    if (!brand || !model) {
      return [];
    }

    const yearSet = new Set<string>();
    const maxAllowedAge = getMaxCarAgeForSelection(coverage, repairType);

    vehicleSelectionRows
      .filter((row) => row.brand === brand && row.model === model)
      .forEach((row) => {
        const minAge = row.minCarAge ?? row.maxCarAge;

        if (minAge === null || minAge === undefined) {
          return;
        }

        const maxAge = row.maxCarAge ?? minAge;
        const effectiveMaxAge = maxAllowedAge === null ? maxAge : Math.min(maxAge, maxAllowedAge);

        if (minAge > effectiveMaxAge) {
          return;
        }

        for (let age = minAge; age <= effectiveMaxAge; age += 1) {
          yearSet.add(String(getRegistrationYearFromCarAge(age)));
        }
      });

    return Array.from(yearSet).sort((left, right) => Number(right) - Number(left));
  }, [brand, coverage, repairType, vehicleSelectionRows, model]);

  const cubicCapacityOptions = useMemo(() => {
    if (!brand || !model || !year) {
      return [];
    }

    const optionMap = new Map<string, { value: string; label: string; sortValue: number }>();

    vehicleSelectionRows
      .filter((row) => row.brand === brand && row.model === model && rowMatchesRegistrationYear(row, year))
      .forEach((row) => {
        const min = row.minCubicCapacity ?? 0;
        const max = row.maxCubicCapacity ?? min;
        const value = max >= 9999 ? String(min || max) : String(max);
        const label = formatCubicCapacityRange(min, max, isSeatBasedSelection);
        optionMap.set(`${min}-${max}`, {
          value,
          label,
          sortValue: min || max
        });
      });

    return Array.from(optionMap.values()).sort((left, right) => left.sortValue - right.sortValue);
  }, [brand, isSeatBasedSelection, vehicleSelectionRows, model, year]);

  const sumInsuredOptions = useMemo(() => {
    if (!brand || !model || !year || !cubicCapacity) {
      return [];
    }

    const selectedCapacity = Number.parseInt(cubicCapacity, 10);
    const sourceRows = coverage === '1' ? vehicleSelectionRows : filteredRows;
    const values = sourceRows
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
  }, [brand, coverage, cubicCapacity, filteredRows, model, vehicleSelectionRows, year]);

  useEffect(() => {
    if (coverage === '1') {
      return;
    }

    if (coverage && availableRepairTypes.length === 1 && repairType !== availableRepairTypes[0]) {
      setRepairType(availableRepairTypes[0]);
    }
  }, [availableRepairTypes, coverage, repairType]);

  useEffect(() => {
    if (coverage !== '1') {
      setHasLiffProfile(false);
      return;
    }

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();

    if (!liffId) {
      return;
    }

    let cancelled = false;

    loadLiffSdk()
      .then(async (liff) => {
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          return;
        }

        const profile = await liff.getProfile();

        if (!cancelled) {
          setLeadLineId((current) => current || profile.userId);
          setLeadLineDisplayName(profile.displayName ?? '');
          setHasLiffProfile(Boolean(profile.userId));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setHasLiffProfile(false);
        }
        console.warn('[LIFF] quote lead profile initialization failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, [coverage]);

  useEffect(() => {
    if (coverage === '3' && sumInsured) {
      setSumInsured('');
    }
  }, [coverage, sumInsured]);

  useEffect(() => {
    if (
      isRepairAutoSwitchPending ||
      noCampaignModalOpen ||
      dismissedNoCampaignKey === noCampaignKey ||
      !sClass ||
      !coverage ||
      coverage === '1' ||
      !repairType ||
      !brand ||
      !model ||
      !year ||
      !cubicCapacity
    ) {
      return;
    }

    if (sumInsuredOptions.length === 0) {
      setNoCampaignModalOpen(true);
    }
  }, [
    brand,
    coverage,
    cubicCapacity,
    dismissedNoCampaignKey,
    isRepairAutoSwitchPending,
    model,
    noCampaignKey,
    noCampaignModalOpen,
    repairType,
    sClass,
    sumInsuredOptions.length,
    year
  ]);

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
    if (normalizedCoverage === '1') {
      setRepairType('');
    } else if (nextAvailableRepairTypes.length === 1) {
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

    if (coverage === '1') {
      setLeadError('');
      setLeadSuccessNumber('');

      startLeadTransition(async () => {
        try {
          const result = await createTypeOneQuoteLead({
            customerName: leadCustomerName,
            customerPhone: leadCustomerPhone,
            lineId: leadLineId,
            lineDisplayName: leadLineDisplayName,
            email: leadEmail,
            sClass,
            brand,
            model,
            year,
            cubicCapacity
          });

          setLeadSuccessNumber(result.leadNumber);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'ส่งคำขอใบเสนอราคาไม่สำเร็จ';
          setLeadError(message);
        }
      });
      return;
    }

    const selectedCapacity = Number.parseInt(cubicCapacity, 10);
    const selectedSumInsured = Number.parseInt(sumInsured, 10);
    const shouldFilterBySumInsured = coverage !== '3' || Boolean(sumInsured);
    const hasMatchingCampaign = filteredRows.some(
      (row) =>
        row.brand === brand &&
        row.model === model &&
        rowMatchesRegistrationYear(row, year) &&
        (row.minCubicCapacity ?? 0) <= selectedCapacity &&
        (row.maxCubicCapacity ?? 999999) >= selectedCapacity &&
        (!shouldFilterBySumInsured || row.sumInsuredValues.includes(selectedSumInsured))
    );

    if (!hasMatchingCampaign) {
      setNoCampaignModalOpen(true);
      return;
    }

    const params = new URLSearchParams();
    params.set('sClass', sClass);
    params.set('coverage', coverage);
    params.set('repairType', repairType);
    params.set('brand', brand);
    params.set('model', model);
    params.set('year', year);
    params.set('cubicCapacity', cubicCapacity);
    if (sumInsured) {
      params.set('sumInsured', sumInsured);
    }

    router.push(`/line-app?${params.toString()}`);
  }

  return (
    <>
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

        {coverage !== '1' ? (
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
        ) : null}

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
              disabled={coverage === '1' ? !coverage : !repairType}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] px-4 py-4 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
            >
              <option value="">{(coverage === '1' || repairType) ? '-- เลือกยี่ห้อรถ --' : 'กรุณาเลือกความคุ้มครองก่อน'}</option>
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
            {isSeatBasedSelection ? 'จำนวนที่นั่ง' : 'ขนาดเครื่องยนต์'}
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
              <option value="">{year ? (isSeatBasedSelection ? '-- เลือกจำนวนที่นั่ง --' : '-- เลือกขนาดเครื่องยนต์ --') : 'กรุณาเลือกปีจดทะเบียนก่อน'}</option>
              {cubicCapacityOptions.map((item) => (
                <option key={`${item.value}-${item.label}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>

        {coverage !== '1' && coverage !== '3' ? (
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
              <option value="">{cubicCapacity ? '-- ทุนประกัน --' : isSeatBasedSelection ? 'กรุณาเลือกจำนวนที่นั่งก่อน' : 'กรุณาเลือกขนาดเครื่องยนต์ก่อน'}</option>
              {sumInsuredOptions.map((item) => (
                <option key={item} value={item}>
                  {formatSumInsured(item)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
        ) : null}

        {coverage === '1' ? (
          <section className="rounded-2xl border border-[#d8dcec] bg-[#f8faff] p-4">
            <h3 className="font-[Kanit,sans-serif] text-lg font-bold text-[#0047BA]">ข้อมูลติดต่อกลับ</h3>
            <p className="mt-1 text-sm leading-6 text-[#4b5265]">ส่งข้อมูลให้ทีมเซลจัดทำใบเสนอราคาประเภท 1</p>

            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="leadCustomerName" className="mb-2 block text-sm font-semibold text-[#12131a]">
                  ชื่อ-นามสกุล
                </label>
                <input
                  id="leadCustomerName"
                  name="leadCustomerName"
                  value={leadCustomerName}
                  onChange={(event) => setLeadCustomerName(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-[#d8dcec] bg-white px-4 py-3 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:ring-4 focus:ring-[#0047BA]/10"
                  placeholder="ชื่อผู้ติดต่อ"
                />
              </div>

              <div>
                <label htmlFor="leadCustomerPhone" className="mb-2 block text-sm font-semibold text-[#12131a]">
                  เบอร์โทร
                </label>
                <input
                  id="leadCustomerPhone"
                  name="leadCustomerPhone"
                  value={leadCustomerPhone}
                  onChange={(event) => setLeadCustomerPhone(event.target.value)}
                  required
                  inputMode="tel"
                  className="w-full rounded-2xl border border-[#d8dcec] bg-white px-4 py-3 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:ring-4 focus:ring-[#0047BA]/10"
                  placeholder="เช่น 0812345678"
                />
              </div>

              {!hasLiffProfile ? (
                <div>
                <label htmlFor="leadLineId" className="mb-2 block text-sm font-semibold text-[#12131a]">
                  LINE ID
                </label>
                <input
                  id="leadLineId"
                  name="leadLineId"
                  value={leadLineId}
                  onChange={(event) => setLeadLineId(event.target.value)}
                  className="w-full rounded-2xl border border-[#d8dcec] bg-white px-4 py-3 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:ring-4 focus:ring-[#0047BA]/10"
                  placeholder="ถ้าเปิดผ่าน LINE ระบบจะพยายามดึงให้อัตโนมัติ"
                />
                </div>
              ) : (
                <div className="rounded-2xl border border-[#cfe8d8] bg-[#f0fbf5] px-4 py-3 text-sm font-semibold text-[#087443]">
                  เชื่อมต่อ LINE profile แล้ว
                  {leadLineDisplayName ? <span className="font-normal text-[#3a4258]"> ({leadLineDisplayName})</span> : null}
                </div>
              )}

              <div>
                <label htmlFor="leadEmail" className="mb-2 block text-sm font-semibold text-[#12131a]">
                  อีเมล <span className="font-normal text-[#6b7280]">(ไม่บังคับ)</span>
                </label>
                <input
                  id="leadEmail"
                  name="leadEmail"
                  value={leadEmail}
                  onChange={(event) => setLeadEmail(event.target.value)}
                  type="email"
                  className="w-full rounded-2xl border border-[#d8dcec] bg-white px-4 py-3 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:ring-4 focus:ring-[#0047BA]/10"
                  placeholder="name@example.com"
                />
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <section className="mt-6 rounded-2xl bg-[#dfe5ff] px-4 py-4 text-[#3a4258] shadow-[0_8px_24px_rgba(0,0,0,0.05)]">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0047BA] text-xs font-bold text-white">
            i
          </div>
          <p className="text-sm font-medium leading-6">
            ระบบจะกรองจากประเภทรถ ประเภทกรมธรรม์ ความคุ้มครอง อายุรถ {isSeatBasedSelection ? 'จำนวนที่นั่ง' : 'ขนาดเครื่องยนต์'} และทุนประกันตามตารางเบี้ยของบริษัทประกัน
          </p>
        </div>
      </section>

      <div className="mt-6">
        <button
          type="submit"
          disabled={
            coverage === '1'
              ? !sClass || !coverage || !brand || !model || !year || !cubicCapacity || !leadCustomerName || !leadCustomerPhone || isLeadPending
              : !sClass || !coverage || !repairType || !brand || !model || !year || !cubicCapacity || (coverage !== '3' && !sumInsured)
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,71,186,0.28)] transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:bg-[#7f9fe0]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
          </svg>
          {coverage === '1' ? (isLeadPending ? 'กำลังส่งคำขอ...' : 'ขอใบเสนอราคา') : 'ค้นหาแผนประกัน'}
        </button>
        {leadSuccessNumber ? (
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-700">
            ส่งคำขอเรียบร้อยแล้ว เลขที่คำขอ {leadSuccessNumber}
          </p>
        ) : null}
        {leadError ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700">
            {leadError}
          </p>
        ) : null}
      </div>
    </form>
    {noCampaignModalOpen ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/45 px-4 py-6 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-campaign-title"
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-[0_24px_70px_rgba(4,16,61,0.25)] ring-1 ring-white/70"
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fff4d8] text-[#b36b00]">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.3 4.6 2.9 17.4A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.6L13.7 4.6a2 2 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h2 id="no-campaign-title" className="mt-4 text-xl font-bold text-[#071129]">
            ไม่มีแคมเปญสำหรับรุ่นนี้ สามารถเลือกแผนอื่นได้
          </h2>
          <button
            type="button"
            onClick={() => {
              setDismissedNoCampaignKey(noCampaignKey);
              setNoCampaignModalOpen(false);
            }}
            className="mt-6 w-full rounded-2xl bg-[#0047BA] px-4 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(0,71,186,0.25)] transition hover:bg-[#003c9d]"
          >
            ปรับเงื่อนไขใหม่
          </button>
        </div>
      </div>
    ) : null}
    </>
  );
}
