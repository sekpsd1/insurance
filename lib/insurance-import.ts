import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const INSURANCE_IMPORT_BATCH_SIZE = 200;

export type InsuranceCampaignImportOptions = {
  csvText: string;
  companyCode: string;
  campaignCode: string;
  campaignName: string;
  replaceExisting?: boolean;
  logoUrl?: string | null;
};

type CsvRecord = Record<string, string>;

type CampaignSummaryRow = {
  companyCode: string | null;
  campaignCode: string | null;
  campaignName: string | null;
  providerName: string | null;
  providerEmail: string | null;
  providerContactName: string | null;
  providerPhone: string | null;
  logoUrl: string | null;
  paymentBankName: string | null;
  paymentAccountName: string | null;
  paymentAccountNumber: string | null;
  paymentQrUrl: string | null;
  paymentUrl: string | null;
  paymentNotes: string | null;
  packageCount: bigint | number | string;
  totalNetPrice: bigint | number | string | null;
  latestCreatedAt: Date | string | null;
};

export type InsuranceCampaignSummary = {
  companyCode: string;
  campaignCode: string;
  campaignName: string;
  providerName: string;
  providerEmail: string;
  providerContactName: string;
  providerPhone: string;
  logoUrl: string;
  paymentBankName: string;
  paymentAccountName: string;
  paymentAccountNumber: string;
  paymentQrUrl: string;
  paymentUrl: string;
  paymentNotes: string;
  packageCount: number;
  totalNetPrice: number;
  latestCreatedAt: Date | null;
  status: 'ACTIVE';
};

export type InsuranceCompanySummary = {
  companyCode: string;
  campaignCount: number;
  packageCount: number;
  totalNetPrice: number;
  latestCreatedAt: Date | null;
};

export type InsuranceCampaignImportResult = {
  companyCode: string;
  campaignCode: string;
  campaignName: string;
  replaceExisting: boolean;
  rowsParsed: number;
  rowsSkipped: number;
  rowsDeleted: number;
  rowsInserted: number;
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function readRecordValue(record: CsvRecord, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeKey);

  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliases.includes(normalizeKey(key))) {
      return normalizeText(value);
    }
  }

  return '';
}

