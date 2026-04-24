"use client";

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';

function inferCampaignNameFromFileName(fileName: string) {
  if (/Sabai\s*2\+?/i.test(fileName)) {
    return 'Sabai 2+';
  }

  if (/Sabai\s*3\+?/i.test(fileName)) {
    return 'Sabai 3+';
  }

  if (/Sabai\s*3/i.test(fileName)) {
    return 'Sabai 3';
  }

  return fileName.replace(/\.csv$/i, '').trim();
}

function inferCampaignCodeFromFileName(fileName: string) {
  const normalized = fileName.replace(/\.csv$/i, '');
  const match = normalized.match(/C\d{2}[-/]\d{5,6}(?:[-+]?\d+)?/i);

  if (match) {
    return match[0];
  }

  if (/Sabai\s*2\+?/i.test(normalized)) {
    return 'C69/00109-2';
  }

  if (/Sabai\s*3\+?/i.test(normalized)) {
    return 'C69/00109-3+';
  }

  if (/Sabai\s*3/i.test(normalized)) {
    return 'C69/00109-3';
  }

  return normalized;
}

function parseCsvPreview(csvText: string) {
  const rows = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headers = rows.length > 0 ? rows[0].split(',').map((header) => header.trim()) : [];
  return {
    rowsCount: Math.max(rows.length - 1, 0),
    headers
  };
}

export function CampaignImportModal({
  action
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<{ rowsCount: number; headers: string[] } | null>(null);
  const [campaignCode, setCampaignCode] = useState('');
  const [campaignName, setCampaignName] = useState('');

  const inferredCampaignName = useMemo(
    () => inferCampaignNameFromFileName(fileName || 'CSV file'),
    [fileName]
  );
  const inferredCampaignCode = useMemo(
    () => inferCampaignCodeFromFileName(fileName || 'CSV file'),
    [fileName]
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setFileName('');
      setPreview(null);
      return;
    }

    setFileName(file.name);
    setCampaignName((current) => current || inferCampaignNameFromFileName(file.name));
    setCampaignCode((current) => current || inferCampaignCodeFromFileName(file.name));

    const csvText = await file.text();
    setPreview(parseCsvPreview(csvText));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
      >
        Import New Campaign
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-slate-950">Import New Campaign</h3>
                <p className="mt-1 text-sm text-slate-500">
                  อัปโหลดไฟล์ CSV 1 ไฟล์ หรือใช้สคริปต์ CLI เพื่อ import ทั้งโฟลเดอร์ได้
                  โดยระบบจะช่วยเดาชื่อแคมเปญจากชื่อไฟล์ถ้าไม่ได้กรอกเอง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form
              action={action}
              onSubmit={() => setOpen(false)}
              className="grid gap-4 rounded-2xl bg-white text-slate-900"
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label htmlFor="companyCode" className="mb-2 block text-sm font-semibold text-slate-700">
                    Company Code
                  </label>
                  <input
                    id="companyCode"
                    name="companyCode"
                    required
                    placeholder="เช่น SABAI"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label htmlFor="campaignCode" className="mb-2 block text-sm font-semibold text-slate-700">
                    Campaign Code
                  </label>
                  <input
                    id="campaignCode"
                    name="campaignCode"
                    required
                    value={campaignCode}
                    onChange={(event) => setCampaignCode(event.target.value)}
                    placeholder={inferredCampaignCode}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="campaignName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Campaign Name
                </label>
                <input
                  id="campaignName"
                  name="campaignName"
                  required
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder={inferredCampaignName}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[16px] outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
              </div>

              <div>
                <label htmlFor="csvFile" className="mb-2 block text-sm font-semibold text-slate-700">
                  CSV File
                </label>
                <input
                  id="csvFile"
                  name="csvFile"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={handleFileChange}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-[16px] outline-none file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-cyan-700"
                />
                <p className="mt-2 text-xs text-slate-500">
                  ตัวอย่างคอลัมน์ที่อ่านได้: <code>makdes</code>, <code>moddes</code>, <code>prem_net_pd</code>, <code>year</code>
                </p>
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">CSV Preview</div>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500">File:</span> {fileName || '-'}
                  </div>
                  <div>
                    <span className="text-slate-500">Rows:</span> {preview?.rowsCount ?? 0}
                  </div>
                  <div>
                    <span className="text-slate-500">Inferred campaign code:</span> {campaignCode || inferredCampaignCode}
                  </div>
                  <div>
                    <span className="text-slate-500">Inferred campaign name:</span> {campaignName || inferredCampaignName}
                  </div>
                </div>

                {preview?.headers?.length ? (
                  <div className="mt-3">
                    <span className="text-slate-500">Headers:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {preview.headers.slice(0, 8).map((header) => (
                        <span key={header} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-cyan-200">
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="replaceExisting"
                  defaultChecked
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                />
                <span>
                  ลบข้อมูลเก่าที่มี <strong>companyCode + campaignCode</strong> ตรงกันออกก่อน แล้วจึงนำเข้าไฟล์ชุดใหม่
                </span>
              </label>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                >
                  Start Import
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
