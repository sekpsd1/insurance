const fs = require('node:fs/promises');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function loadDotEnv(envPath) {
  const envFile = readFileSync(envPath, 'utf8');
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
}

function parseDatabaseUrl(databaseUrl) {
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

function resolveDockerContainerName() {
  return process.env.MYSQL_CONTAINER_NAME?.trim() || 'insurance-db-1';
}

function resolveRootPassword() {
  const passwordFromEnv = process.env.MYSQL_ROOT_PASSWORD?.trim();
  if (passwordFromEnv) {
    return passwordFromEnv;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const connection = parseDatabaseUrl(databaseUrl);
    if (connection.password) {
      return connection.password;
    }
  }

  throw new Error('MYSQL_ROOT_PASSWORD or DATABASE_URL password is required to run backup in Docker');
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
  const containerName = resolveDockerContainerName();
  const rootPassword = resolveRootPassword();

  const args = [
    'exec',
    '-i',
    '-e',
    `MYSQL_PWD=${rootPassword}`,
    containerName,
    'mysqldump',
    `--user=${connection.user}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--default-character-set=utf8mb4',
    connection.database
  ];

  const dump = spawn('docker', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env
    }
  });

  const chunks = [];
  const errors = [];

  dump.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  dump.stderr.on('data', (chunk) => errors.push(Buffer.from(chunk)));

  const exitCode = await new Promise((resolve, reject) => {
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

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[db-backup] Failed:', message);
  process.exitCode = 1;
});
