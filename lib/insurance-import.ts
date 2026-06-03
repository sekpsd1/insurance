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

export type PremiumImportAuditExample = {
  id: string;
  companyCode: string;
  campaignCode: string;
  campaignName: string;
  brand: string;
  model: string;
  netPrice: number;
  prmGapNew: number;
};

export type PremiumImportAuditSummary = {
  totalPackages: number;
  rowsWithPrmGapNew: number;
  matchingRows: number;
  mismatchedRows: number;
  missingPrmGapNewRows: number;
  examples: PremiumImportAuditExample[];
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

type DeleteCampaignResult = {
  packagesDeleted: number;
  ordersDeleted: number;
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
  const entriesByNormalizedKey = new Map<string, string>();

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);

    if (!entriesByNormalizedKey.has(normalizedKey)) {
      entriesByNormalizedKey.set(normalizedKey, value);
    }
  }

  for (const alias of aliases) {
    const value = entriesByNormalizedKey.get(normalizeKey(alias));

    if (value !== undefined) {
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

function parseOptionalNumberValue(value: string) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const prmGapNewSql = Prisma.sql`
  CAST(
    REPLACE(
      COALESCE(
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.prm_gapnew')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.PRM_GAPNEW')), ''),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(rawData, '$.Prm_Gapnew')), '')
      ),
      ',',
      ''
    ) AS DECIMAL(12, 2)
  )
`;

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
  const sClass = readRecordValue(record, ['sclass', 'carclass', 'vehicleclass']);
  const minSumInsured = parseOptionalNumberValue(readRecordValue(record, ['minsi', 'minsuminsured', 'suminsuredmin']));
  const maxSumInsured = parseOptionalNumberValue(readRecordValue(record, ['maxsi', 'maxsuminsured', 'suminsuredmax']));
  const minCarAge = parseOptionalNumberValue(readRecordValue(record, ['minyear', 'mincarage', 'caragemin']));
  const maxCarAge = parseOptionalNumberValue(readRecordValue(record, ['maxyear', 'maxcarage', 'caragemax']));
  const minCubicCapacity = parseOptionalNumberValue(readRecordValue(record, ['mincst', 'mincc', 'mincubiccapacity']));
  const maxCubicCapacity = parseOptionalNumberValue(readRecordValue(record, ['maxcst', 'maxcc', 'maxcubiccapacity']));
  const netPrice = parseNumberValue(
    readRecordValue(record, ['prm_gapnew', 'prem_net_pd', 'netprice', 'premnetpd', 'premium_net', 'premium'])
  );
  const payablePrice = parseNumberValue(readRecordValue(record, ['paid', 'payable', 'payableprice', 'remainingprice']), netPrice);
  const fullPrice = parseNumberValue(
    readRecordValue(record, ['prem_full_pd', 'prem_gross_pd', 'fullprice', 'grossprice', 'premium_full']),
    netPrice
  );

  if (!brand && !model && netPrice === 0) {
    return null;
  }

  const garageCode = readRecordValue(record, ['garagecd', 'garage_cd']);
  const normalizedGarageCode = garageCode.trim().toUpperCase();
  const repairType =
    readRecordValue(record, ['repairtype', 'repair_type']) ||
    (normalizedGarageCode === 'G' || normalizedGarageCode === 'DG' ? 'ซ่อมห้าง' : 'ซ่อมอู่');
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
    sClass: sClass || null,
    minSumInsured,
    maxSumInsured,
    minCarAge,
    maxCarAge,
    minCubicCapacity,
    maxCubicCapacity,
    rawData: record,
    logoUrl: normalizeLogoUrl(context.logoUrl),
    details: buildDetails(record, [
      ['brand', ['makdes', 'brand', 'carbrand', 'make']],
      ['model', ['moddes', 'model', 'carmodel']],
      ['sClass', ['sclass', 'carclass', 'vehicleclass']],
      ['sumInsured', ['minsi', 'maxsi', 'minsuminsured', 'maxsuminsured']],
      ['carAge', ['minyear', 'maxyear', 'mincarage', 'maxcarage']],
      ['netPrice', ['prm_gapnew', 'prem_net_pd', 'netprice', 'premnetpd', 'premium_net', 'premium']],
      ['payablePrice', ['paid', 'payable', 'payableprice', 'remainingprice']],
      ['year', ['year', 'car_year', 'modelyear', 'mfgyear', 'registeryear']]
    ]),
    repairType,
    coverage,
    fullPrice,
    netPrice,
    payablePrice,
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
      const deleteResult = await deleteInsuranceCampaignRows(tx, companyCode, campaignCode);
      rowsDeleted = deleteResult.packagesDeleted;
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

async function deleteInsuranceCampaignRows(
  tx: Prisma.TransactionClient,
  companyCode: string,
  campaignCode: string
): Promise<DeleteCampaignResult> {
  const packages = await tx.insurancePackage.findMany({
    where: {
      companyCode,
      campaignCode
    },
    select: {
      id: true
    }
  });
  const packageIds = packages.map((pkg) => pkg.id);

  if (packageIds.length === 0) {
    return { packagesDeleted: 0, ordersDeleted: 0 };
  }

  const orders = await tx.order.findMany({
    where: {
      packageId: {
        in: packageIds
      }
    },
    select: {
      id: true
    }
  });
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length > 0) {
    await tx.emailOutbox.updateMany({
      where: {
        orderId: {
          in: orderIds
        }
      },
      data: {
        orderId: null
      }
    });
    await tx.magicLinkToken.deleteMany({
      where: {
        orderId: {
          in: orderIds
        }
      }
    });
    await tx.orderStatusHistory.deleteMany({
      where: {
        orderId: {
          in: orderIds
        }
      }
    });
    await tx.order.deleteMany({
      where: {
        id: {
          in: orderIds
        }
      }
    });
  }

  const deletePackagesResult = await tx.insurancePackage.deleteMany({
    where: {
      id: {
        in: packageIds
      }
    }
  });

  return {
    packagesDeleted: deletePackagesResult.count,
    ordersDeleted: orderIds.length
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

  return prisma.$transaction(
    async (tx) => deleteInsuranceCampaignRows(tx, normalizedCompanyCode, normalizedCampaignCode),
    {
      timeout: 600000,
      maxWait: 600000
    }
  );
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

export async function getPremiumImportAuditSummary(): Promise<PremiumImportAuditSummary> {
  const [summary] = await prisma.$queryRaw<
    Array<{
      totalPackages: bigint | number | string;
      rowsWithPrmGapNew: bigint | number | string;
      matchingRows: bigint | number | string;
      mismatchedRows: bigint | number | string;
      missingPrmGapNewRows: bigint | number | string;
    }>
  >`
    SELECT
      COUNT(*) AS totalPackages,
      SUM(CASE WHEN ${prmGapNewSql} IS NOT NULL THEN 1 ELSE 0 END) AS rowsWithPrmGapNew,
      SUM(CASE WHEN ${prmGapNewSql} IS NOT NULL AND ABS(netPrice - ${prmGapNewSql}) < 0.005 THEN 1 ELSE 0 END) AS matchingRows,
      SUM(CASE WHEN ${prmGapNewSql} IS NOT NULL AND ABS(netPrice - ${prmGapNewSql}) >= 0.005 THEN 1 ELSE 0 END) AS mismatchedRows,
      SUM(CASE WHEN ${prmGapNewSql} IS NULL THEN 1 ELSE 0 END) AS missingPrmGapNewRows
    FROM InsurancePackage
    WHERE companyCode IS NOT NULL
      AND campaignCode IS NOT NULL
      AND rawData IS NOT NULL
  `;

  const examples = await prisma.$queryRaw<
    Array<{
      id: string;
      companyCode: string | null;
      campaignCode: string | null;
      campaignName: string | null;
      brand: string | null;
      model: string | null;
      netPrice: number | string;
      prmGapNew: number | string;
    }>
  >`
    SELECT
      id,
      companyCode,
      campaignCode,
      campaignName,
      brand,
      model,
      netPrice,
      ${prmGapNewSql} AS prmGapNew
    FROM InsurancePackage
    WHERE companyCode IS NOT NULL
      AND campaignCode IS NOT NULL
      AND rawData IS NOT NULL
      AND ${prmGapNewSql} IS NOT NULL
      AND ABS(netPrice - ${prmGapNewSql}) >= 0.005
    ORDER BY createdAt DESC, id DESC
    LIMIT 10
  `;

  return {
    totalPackages: Number(summary?.totalPackages ?? 0),
    rowsWithPrmGapNew: Number(summary?.rowsWithPrmGapNew ?? 0),
    matchingRows: Number(summary?.matchingRows ?? 0),
    mismatchedRows: Number(summary?.mismatchedRows ?? 0),
    missingPrmGapNewRows: Number(summary?.missingPrmGapNewRows ?? 0),
    examples: examples.map((row) => ({
      id: row.id,
      companyCode: row.companyCode ?? '',
      campaignCode: row.campaignCode ?? '',
      campaignName: row.campaignName ?? '',
      brand: row.brand ?? '',
      model: row.model ?? '',
      netPrice: Number(row.netPrice) || 0,
      prmGapNew: Number(row.prmGapNew) || 0
    }))
  };
}
