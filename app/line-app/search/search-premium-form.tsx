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

type SearchPremiumDraft = {
  sClass?: string;
  coverage?: string;
  repairType?: string;
  brand?: string;
  model?: string;
  year?: string;
  cubicCapacity?: string;
  sumInsured?: string;
  leadCustomerName?: string;
  leadCustomerPhone?: string;
  leadLineId?: string;
  leadEmail?: string;
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

const SEARCH_DRAFT_STORAGE_KEY = 'line-app:search-draft:v1';

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

const MAX_FALLBACK_VEHICLE_CAR_AGE = 30;

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

function getStoredSearchDraft() {
  try {
    const rawDraft = window.localStorage.getItem(SEARCH_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as SearchPremiumDraft) : null;
  } catch {
    return null;
  }
}

function setStoredSearchDraft(draft: SearchPremiumDraft) {
  try {
    window.localStorage.setItem(SEARCH_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures so the quote form still works in restricted browsers.
  }
}

function clearStoredSearchFilterDraft(draft: Pick<SearchPremiumDraft, 'leadCustomerName' | 'leadCustomerPhone' | 'leadLineId' | 'leadEmail'>) {
  try {
    const nextDraft: SearchPremiumDraft = {
      leadCustomerName: draft.leadCustomerName,
      leadCustomerPhone: draft.leadCustomerPhone,
      leadLineId: draft.leadLineId,
      leadEmail: draft.leadEmail
    };
    const hasLeadDraft = Object.values(nextDraft).some(Boolean);

    if (hasLeadDraft) {
      window.localStorage.setItem(SEARCH_DRAFT_STORAGE_KEY, JSON.stringify(nextDraft));
      return;
    }

    window.localStorage.removeItem(SEARCH_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures so search navigation still works in restricted browsers.
  }
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

type SelectIconType = 'car' | 'shield' | 'clipboard' | 'brand' | 'calendar' | 'gauge' | 'cash';

function SelectIcon({ type }: { type: SelectIconType }) {
  const pathByType: Record<SelectIconType, string> = {
    car: 'M7.1 7.25A3 3 0 0 1 9.92 5.2h4.16a3 3 0 0 1 2.82 2.05l.5 1.5h.85A2.75 2.75 0 0 1 21 11.5v4.75a.75.75 0 0 1-.75.75H19a2.25 2.25 0 0 1-4.5 0h-5A2.25 2.25 0 0 1 5 17H3.75a.75.75 0 0 1-.75-.75V11.5a2.75 2.75 0 0 1 2.75-2.75h.85l.5-1.5Zm1.8.47-.34 1.03h6.88l-.34-1.03a1.1 1.1 0 0 0-1.02-.72H9.92a1.1 1.1 0 0 0-1.02.72ZM6 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm12 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
    shield:
      'M12 2.25c.16 0 .32.03.47.1l7 3A.75.75 0 0 1 20 6.04v5.35c0 4.65-2.8 8.74-7.1 10.35a2.45 2.45 0 0 1-1.8 0C6.8 20.13 4 16.04 4 11.39V6.04c0-.3.18-.57.46-.69l7-3c.16-.07.34-.1.54-.1Zm4.56 7.53a.8.8 0 0 0-1.12-1.14l-4.34 4.22-1.55-1.58a.8.8 0 1 0-1.14 1.12l2.11 2.16a.8.8 0 0 0 1.13.01l4.91-4.79Z',
    clipboard:
      'M9 3.25h6c.6 0 1.12.36 1.34.9l.44 1.1H18A2.75 2.75 0 0 1 20.75 8v10A2.75 2.75 0 0 1 18 20.75H6A2.75 2.75 0 0 1 3.25 18V8A2.75 2.75 0 0 1 6 5.25h1.22l.44-1.1c.22-.54.75-.9 1.34-.9Zm-.25 5.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 4a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 4a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z',
    brand:
      'M6 4.25h12A2.75 2.75 0 0 1 20.75 7v2.25H3.25V7A2.75 2.75 0 0 1 6 4.25Zm-2.75 6.5h17.5V17A2.75 2.75 0 0 1 18 19.75H6A2.75 2.75 0 0 1 3.25 17v-6.25Zm4 2.25a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-4.5Z',
    calendar:
      'M7.5 2.5a.9.9 0 0 1 .9.9v1.1h7.2V3.4a.9.9 0 1 1 1.8 0v1.1H18A2.75 2.75 0 0 1 20.75 7.25v10.5A2.75 2.75 0 0 1 18 20.5H6a2.75 2.75 0 0 1-2.75-2.75V7.25A2.75 2.75 0 0 1 6 4.5h.6V3.4a.9.9 0 0 1 .9-.9Zm-2.45 8.15v7.1c0 .52.43.95.95.95h12c.52 0 .95-.43.95-.95v-7.1H5.05Z',
    gauge:
      'M12 4.25a8.75 8.75 0 0 1 8.75 8.75 8.65 8.65 0 0 1-1.35 4.66 2 2 0 0 1-1.7.94H6.3a2 2 0 0 1-1.7-.94A8.65 8.65 0 0 1 3.25 13 8.75 8.75 0 0 1 12 4.25Zm5.28 5.52a.8.8 0 0 0-1.06-1.2l-4.78 4.2a1.75 1.75 0 1 0 1.06 1.2l4.78-4.2Z',
    cash:
      'M4.75 6h14.5A2.75 2.75 0 0 1 22 8.75v6.5A2.75 2.75 0 0 1 19.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-6.5A2.75 2.75 0 0 1 4.75 6Zm1 3A1.75 1.75 0 0 1 4 10.75v2.5A1.75 1.75 0 0 1 5.75 15h12.5A1.75 1.75 0 0 1 20 13.25v-2.5A1.75 1.75 0 0 1 18.25 9H5.75ZM12 9.65a2.35 2.35 0 1 0 0 4.7 2.35 2.35 0 0 0 0-4.7Z'
  };

  return (
    <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#0052CC]">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d={pathByType[type]} />
      </svg>
    </span>
  );
}

type LiffProfile = {
  userId: string;
  displayName?: string;
};

type LiffClient = {
  init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>;
  isLoggedIn: () => boolean;
  getProfile: () => Promise<LiffProfile>;
  closeWindow?: () => void;
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
  const [draftLoaded, setDraftLoaded] = useState(false);
  const isSeatBasedSelection = isSeatBasedVehicleType(sClass);
  const [leadError, setLeadError] = useState('');
  const [isSearchSubmitting, setIsSearchSubmitting] = useState(false);
  const [isLeadPending, startLeadTransition] = useTransition();
  const isSubmitting = isSearchSubmitting || isLeadPending;
  const loadingTitle = coverage === '1' ? 'กำลังส่งคำขอใบเสนอราคา' : 'กำลังค้นหาแผนประกัน';
  const loadingDescription = coverage === '1' ? 'กรุณารอสักครู่ ระบบกำลังบันทึกข้อมูลให้ทีมขาย' : 'กรุณารอสักครู่ ระบบกำลังตรวจสอบแคมเปญที่ตรงกับข้อมูลรถ';
  const hasInitialSearch = Boolean(
    initialSClass ||
      initialCoverage ||
      initialRepairType ||
      initialBrand ||
      initialModel ||
      initialYear ||
      initialCubicCapacity ||
      initialSumInsured
  );

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

  useEffect(() => {
    if (hasInitialSearch) {
      setDraftLoaded(true);
      return;
    }

    const draft = getStoredSearchDraft();

    if (draft) {
      setLeadCustomerName(draft.leadCustomerName ?? '');
      setLeadCustomerPhone(draft.leadCustomerPhone ?? '');
      setLeadLineId(draft.leadLineId ?? '');
      setLeadEmail(draft.leadEmail ?? '');
    }

    setDraftLoaded(true);
  }, [hasInitialSearch]);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }

    setStoredSearchDraft({
      leadCustomerName,
      leadCustomerPhone,
      leadLineId,
      leadEmail
    });
  }, [
    draftLoaded,
    leadCustomerName,
    leadCustomerPhone,
    leadEmail,
    leadLineId
  ]);

  const vehicleSelectionRows = useMemo(() => {
    if (!sClass || !coverage) {
      return [];
    }

    const vehicleOptionCoverage = getVehicleOptionCoverage(coverage);
    return optionRows.filter((row) => row.sClass === sClass && (coverage === '1' || row.coverageType === vehicleOptionCoverage));
  }, [coverage, optionRows, sClass]);

  const selectedCoverageVehicleRows = useMemo(() => {
    if (!sClass || !coverage) {
      return [];
    }

    return optionRows.filter(
      (row) =>
        row.sClass === sClass &&
        row.coverageType === coverage &&
        (coverage === '1' || !repairType || row.repairType === repairType)
    );
  }, [coverage, optionRows, repairType, sClass]);

  const selectedCoverageFallbackRows = useMemo(() => {
    if (!sClass || !coverage) {
      return [];
    }

    return optionRows.filter((row) => row.sClass === sClass && row.coverageType === coverage);
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
    const exactRows = selectedCoverageVehicleRows.filter((row) => row.brand === brand && row.model === model);
    const exactFallbackRows = selectedCoverageFallbackRows.filter((row) => row.brand === brand && row.model === model);
    const sourceRows =
      exactRows.length > 0
        ? exactRows
        : exactFallbackRows.length > 0
          ? exactFallbackRows
          : vehicleSelectionRows.filter((row) => row.brand === brand && row.model === model);
    const usesTypeThreeVehicleFallback = exactRows.length === 0 && exactFallbackRows.length === 0 && (coverage === '2+' || coverage === '3+');
    const shouldCapVehicleAge = coverage === '1' || usesTypeThreeVehicleFallback;

    sourceRows.forEach((row) => {
        const minAge = row.minCarAge ?? row.maxCarAge;

        if (minAge === null || minAge === undefined) {
          return;
        }

        const rowMaxAge = row.maxCarAge ?? minAge;
        const maxAge = shouldCapVehicleAge ? Math.min(rowMaxAge, MAX_FALLBACK_VEHICLE_CAR_AGE) : rowMaxAge;

        if (minAge > maxAge) {
          return;
        }

        for (let age = minAge; age <= maxAge; age += 1) {
          yearSet.add(String(getRegistrationYearFromCarAge(age)));
        }
      });

    return Array.from(yearSet).sort((left, right) => Number(right) - Number(left));
  }, [brand, coverage, model, selectedCoverageFallbackRows, selectedCoverageVehicleRows, vehicleSelectionRows]);

  const cubicCapacityOptions = useMemo(() => {
    if (!brand || !model || !year) {
      return [];
    }

    const optionMap = new Map<string, { value: string; label: string; sortValue: number }>();
    const exactRows = selectedCoverageVehicleRows.filter((row) => row.brand === brand && row.model === model);
    const exactFallbackRows = selectedCoverageFallbackRows.filter((row) => row.brand === brand && row.model === model);
    const sourceRows =
      exactRows.length > 0
        ? exactRows
        : exactFallbackRows.length > 0
          ? exactFallbackRows
          : vehicleSelectionRows.filter((row) => row.brand === brand && row.model === model);

    sourceRows
      .filter((row) => rowMatchesRegistrationYear(row, year))
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
  }, [brand, isSeatBasedSelection, model, selectedCoverageFallbackRows, selectedCoverageVehicleRows, vehicleSelectionRows, year]);

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

    setIsSearchSubmitting(true);
    clearStoredSearchFilterDraft({
      leadCustomerName,
      leadCustomerPhone,
      leadLineId,
      leadEmail
    });
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
            <SelectIcon type="car" />
            <select
              id="sClass"
              name="sClass"
              value={sClass}
              onChange={(event) => resetAfterSClass(event.target.value)}
              required
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="shield" />
            <select
              id="coverage"
              name="coverage"
              value={coverage}
              onChange={(event) => resetAfterCoverage(event.target.value)}
              required
              disabled={!sClass}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="clipboard" />
            <select
              id="repairType"
              name="repairType"
              value={repairType}
              onChange={(event) => resetAfterRepairType(event.target.value)}
              required
              disabled={!coverage}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="brand" />
            <select
              id="brand"
              name="brand"
              value={brand}
              onChange={(event) => resetAfterBrand(event.target.value)}
              required
              disabled={coverage === '1' ? !coverage : !repairType}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="car" />
            <select
              id="model"
              name="model"
              value={model}
              onChange={(event) => resetAfterModel(event.target.value)}
              required
              disabled={!brand}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="calendar" />
            <select
              id="year"
              name="year"
              value={year}
              onChange={(event) => resetAfterYear(event.target.value)}
              required
              disabled={!model}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="gauge" />
            <select
              id="cubicCapacity"
              name="cubicCapacity"
              value={cubicCapacity}
              onChange={(event) => resetAfterCubicCapacity(event.target.value)}
              required
              disabled={!year}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <SelectIcon type="cash" />
            <select
              id="sumInsured"
              name="sumInsured"
              value={sumInsured}
              onChange={(event) => setSumInsured(event.target.value)}
              required
              disabled={!cubicCapacity}
              className="w-full appearance-none rounded-2xl border border-[#d8dcec] bg-[#eaecf7] py-4 pl-12 pr-12 text-[16px] text-[#12131a] outline-none transition disabled:cursor-not-allowed disabled:opacity-60 focus:border-[#0047BA] focus:bg-white focus:ring-4 focus:ring-[#0047BA]/10"
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
            <h3 className="font-[Kanit,sans-serif] text-lg font-bold text-[#0047BA]">แผนประกันนี้ เป็นแผนพิเศษนอกแคมเปญ</h3>
            <p className="mt-1 text-sm leading-6 text-[#4b5265]">
              หากท่านสนใจ กรุณากรอกข้อมูลเพื่อให้เจ้าหน้าที่ จัดทำใบเสนอราคาส่งให้อีกครั้ง
            </p>

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

      <div className="mt-6">
        <button
          type="submit"
          disabled={
            coverage === '1'
              ? !sClass || !coverage || !brand || !model || !year || !cubicCapacity || !leadCustomerName || !leadCustomerPhone || isSubmitting
              : isSubmitting || !sClass || !coverage || !repairType || !brand || !model || !year || !cubicCapacity || (coverage !== '3' && !sumInsured)
          }
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white shadow-[0_12px_30px_rgba(0,71,186,0.28)] transition hover:bg-[#003c9d] disabled:cursor-not-allowed disabled:bg-[#7f9fe0]"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m20 20-3.5-3.5" />
          </svg>
          {coverage === '1' ? (isLeadPending ? 'กำลังส่งคำขอ...' : 'ขอใบเสนอราคา') : isSearchSubmitting ? 'กำลังค้นหาแผน...' : 'ค้นหาแผนประกัน'}
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
    {isSubmitting ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/45 px-4 py-6 backdrop-blur-sm">
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-[0_24px_70px_rgba(4,16,61,0.25)] ring-1 ring-white/70"
        >
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#dbe7ff] border-t-[#0047BA]" />
          <h2 className="mt-4 text-xl font-bold text-[#071129]">{loadingTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[#4b5265]">{loadingDescription}</p>
        </div>
      </div>
    ) : null}
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
