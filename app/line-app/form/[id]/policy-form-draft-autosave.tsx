'use client';

import { useEffect } from 'react';

const POLICY_FORM_DRAFT_STORAGE_KEY = 'line-app:policy-form-draft:v1';

type PolicyFormDraft = Record<string, string>;

const DRAFT_FIELD_NAMES = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'customerAddress',
  'province',
  'district',
  'subDistrict',
  'postalCode',
  'idCardNumber',
  'policyStartDate',
  'ctpPolicyStartDate',
  'carBrand',
  'carModel',
  'carCubicCapacity',
  'carYear',
  'plateNumber',
  'plateProvince',
  'chassisNumber',
  'vehicleDocumentType',
  'deliveryAddressMode',
  'deliveryRecipientName',
  'deliveryRecipientPhone',
  'deliveryAddress'
];

function getDraftableField(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement
    ? field
    : null;
}

function readDraft() {
  try {
    const rawDraft = window.localStorage.getItem(POLICY_FORM_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PolicyFormDraft) : null;
  } catch {
    return null;
  }
}

function writeDraft(form: HTMLFormElement) {
  const draft: PolicyFormDraft = {};

  DRAFT_FIELD_NAMES.forEach((name) => {
    const field = getDraftableField(form, name);

    if (field) {
      draft[name] = field.value;
    }
  });

  try {
    window.localStorage.setItem(POLICY_FORM_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage failures so users can still continue the checkout flow.
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(POLICY_FORM_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures so submission is never blocked.
  }
}

export function ClearPolicyFormDraft() {
  useEffect(() => {
    clearDraft();
  }, []);

  return null;
}

export function PolicyFormDraftAutosave({ formId }: { formId: string }) {
  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const draft = readDraft();

    if (draft) {
      DRAFT_FIELD_NAMES.forEach((name) => {
        const field = getDraftableField(form, name);
        const value = draft[name];

        if (field && value !== undefined && !field.value) {
          field.value = value;
        }
      });
    }

    const handleChange = () => writeDraft(form);
    const handleSubmit = () => writeDraft(form);

    form.addEventListener('input', handleChange);
    form.addEventListener('change', handleChange);
    form.addEventListener('submit', handleSubmit);

    return () => {
      form.removeEventListener('input', handleChange);
      form.removeEventListener('change', handleChange);
      form.removeEventListener('submit', handleSubmit);
    };
  }, [formId]);

  return null;
}

function getLocalDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDatePartFields(form: HTMLFormElement, name: string) {
  const fields = Array.from(form.querySelectorAll<HTMLSelectElement>(`select[data-date-part-for="${name}"]`));

  return {
    day: fields.find((field) => field.dataset.datePart === 'day') ?? null,
    month: fields.find((field) => field.dataset.datePart === 'month') ?? null,
    year: fields.find((field) => field.dataset.datePart === 'year') ?? null
  };
}

function setDatePartValidity(fields: ReturnType<typeof getDatePartFields>, message: string) {
  fields.day?.setCustomValidity(message);
  fields.month?.setCustomValidity(message);
  fields.year?.setCustomValidity(message);
}

