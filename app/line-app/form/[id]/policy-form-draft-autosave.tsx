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
    const handleSubmit = () => {
      if (form.checkValidity()) {
        clearDraft();
      }
    };

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

    const today = new Date();
    const todayKey = getLocalDateKey(today);
    const holidaySet = new Set(holidayDates);
    const ctpDateField = getDraftableField(form, 'ctpPolicyStartDate');

    if (includeCtp && ctpDateField instanceof HTMLInputElement) {
      ctpDateField.min = todayKey;

      const validateCtpDate = () => {
        const selectedValue = ctpDateField.value;

        if (!selectedValue) {
          ctpDateField.setCustomValidity('กรุณาเลือกวันที่คุ้มครอง พ.ร.บ.');
          return;
        }

        const selectedDate = new Date(`${selectedValue}T00:00:00`);
        const isSameDay = selectedValue === todayKey;

        if (isSameDay) {
          const day = selectedDate.getDay();

          if (day === 0 || day === 6) {
            ctpDateField.setCustomValidity('หากต้องการคุ้มครองภายในวันที่สั่งซื้อ จะไม่สามารถเลือกวันเสาร์-อาทิตย์ได้');
            return;
          }

          if (holidaySet.has(selectedValue)) {
            ctpDateField.setCustomValidity('หากต้องการคุ้มครองภายในวันที่สั่งซื้อ จะไม่สามารถเลือกวันหยุดสถาบันการเงินได้');
            return;
          }

          if (today.getHours() >= 16) {
            ctpDateField.setCustomValidity('หลังเวลา 16:00 ไม่สามารถเริ่มคุ้มครอง พ.ร.บ. ภายในวันที่สั่งซื้อได้ กรุณาเลือกวันล่วงหน้า');
            return;
          }
        }

        ctpDateField.setCustomValidity('');
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