function parseNumberValue(value: string, fallback = 0) {
  if (!value) {
    return fallback;
  }

  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseYearValue(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPackageName(brand: string, model: string, year: number | null, campaignName: string) {
  const parts = [campaignName, brand, model, year ? String(year) : ''].filter(Boolean);
  return parts.join(' · ');
}

function buildDetails(record: CsvRecord, aliases: Array<[string, string[]]>) {
  const segments = aliases
    .map(([label, keys]) => {
      const value = readRecordValue(record, keys);
      return value ? `${label}=${value}` : '';
    })
    .filter(Boolean);

  return segments.length > 0 ? segments.join(' | ') : null;
}

function normalizeLogoUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if ((char === ',' || char === ';' || char === '\t') && !insideQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseInsuranceCsvRecords(csvText: string): CsvRecord[] {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, '').trim());
  const records: CsvRecord[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const record: CsvRecord = {};

    headers.forEach((header, index) => {
      record[header] = (values[index] ?? '').replace(/^"|"$/g, '').trim();
    });

    records.push(record);
  }

  return records;
}

export function mapCsvRecordToInsurancePackage(
  record: CsvRecord,
  context: { companyCode: string; campaignCode: string; campaignName: string; logoUrl?: string | null }
): Record<string, unknown> | null {
  const brand = readRecordValue(record, ['makdes', 'brand', 'carbrand', 'make']);
  const model = readRecordValue(record, ['moddes', 'model', 'carmodel']);
  const year = parseYearValue(
    readRecordValue(record, ['year', 'car_year', 'modelyear', 'mfgyear', 'registeryear'])
  );
  const netPrice = parseNumberValue(
    readRecordValue(record, ['prem_net_pd', 'netprice', 'premnetpd', 'premium_net', 'premium'])
  );
  const fullPrice = parseNumberValue(
    readRecordValue(record, ['prem_full_pd', 'prem_gross_pd', 'fullprice', 'grossprice', 'premium_full']),
    netPrice
  );

  if (!brand && !model && netPrice === 0) {
    return null;
  }

  const repairType = readRecordValue(record, ['repairtype', 'repair_type']) || null;
  const coverage = readRecordValue(record, ['coverage', 'covdesc']) || null;

  return {
    name: buildPackageName(brand, model, year, context.campaignName),
    company: context.companyCode,
    companyCode: context.companyCode,
    campaignCode: context.campaignCode,
    campaignName: context.campaignName,
    brand: brand || null,
    model: model || null,
    year,
    rawData: record,
    logoUrl: normalizeLogoUrl(context.logoUrl),
    details: buildDetails(record, [
      ['brand', ['makdes', 'brand', 'carbrand', 'make']],
      ['model', ['moddes', 'model', 'carmodel']],
      ['netPrice', ['prem_net_pd', 'netprice', 'premnetpd', 'premium_net', 'premium']],
      ['year', ['year', 'car_year', 'modelyear', 'mfgyear', 'registeryear']]
    ]),
    repairType,
    coverage,
    fullPrice,
    netPrice,
    discount: Math.max(fullPrice - netPrice, 0)
  };
}

export async function importInsuranceCampaignFromCsv(
  options: InsuranceCampaignImportOptions
): Promise<InsuranceCampaignImportResult> {
  const companyCode = options.companyCode.trim();
  const campaignCode = options.campaignCode.trim();
  const campaignName = options.campaignName.trim() || campaignCode;

  if (!companyCode) {
    throw new Error('companyCode is required');
  }

  if (!campaignCode) {
    throw new Error('campaignCode is required');
  }

  const records = parseInsuranceCsvRecords(options.csvText);
  const packageRows = records
    .map((record) =>
      mapCsvRecordToInsurancePackage(record, {
        companyCode,
        campaignCode,
        campaignName,
        logoUrl: options.logoUrl ?? null
      })
    )
    .filter((row): row is Record<string, unknown> => Boolean(row));

  if (packageRows.length === 0) {
    throw new Error('No valid insurance rows were found in the CSV file');
  }

  let rowsDeleted = 0;
  let rowsInserted = 0;

  await prisma.$transaction(
    async (tx) => {
    if (options.replaceExisting) {
      await tx.$executeRaw`
        DELETE FROM InsurancePackage
        WHERE companyCode = ${companyCode}
          AND campaignCode = ${campaignCode}
      `;

      rowsDeleted = packageRows.length;
    }

    for (const batch of chunkArray(packageRows, INSURANCE_IMPORT_BATCH_SIZE)) {
      const result = await tx.insurancePackage.createMany({
        data: batch as Prisma.InsurancePackageCreateManyInput[]
      });

      rowsInserted += result.count;
    }
    },
    {
      timeout: 600000,
      maxWait: 600000
    }
  );

  return {
    companyCode,
    campaignCode,
    campaignName,
    replaceExisting: Boolean(options.replaceExisting),
    rowsParsed: records.length,
    rowsSkipped: records.length - packageRows.length,
    rowsDeleted,
    rowsInserted
  };
}

export async function deleteInsuranceCampaignByCode(companyCode: string, campaignCode: string) {
  const normalizedCompanyCode = companyCode.trim();
  const normalizedCampaignCode = campaignCode.trim();

  if (!normalizedCompanyCode) {
    throw new Error('companyCode is required');
  }

  if (!normalizedCampaignCode) {
    throw new Error('campaignCode is required');
  }

  return prisma.$executeRaw`
    DELETE FROM InsurancePackage
    WHERE companyCode = ${normalizedCompanyCode}
      AND campaignCode = ${normalizedCampaignCode}
  `;
}

export async function getInsuranceCampaignSummaries(): Promise<InsuranceCampaignSummary[]> {
  const rows = await prisma.$queryRaw<CampaignSummaryRow[]>`
    SELECT
      companyCode,
      campaignCode,
      campaignName,
      MAX(providerName) AS providerName,
      MAX(providerEmail) AS providerEmail,
      MAX(providerContactName) AS providerContactName,
      MAX(providerPhone) AS providerPhone,
      MAX(logoUrl) AS logoUrl,
      MAX(paymentBankName) AS paymentBankName,
      MAX(paymentAccountName) AS paymentAccountName,
      MAX(paymentAccountNumber) AS paymentAccountNumber,
      MAX(paymentQrUrl) AS paymentQrUrl,
      MAX(paymentUrl) AS paymentUrl,
      MAX(paymentNotes) AS paymentNotes,
      COUNT(*) AS packageCount,
      COALESCE(SUM(netPrice), 0) AS totalNetPrice,
      MAX(createdAt) AS latestCreatedAt
    FROM InsurancePackage
    WHERE companyCode IS NOT NULL
      AND campaignCode IS NOT NULL
    GROUP BY companyCode, campaignCode, campaignName
    ORDER BY latestCreatedAt DESC
  `;

  return rows
    .map((row) => ({
      companyCode: row.companyCode ?? '',
      campaignCode: row.campaignCode ?? '',
      campaignName: row.campaignName ?? row.campaignCode ?? '',
      providerName: row.providerName ?? '',
      providerEmail: row.providerEmail ?? '',
      providerContactName: row.providerContactName ?? '',
      providerPhone: row.providerPhone ?? '',
      logoUrl: row.logoUrl ?? '',
      paymentBankName: row.paymentBankName ?? '',
      paymentAccountName: row.paymentAccountName ?? '',
      paymentAccountNumber: row.paymentAccountNumber ?? '',
      paymentQrUrl: row.paymentQrUrl ?? '',
      paymentUrl: row.paymentUrl ?? '',
      paymentNotes: row.paymentNotes ?? '',
      packageCount: Number(row.packageCount) || 0,
      totalNetPrice: Number(row.totalNetPrice ?? 0) || 0,
      latestCreatedAt: row.latestCreatedAt ? new Date(row.latestCreatedAt) : null,
      status: 'ACTIVE' as const
    }))
    .filter((row) => row.companyCode && row.campaignCode);
}

type CompanySummaryRow = {
  companyCode: string | null;
  campaignCount: bigint | number | string;
  packageCount: bigint | number | string;
  totalNetPrice: bigint | number | string | null;
  latestCreatedAt: Date | string | null;
};

export async function getInsuranceCompanySummaries(): Promise<InsuranceCompanySummary[]> {
  const rows = await prisma.$queryRaw<CompanySummaryRow[]>`
    SELECT
      companyCode,
      COUNT(DISTINCT campaignCode) AS campaignCount,
      COUNT(*) AS packageCount,
      COALESCE(SUM(netPrice), 0) AS totalNetPrice,
      MAX(createdAt) AS latestCreatedAt
    FROM InsurancePackage
    WHERE companyCode IS NOT NULL
    GROUP BY companyCode
    ORDER BY latestCreatedAt DESC
  `;

  return rows
    .map((row) => ({
      companyCode: row.companyCode ?? '',
      campaignCount: Number(row.campaignCount) || 0,
      packageCount: Number(row.packageCount) || 0,
      totalNetPrice: Number(row.totalNetPrice ?? 0) || 0,
      latestCreatedAt: row.latestCreatedAt ? new Date(row.latestCreatedAt) : null
    }))
    .filter((row) => row.companyCode);
}
