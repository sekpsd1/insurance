'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCtpOptionForSClass } from '@/lib/ctp';

type ComparePackageCard = {
  id: string;
  name: string;
  company: string;
  logoUrl: string | null;
  details: string | null;
  repairType: string | null;
  coverage: string | null;
  coverageType: string | null;
  sClass: string | null;
  minCubicCapacity: number | null;
  maxCubicCapacity: number | null;
  minSumInsured: number | null;
  maxSumInsured: number | null;
  fullPrice: number;
  netPrice: number;
  discount: number;
};

type CompareSelectionProps = {
  packages: ComparePackageCard[];
  baseQueryString: string;
};

const MAX_COMPARE_PACKAGES = 4;

function formatMoney(value: number) {
  return value.toLocaleString('th-TH');
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function getCoverageLabel(value: string) {
  if (value === '2+') return 'ประกัน 2+';
  if (value === '3+') return 'ประกัน 3+';
  if (value === '3') return 'ประกันชั้น 3';
  return value;
}

function formatSumInsuredRange(min: number | null | undefined, max: number | null | undefined) {
  if (!min && !max) {
    return '-';
  }

  if (min && max && min !== max) {
    return `${formatMoney(min)}-${formatMoney(max)} บาท`;
  }

  return `${formatMoney(min ?? max ?? 0)} บาท`;
}

function encodeLogoUrl(logoUrl: string) {
  return logoUrl
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

export default function CompareSelection({
  packages,
  baseQueryString
}: CompareSelectionProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ctpPackageIds, setCtpPackageIds] = useState<string[]>([]);
  const [failedLogoIds, setFailedLogoIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const selectedCount = selectedIds.length;

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const ctpPackageIdSet = useMemo(() => new Set(ctpPackageIds), [ctpPackageIds]);
  const failedLogoIdSet = useMemo(() => new Set(failedLogoIds), [failedLogoIds]);

  function markLogoFailed(id: string) {
    setFailedLogoIds((current) => (current.includes(id) ? current : [...current, id]));
  }

  function togglePackage(id: string) {
    setError('');
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      if (current.length >= MAX_COMPARE_PACKAGES) {
        setError(`เลือกได้สูงสุด ${MAX_COMPARE_PACKAGES} แผน`);
        return current;
      }

      return [...current, id];
    });
  }

  function toggleCtp(id: string) {
    setCtpPackageIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function buildFormHref(id: string, includeCtp: boolean) {
    const params = new URLSearchParams(baseQueryString);

    if (includeCtp) {
      params.set('includeCtp', '1');
    } else {
      params.delete('includeCtp');
    }

    const query = params.toString();
    return query ? `/line-app/form/${id}?${query}` : `/line-app/form/${id}`;
  }

  function handleCompare() {
    if (selectedIds.length < 2) {
      setError('กรุณาเลือกอย่างน้อย 2 แผนเพื่อเปรียบเทียบ');
      return;
    }

    const params = new URLSearchParams(baseQueryString);
    selectedIds.forEach((id) => params.append('ids', id));
    router.push(`/line-app/compare?${params.toString()}`);
  }

  return (
    <>
      <div className="space-y-4">
        {packages.map((pkg) => {
          const isSelected = selectedIdSet.has(pkg.id);
          const ctpOption = getCtpOptionForSClass(pkg.sClass);
          const isCtpSelected = ctpPackageIdSet.has(pkg.id);
          const totalPrice = pkg.netPrice + (isCtpSelected && ctpOption ? ctpOption.total : 0);

          return (
            <div
              key={pkg.id}
              className={`overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] ${
                isSelected ? 'ring-2 ring-[#0052CC]' : ''
              }`}
            >
              <div className="relative p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[rgba(195,198,214,0.35)] bg-[#eef3ff] shadow-sm">
                      {pkg.logoUrl && !failedLogoIdSet.has(pkg.id) ? (
                        <img
                          src={encodeLogoUrl(pkg.logoUrl)}
                          alt={pkg.company}
                          onError={() => markLogoFailed(pkg.id)}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <span className="px-1 text-center text-xs font-bold leading-4 text-[#0052CC]">
                          {pkg.company.slice(0, 6)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="font-[Kanit,sans-serif] text-xl font-bold leading-tight text-[#0052CC]">{pkg.name}</h2>
                      <p className="mt-1 text-sm text-[#434654]">{pkg.company}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-[#0f4ec7] px-3 py-1 text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(15,78,199,0.18)]">
                          {getCoverageLabel(pkg.coverageType || '')}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#0f4ec7] px-3 py-1 text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(15,78,199,0.18)]">
                          {getText(pkg.repairType, 'อู่ประกัน')}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-[#0f4ec7] px-3 py-1 text-xs font-semibold leading-none text-white shadow-[0_2px_8px_rgba(15,78,199,0.18)]">
                          {getText(pkg.coverage, 'ยังไม่ได้ระบุความคุ้มครอง')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => togglePackage(pkg.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      isSelected
                        ? 'bg-[#0052CC] text-white shadow-[0_2px_8px_rgba(0,82,204,0.25)]'
                        : 'bg-[#eef3ff] text-[#0052CC] hover:bg-[#dde7ff]'
                    }`}
                  >
                    <span aria-hidden="true">{isSelected ? '✓' : '+'}</span>
                    {isSelected ? 'เลือกแล้ว' : 'เปรียบเทียบ'}
                  </button>
                </div>

                <div className="mb-5 space-y-2 rounded-lg bg-[#faf8ff] p-4">
                  <div className="flex items-center justify-between gap-4 text-sm text-[#434654]">
                    <span>ราคาตลาดทั่วไป:</span>
                    <span className="line-through">{formatMoney(pkg.fullPrice)} บาท</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-base font-semibold text-[#0052CC]">
                    <span>เบี้ยประกันราคาทุน:</span>
                    <span>{formatMoney(pkg.netPrice)} บาท</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm font-semibold text-[#006c7a]">
                    <span>ทุนประกัน:</span>
                    <span>{formatSumInsuredRange(pkg.minSumInsured, pkg.maxSumInsured)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-4 text-sm font-medium text-[#109e06]">
                    <span>ค่าบริการแพลตฟอร์ม:</span>
                    <span>0 บาท (ฟรี!)</span>
                  </div>

                  <div className="my-2 h-px w-full bg-[rgba(195,198,214,0.2)]" />

                  {ctpOption ? (
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#b8d9de] bg-white px-3 py-3 text-sm font-semibold text-[#074a52] transition hover:border-[#00899a]">
                      <span className="flex min-w-0 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isCtpSelected}
                          onChange={() => toggleCtp(pkg.id)}
                          className="h-4 w-4 rounded border-slate-300 text-[#00899a] focus:ring-[#00899a]"
                        />
                        <span className="truncate">+ เพิ่ม พ.ร.บ. {ctpOption.rateCode}</span>
                      </span>
                      <span className="shrink-0 text-base font-bold text-[#00899a]">฿ {formatMoney(ctpOption.total)}</span>
                    </label>
                  ) : null}

                  {ctpOption ? <div className="my-2 h-px w-full bg-[rgba(195,198,214,0.2)]" /> : null}

                  <div className="flex items-center justify-between gap-4 text-lg font-bold text-[#0052CC]">
                    <span>ยอดรวมสุทธิ:</span>
                    <span>{formatMoney(totalPrice)} บาท</span>
                  </div>
                </div>

                <a
                  href={buildFormHref(pkg.id, isCtpSelected)}
                  className="flex w-full items-center justify-center gap-2 bg-[#0052CC] py-4 font-[Kanit,sans-serif] text-base font-semibold text-white transition-colors hover:bg-[#0040a2]"
                >
                  ดูรายละเอียด / เลือกแผนนี้
                  <span aria-hidden="true" className="text-sm">→</span>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {packages.length >= 2 ? (
      <div className="sticky bottom-4 rounded-3xl bg-white p-4 shadow-[0_10px_30px_rgba(4,16,61,0.08)] ring-1 ring-white/70">
        {error ? <p className="mb-2 text-center text-sm font-medium text-red-600">{error}</p> : null}
        <button
          type="button"
          onClick={handleCompare}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0047BA] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#003c9d]"
        >
          เปรียบเทียบแผนที่เลือก
          <span aria-hidden="true">→</span>
        </button>
        <p className="mt-2 text-center text-xs text-[#4b5265]">เลือกอย่างน้อย 2 แผนจากการ์ดด้านบน</p>
        <p className="mt-1 text-center text-xs text-[#4b5265]">เลือกแล้ว {selectedCount} แผน</p>
      </div>
      ) : null}
    </>
  );
}
