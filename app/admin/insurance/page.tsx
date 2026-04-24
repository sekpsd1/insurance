import { prisma } from '@/lib/prisma';
import { deleteInsuranceCampaign, importInsuranceCampaign } from '@/lib/actions';
import { CampaignImportModal } from './_components/campaign-import-modal';
import { getInsuranceCampaignSummaries } from '@/lib/insurance-import';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: Date | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

async function getInsuranceDashboardStats() {
  const [campaignSummaries, packageCount, companyCountRows] = await Promise.all([
    getInsuranceCampaignSummaries(),
    prisma.insurancePackage.count(),
    prisma.$queryRaw<Array<{ count: bigint | number | string }>>`
      SELECT COUNT(DISTINCT CONCAT(COALESCE(companyCode, ''), '::', COALESCE(campaignCode, '')) ) AS count
      FROM InsurancePackage
    `
  ]);

  const companyCount = Number(companyCountRows[0]?.count ?? 0);

  return {
    campaignSummaries,
    packageCount,
    companyCount
  };
}

export default async function InsuranceCampaignAdminPage() {
  const { campaignSummaries, packageCount, companyCount } = await getInsuranceDashboardStats();

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Campaign Import Dashboard
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">จัดการแคมเปญประกันภัย</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            นำเข้าข้อมูลขนาดใหญ่แบบ campaign-based ผ่านไฟล์ CSV, ลบข้อมูลแคมเปญเดิมได้ในคลิกเดียว และดูสรุปจำนวนรายการต่อแคมเปญได้ทันที
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white shadow-lg shadow-black/10">
            <div className="text-slate-300">แคมเปญทั้งหมด</div>
            <div className="mt-1 text-xl font-bold">{campaignSummaries.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white shadow-lg shadow-black/10">
            <div className="text-slate-300">รายการข้อมูล</div>
            <div className="mt-1 text-xl font-bold">{packageCount.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white shadow-lg shadow-black/10">
            <div className="text-slate-300">กลุ่ม companyCode</div>
            <div className="mt-1 text-xl font-bold">{companyCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-5 py-4 shadow-2xl shadow-black/10">
        <div>
          <h3 className="text-lg font-semibold text-white">เครื่องมือแคมเปญ</h3>
          <p className="text-sm text-slate-300">
            อัปโหลด CSV เพื่อสร้างหรือแทนที่ข้อมูลของแคมเปญ รวมถึงลบแคมเปญเก่าออกทั้งหมดได้
          </p>
        </div>
        <CampaignImportModal action={importInsuranceCampaign} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {campaignSummaries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300 lg:col-span-2 xl:col-span-3">
            ยังไม่มีข้อมูลแคมเปญในระบบ
          </div>
        ) : (
          campaignSummaries.map((campaign) => (
            <article
              key={`${campaign.companyCode}-${campaign.campaignCode}`}
              className="rounded-3xl border border-white/10 bg-white p-5 text-slate-900 shadow-2xl shadow-black/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                    {campaign.companyCode}
                  </p>
                  <h3 className="mt-2 text-xl font-bold text-slate-950">{campaign.campaignName}</h3>
                  <p className="mt-1 text-sm text-slate-500">Campaign Code: {campaign.campaignCode}</p>
                </div>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyles(
                    campaign.status
                  )}`}
                >
                  {campaign.status === 'ACTIVE' ? 'ใช้งานอยู่' : campaign.status}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">จำนวนรายการ</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">{campaign.packageCount.toLocaleString()}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-slate-500">มูลค่าเบี้ยสุทธิ</dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(campaign.totalNetPrice)}</dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 col-span-2">
                  <dt className="text-slate-500">อัปเดตล่าสุด</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{formatDate(campaign.latestCreatedAt)}</dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-3">
                <form action={deleteInsuranceCampaign} className="flex-1 min-w-[160px]">
                  <input type="hidden" name="companyCode" value={campaign.companyCode} />
                  <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    Delete Campaign
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>

    </section>
  );
}
