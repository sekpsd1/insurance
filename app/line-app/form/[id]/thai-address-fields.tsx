'use client';

import { useMemo, useState } from 'react';
import {
  getThaiDistrictOptions,
  getThaiPostalCodeOptions,
  getThaiProvinceOptions,
  getThaiSubDistrictOptions
} from '@/lib/thai-address';

const POLICY_FORM_DRAFT_STORAGE_KEY = 'line-app:policy-form-draft:v1';

const inputClass =
  'w-full rounded-md border border-slate-200 bg-white px-3.5 text-[14px] font-semibold text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100';
const selectClass =
  'h-11 w-full appearance-none rounded-md border border-slate-200 bg-white px-3.5 pr-11 text-[14px] font-semibold text-slate-900 shadow-sm outline-none transition focus:border-[#0b58c6] focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400';

function readDraftValue(name: string) {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const rawDraft = window.localStorage.getItem(POLICY_FORM_DRAFT_STORAGE_KEY);
    const draft = rawDraft ? (JSON.parse(rawDraft) as Record<string, string>) : null;
    return draft?.[name] ?? '';
  } catch {
    return '';
  }
}

function SelectChevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute right-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#4f5564]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SelectField({
  label,
  name,
  value,
  placeholder,
  options,
  disabled,
  onChange
}: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  options: string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[14px] font-bold text-[#2f3442]">
        {label}
      </label>
      <div className="relative">
        <select
          id={name}
          name={name}
          required
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <SelectChevron />
      </div>
    </div>
  );
}

export function ThaiAddressFields() {
  const provinces = useMemo(() => getThaiProvinceOptions(), []);
  const [province, setProvince] = useState(() => readDraftValue('province'));
  const [district, setDistrict] = useState(() => readDraftValue('district'));
  const [subDistrict, setSubDistrict] = useState(() => readDraftValue('subDistrict'));
  const [postalCode, setPostalCode] = useState(() => readDraftValue('postalCode'));

  const districts = useMemo(() => getThaiDistrictOptions(province), [province]);
  const subDistricts = useMemo(() => getThaiSubDistrictOptions(province, district), [district, province]);
  const postalCodes = useMemo(
    () => getThaiPostalCodeOptions(province, district, subDistrict),
    [district, province, subDistrict]
  );

  const handleProvinceChange = (nextProvince: string) => {
    setProvince(nextProvince);
    setDistrict('');
    setSubDistrict('');
    setPostalCode('');
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    setSubDistrict('');
    setPostalCode('');
  };

  const handleSubDistrictChange = (nextSubDistrict: string) => {
    const nextPostalCodes = getThaiPostalCodeOptions(province, district, nextSubDistrict);

    setSubDistrict(nextSubDistrict);
    setPostalCode(nextPostalCodes.length === 1 ? nextPostalCodes[0] : '');
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="customerAddress" className="mb-2 block text-[14px] font-bold text-[#2f3442]">
          บ้านเลขที่ / หมู่ / ซอย / ถนน
        </label>
        <textarea
          id="customerAddress"
          name="customerAddress"
          rows={3}
          required
          placeholder="เช่น 55/233 ถนนสุขสวัสดิ์ หมู่บ้านตัวอย่าง"
          className={`${inputClass} min-h-[76px] py-2.5 leading-6`}
        />
      </div>

      <SelectField
        label="จังหวัด"
        name="province"
        value={province}
        placeholder="เลือกจังหวัด"
        options={provinces}
        onChange={handleProvinceChange}
      />
      <SelectField
        label="อำเภอ / เขต"
        name="district"
        value={district}
        placeholder="เลือกอำเภอ / เขต"
        options={districts}
        disabled={!province}
        onChange={handleDistrictChange}
      />
      <SelectField
        label="ตำบล / แขวง"
        name="subDistrict"
        value={subDistrict}
        placeholder="เลือกตำบล / แขวง"
        options={subDistricts}
        disabled={!district}
        onChange={handleSubDistrictChange}
      />
      <SelectField
        label="รหัสไปรษณีย์"
        name="postalCode"
        value={postalCode}
        placeholder="เลือกรหัสไปรษณีย์"
        options={postalCodes}
        disabled={!subDistrict}
        onChange={setPostalCode}
      />
    </div>
  );
}
