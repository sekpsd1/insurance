import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function loadDotEnv(envPath: string) {
  const envFile = readFileSync(envPath, 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['\"]|['\"]$/g, '');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

type MysqlConnection = {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
};

function parseDatabaseUrl(databaseUrl: string): MysqlConnection {
  const url = new URL(databaseUrl);

  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error(`Unsupported DATABASE_URL protocol: ${url.protocol}`);
  }

  return {
    host: url.hostname,
    port: url.port || '3306',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '')
  };
}

function formatDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureBackupsDir() {
  const backupsDir = path.resolve(process.cwd(), 'backups');
  await fs.mkdir(backupsDir, { recursive: true });
  return backupsDir;
}

async function run() {
  const rootDir = process.cwd();
  const envPath = path.resolve(rootDir, '.env');
  loadDotEnv(envPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing in .env');
  }

  const connection = parseDatabaseUrl(databaseUrl);
  const backupsDir = await ensureBackupsDir();
  const fileName = `backup_${formatDateStamp()}.sql`;
  const outputPath = path.join(backupsDir, fileName);

  const args = [
    `--host=${connection.host}`,
    `--port=${connection.port}`,
    `--user=${connection.user}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--default-character-set=utf8mb4',
    connection.database
  ];

  const dump = spawn('mysqldump', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      MYSQL_PWD: connection.password
    }
  });

  const chunks: Buffer[] = [];
  const errors: Buffer[] = [];

  dump.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  dump.stderr.on('data', (chunk) => errors.push(Buffer.from(chunk)));

  const exitCode: number = await new Promise((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', resolve);
  });

  if (exitCode !== 0) {
    const errorMessage = Buffer.concat(errors).toString('utf8') || `mysqldump exited with code ${exitCode}`;
    throw new Error(errorMessage);
  }

  await fs.writeFile(outputPath, Buffer.concat(chunks));

  console.log('[db-backup] Backup completed');
  console.log(`[db-backup] File: ${outputPath}`);
  console.log(`[db-backup] Database: ${connection.database}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[db-backup] Failed:', message);
  process.exitCode = 1;
});
