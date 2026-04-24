import fs from 'node:fs/promises';
import path from 'node:path';
import { importInsuranceCampaignFromCsv } from '../lib/insurance-import';

function loadDotEnv(envPath: string) {
  return fs
    .readFile(envPath, 'utf8')
    .then((envFile) => {
      for (const line of envFile.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const index = trimmed.indexOf('=');
        if (index === -1) continue;

        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    })
    .catch(() => {
      // Ignore missing .env; the caller will validate required env vars.
    });
}

function parseArgs(argv: string[]) {
  const result: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}

function inferCampaignNameFromFileName(filePath: string) {
  const baseName = path.basename(filePath, path.extname(filePath));

  if (/Sabai\s*2\+?/i.test(baseName)) {
    return 'Sabai 2+';
  }

  if (/Sabai\s*3\+?/i.test(baseName)) {
    return 'Sabai 3+';
  }

  if (/Sabai\s*3/i.test(baseName)) {
    return 'Sabai 3';
  }

  return baseName;
}

function inferCampaignCodeFromFileName(filePath: string) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const match = baseName.match(/C\d{2}[-/]\d{5,6}(?:[-+]\d+)?/i);
  if (match) {
    return match[0].replace('/', '/');
  }

  if (/Sabai\s*2\+?/i.test(baseName)) {
    return 'C69/00109-2';
  }

  if (/Sabai\s*3\+?/i.test(baseName)) {
    return 'C69/00109-3+';
  }

  if (/Sabai\s*3/i.test(baseName)) {
    return 'C69/00109-3';
  }

  return baseName;
}

async function collectCsvFiles(targetPath: string): Promise<string[]> {
  const stat = await fs.stat(targetPath);

  if (stat.isFile()) {
    return targetPath.toLowerCase().endsWith('.csv') ? [targetPath] : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => path.join(targetPath, entry.name));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = String(args.file ?? args.csv ?? args.path ?? '').trim();
  const companyCode = String(args.companyCode ?? '').trim();
  const campaignCode = String(args.campaignCode ?? '').trim();
  const campaignName = String(args.campaignName ?? '').trim();
  const replaceExisting = Boolean(args.replaceExisting ?? args['replace-existing']);

  const rootDir = process.cwd();
  await loadDotEnv(path.resolve(rootDir, '.env'));

  if (!inputPath) {
    throw new Error('Missing --file or --path pointing to a CSV file or folder');
  }

  const absoluteInputPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(rootDir, inputPath);
  const csvFiles = await collectCsvFiles(absoluteInputPath);

  if (csvFiles.length === 0) {
    throw new Error(`No CSV files found at: ${absoluteInputPath}`);
  }

  for (const csvFile of csvFiles) {
    const csvText = await fs.readFile(csvFile, 'utf8');
    const inferredCampaignName = campaignName || inferCampaignNameFromFileName(csvFile);
    const inferredCampaignCode = campaignCode || inferCampaignCodeFromFileName(csvFile);

    const result = await importInsuranceCampaignFromCsv({
      csvText,
      companyCode,
      campaignCode: inferredCampaignCode,
      campaignName: inferredCampaignName,
      replaceExisting
    });

    console.log(`[import-insurance] Imported ${path.basename(csvFile)}`);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[import-insurance] Failed:', message);
  process.exitCode = 1;
});
