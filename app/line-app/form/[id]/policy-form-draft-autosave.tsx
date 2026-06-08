'use client';

import { useEffect } from 'react';

const POLICY_FORM_DRAFT_STORAGE_KEY = 'line-app:policy-form-draft:v1';

type PolicyFormDraft = Record<string, string>;

const DRAFT_FIELD_NAMES = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'customerAddress',
  'plateNumber',
  'plateProvince'
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