function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatThaiDate(value: Date) {
  return new Intl.DateTimeFormat('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(value);
}

function getOneYearLaterDisplay(value: string) {
  const startDate = parseLocalDateKey(value);

  if (!startDate || Number.isNaN(startDate.getTime())) {
    return '';
  }

  const endDate = new Date(startDate);
  endDate.setFullYear(startDate.getFullYear() + 1);

  if (endDate.getMonth() !== startDate.getMonth()) {
    endDate.setDate(0);
  }

  return formatThaiDate(endDate);
}

export function PolicyFormEnhancements({
  formId,
  includeCtp,
  holidayDates
}: {
  formId: string;
  includeCtp: boolean;
  holidayDates: string[];
}) {
  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const dateFields = Array.from(form.querySelectorAll<HTMLInputElement>('input[data-date-composed]'));
    const cleanups: Array<() => void> = [];

    dateFields.forEach((dateField) => {
      const name = dateField.dataset.dateComposed;

      if (!name) {
        return;
      }

      const fields = getDatePartFields(form, name);

      if (!fields.day || !fields.month || !fields.year) {
        return;
      }

      const dayField = fields.day;
      const monthField = fields.month;
      const yearField = fields.year;

      const syncPartsFromValue = () => {
        if (!dateField.value) {
          return;
        }

        const [year, month, day] = dateField.value.split('-');
        dayField.value = day ?? '';
        monthField.value = month ?? '';
        yearField.value = year ?? '';
      };

      const syncDateFromParts = () => {
        const day = dayField.value;
        const month = monthField.value;
        const year = yearField.value;

        if (!day || !month || !year) {
          dateField.value = '';
          setDatePartValidity(fields, '');
        } else {
          const candidate = new Date(Number(year), Number(month) - 1, Number(day));
          const isValidDate =
            candidate.getFullYear() === Number(year) &&
            candidate.getMonth() === Number(month) - 1 &&
            candidate.getDate() === Number(day);

          if (isValidDate) {
            dateField.value = `${year}-${month}-${day}`;
            setDatePartValidity(fields, '');
          } else {
            dateField.value = '';
            setDatePartValidity(fields, 'กรุณาเลือกวันที่ให้ถูกต้อง');
          }
        }

        dateField.dispatchEvent(new Event('input', { bubbles: true }));
        dateField.dispatchEvent(new Event('change', { bubbles: true }));
      };

      syncPartsFromValue();
      syncDateFromParts();
      dayField.addEventListener('change', syncDateFromParts);
      monthField.addEventListener('change', syncDateFromParts);
      yearField.addEventListener('change', syncDateFromParts);
      cleanups.push(() => {
        dayField.removeEventListener('change', syncDateFromParts);
        monthField.removeEventListener('change', syncDateFromParts);
        yearField.removeEventListener('change', syncDateFromParts);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [formId, includeCtp]);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const today = new Date();
    const todayKey = getLocalDateKey(today);
    const holidaySet = new Set(holidayDates);
    const ctpDateField = getDraftableField(form, 'ctpPolicyStartDate');
    const ctpPartFields = getDatePartFields(form, 'ctpPolicyStartDate');

    if (includeCtp && ctpDateField instanceof HTMLInputElement) {
      const validateCtpDate = () => {
        const selectedValue = ctpDateField.value;

        if (!selectedValue) {
          ctpDateField.setCustomValidity('');
          setDatePartValidity(ctpPartFields, '');
          return;
        }

        const selectedDate = new Date(`${selectedValue}T00:00:00`);
        const isSameDay = selectedValue === todayKey;

        if (isSameDay) {
          const day = selectedDate.getDay();

          if (day === 0 || day === 6) {
            const message = 'หากต้องการคุ้มครองภายในวันที่สั่งซื้อ จะไม่สามารถเลือกวันเสาร์-อาทิตย์ได้';
            ctpDateField.setCustomValidity(message);
            setDatePartValidity(ctpPartFields, message);
            return;
          }

          if (holidaySet.has(selectedValue)) {
            const message = 'หากต้องการคุ้มครองภายในวันที่สั่งซื้อ จะไม่สามารถเลือกวันหยุดสถาบันการเงินได้';
            ctpDateField.setCustomValidity(message);
            setDatePartValidity(ctpPartFields, message);
            return;
          }

          if (today.getHours() >= 16) {
            const message = 'หลังเวลา 16:00 ไม่สามารถเริ่มคุ้มครอง พ.ร.บ. ภายในวันที่สั่งซื้อได้ กรุณาเลือกวันล่วงหน้า';
            ctpDateField.setCustomValidity(message);
            setDatePartValidity(ctpPartFields, message);
            return;
          }
        }

        ctpDateField.setCustomValidity('');
        setDatePartValidity(ctpPartFields, '');
      };

      validateCtpDate();
      ctpDateField.addEventListener('input', validateCtpDate);
      ctpDateField.addEventListener('change', validateCtpDate);

      return () => {
        ctpDateField.removeEventListener('input', validateCtpDate);
        ctpDateField.removeEventListener('change', validateCtpDate);
      };
    }
  }, [formId, holidayDates, includeCtp]);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const previewItems = Array.from(form.querySelectorAll<HTMLElement>('[data-policy-end-date-for]'));
    const cleanups: Array<() => void> = [];

    previewItems.forEach((preview) => {
      const sourceName = preview.dataset.policyEndDateFor;

      if (!sourceName) {
        return;
      }

      const sourceField = getDraftableField(form, sourceName);

      if (!(sourceField instanceof HTMLInputElement)) {
        return;
      }

      const syncEndDate = () => {
        const endDate = getOneYearLaterDisplay(sourceField.value);
        preview.textContent = endDate || 'ระบบคำนวณอัตโนมัติ';
        preview.classList.toggle('text-slate-900', Boolean(endDate));
        preview.classList.toggle('text-slate-500', !endDate);
      };

      syncEndDate();
      sourceField.addEventListener('input', syncEndDate);
      sourceField.addEventListener('change', syncEndDate);
      cleanups.push(() => {
        sourceField.removeEventListener('input', syncEndDate);
        sourceField.removeEventListener('change', syncEndDate);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [formId, includeCtp]);

  useEffect(() => {
    const form = document.getElementById(formId);

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const otherFields = ['deliveryRecipientName', 'deliveryRecipientPhone', 'deliveryAddress']
      .map((name) => getDraftableField(form, name))
      .filter((field): field is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement => Boolean(field));
    const otherSection = form.querySelector<HTMLElement>('[data-delivery-other-section]');
    const modeFields = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="deliveryAddressMode"]'));

    const syncDeliveryMode = () => {
      const mode = modeFields.find((field) => field.checked)?.value ?? 'same';
      const isOther = mode === 'other';

      otherFields.forEach((field) => {
        field.required = isOther;
        field.disabled = !isOther;
      });

      if (otherSection) {
        otherSection.hidden = !isOther;
      }
    };

    syncDeliveryMode();
    modeFields.forEach((field) => field.addEventListener('change', syncDeliveryMode));

    return () => {
      modeFields.forEach((field) => field.removeEventListener('change', syncDeliveryMode));
    };
  }, [formId]);

  return null;
}
