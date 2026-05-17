import { prisma } from '@/lib/prisma';

type CheckStatus = 'ok' | 'warning' | 'error';
type Check = {
  title: string;
  status: CheckStatus;
  detail: string;
};

function getCheckStyles(status: CheckStatus) {
  if (status === 'ok') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'warning') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-rose-50 text-rose-700 ring-rose-200';
}

function CheckCard({
  title,
  status,
  detail
}: {
  title: string;
  status: CheckStatus;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-900 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ring-1 ${getCheckStyles(status)}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

async function getDatabaseStatus(): Promise<Check> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { title: 'Database', status: 'ok', detail: 'Database connection is working.' };
  } catch (error) {
    return {
      title: 'Database',
      status: 'error',
      detail: error instanceof Error ? error.message : 'Database connection failed.'
    };
  }
}

export default async function AdminReadinessPage() {
  const database = await getDatabaseStatus();
  const appBaseUrl = process.env.APP_BASE_URL?.trim();
  const emailProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || 'mock';
  const uploadDriver = process.env.UPLOAD_STORAGE_DRIVER?.trim().toLowerCase() || 'local';
  const checks = [
    database,
    {
      title: 'App Base URL',
      status: appBaseUrl?.startsWith('https://') ? 'ok' : 'warning',
      detail: appBaseUrl ? `Configured as ${appBaseUrl}` : 'APP_BASE_URL is not configured.'
    },
    {
      title: 'Admin Session',
      status: process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET ? 'ok' : 'error',
      detail: process.env.ADMIN_SESSION_SECRET
        ? 'ADMIN_PASSWORD and ADMIN_SESSION_SECRET are configured.'
        : 'ADMIN_SESSION_SECRET should be set separately from ADMIN_PASSWORD.'
    },
    {
      title: 'Provider Email',
      status:
        emailProvider === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM && appBaseUrl
          ? 'ok'
          : emailProvider === 'mock'
            ? 'warning'
            : 'error',
      detail:
        emailProvider === 'resend'
          ? 'Resend delivery is selected. Confirm a real checkout email before launch.'
          : 'Email is still in mock mode. Configure Resend before relying on provider Magic Link delivery.'
    },
    {
      title: 'Upload Storage',
      status:
        uploadDriver === 's3'
          ? 'ok'
          : process.env.ALLOW_LOCAL_UPLOADS_IN_PRODUCTION === 'true'
            ? 'warning'
            : 'warning',
      detail:
        uploadDriver === 's3'
          ? 'S3-compatible upload storage is selected.'
          : 'Local uploads are selected. Use only when Plesk disk storage is persistent, otherwise switch to S3/R2.'
    }
  ] satisfies Check[];

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Production Readiness</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">ตรวจความพร้อมก่อนขึ้นโฮสต์จริง</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          หน้านี้แสดงเฉพาะสถานะการตั้งค่า ไม่แสดงค่า secret เพื่อช่วยเช็กก่อนเปิดใช้งานจริงบน Plesk
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {checks.map((check) => (
          <CheckCard key={check.title} title={check.title} status={check.status} detail={check.detail} />
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-200">
        <div className="font-semibold text-white">หลัง deploy ให้ตรวจเพิ่ม</div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>เปิด `/api/health` แล้วต้องได้ `status: ok`</li>
          <li>รัน `npm run smoke` ถ้า Plesk อนุญาตให้รัน command</li>
          <li>สร้าง order ทดสอบ 1 รายการ แล้วเช็กว่า provider email ส่งจริงหรือมี error ชัดเจนใน Email Outbox</li>
          <li>อัปโหลด slip/logo/payment QR แล้วเปิด URL ได้หลัง restart app</li>
        </ul>
      </div>
    </section>
  );
}
