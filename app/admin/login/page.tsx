import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
type AdminRole = 'admin' | 'sales';

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim() || '';
}

function signAdminSession(payload: string) {
  return createHmac('sha256', getAdminSessionSecret()).update(payload).digest('base64url');
}

function createAdminSessionToken(role: AdminRole) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${role}.${issuedAt}.${nonce}`;
  return `${payload}.${signAdminSession(payload)}`;
}

function passwordsMatch(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  return inputBuffer.length === expectedBuffer.length && timingSafeEqual(inputBuffer, expectedBuffer);
}

async function loginAction(formData: FormData) {
  'use server';

  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '').trim();
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const adminUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const salesUsername = process.env.SALES_USERNAME?.trim().toLowerCase() || 'sales';
  const salesPassword = process.env.SALES_PASSWORD?.trim();

  if (!adminPassword) {
    redirect('/admin/login?error=missing-config');
  }

  let role: AdminRole | null = null;
  const adminUsernameMatches = adminUsername ? username === adminUsername : !username || username === 'admin';

  if (password && adminUsernameMatches && passwordsMatch(password, adminPassword)) {
    role = 'admin';
  } else if (password && salesPassword && username === salesUsername && passwordsMatch(password, salesPassword)) {
    role = 'sales';
  }

  if (!role) {
    redirect('/admin/login?error=invalid');
  }

  const cookieStore = await cookies();

  cookieStore.set('admin_token', createAdminSessionToken(role), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });
  cookieStore.set('admin_role', role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS
  });

  redirect('/admin');
}

type AdminLoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage =
    resolvedSearchParams.error === 'invalid'
      ? 'รหัสผ่านไม่ถูกต้อง'
      : resolvedSearchParams.error === 'missing-config'
        ? 'ระบบยังไม่ได้ตั้งค่า ADMIN_PASSWORD'
        : '';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-600">
            Admin Login
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            เข้าสู่ระบบแอดมิน
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรอกรหัสผ่านเพื่อเข้าถึงหน้า Admin Dashboard
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-700">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              placeholder="admin หรือ sales"
            />
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Admin เดิมเว้นว่างได้ ส่วน Sales ให้กรอก username ที่ตั้งไว้
            </p>
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              placeholder="กรอกรหัสผ่าน"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800"
          >
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
