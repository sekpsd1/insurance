const baseUrl = (process.env.SMOKE_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const checks = [
  { path: '/api/health', expectedStatus: 200 },
  { path: '/line-app/search', expectedStatus: 200 },
  { path: '/admin', expectedStatus: 200, allowRedirect: true }
];

async function checkRoute({ path, expectedStatus, allowRedirect }) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: allowRedirect ? 'manual' : 'follow'
  });

  const ok = allowRedirect
    ? response.status === expectedStatus || (response.status >= 300 && response.status < 400)
    : response.status === expectedStatus;

  if (!ok) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}${allowRedirect ? ' or redirect' : ''}`);
  }

  console.log(`OK ${path} -> ${response.status}`);
}

async function main() {
  console.log(`Smoke testing ${baseUrl}`);

  for (const check of checks) {
    await checkRoute(check);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
