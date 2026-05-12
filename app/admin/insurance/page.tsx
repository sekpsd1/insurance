import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  deleteInsuranceCampaignLogo,
  deleteInsuranceCampaignPaymentQr,
  deleteInsuranceCampaign,
  importInsuranceCampaign,
  updateInsuranceCampaignLogo,
  updateInsuranceCampaignPaymentSetup,
  updateInsuranceCampaignProviderContact
} from '@/lib/actions';
import { CampaignImportModal } from './_components/campaign-import-modal';
import {
  getInsuranceCampaignSummaries,
  getInsuranceCompanySummaries
} from '@/lib/insurance-import';

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

function buildCompanyPackagesHref(companyCode: string) {
  return `/admin/insurance/packages?companyCode=${encodeURIComponent(companyCode)}`;
}

async function getInsuranceDashboardStats() {
  const [campaignSummaries, companySummaries, packageCount] = await Promise.all([
    getInsuranceCampaignSummaries(),
    getInsuranceCompanySummaries(),
    prisma.insurancePackage.count(),
  ]);

  return {
    campaignSummaries,
    companySummaries,
    packageCount,
    companyCount: companySummaries.length
  };
}

export default async function InsuranceCampaignAdminPage() {
  const { campaignSummaries, companySummaries, packageCount, companyCount } = await getInsuranceDashboardStats();

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
            <div className="text-slate-300">บริษัททั้งหมด</div>
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
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/insurance/packages"
            className="inline-flex items-center rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Search / Edit Packages
          </Link>
          <CampaignImportModal action={importInsuranceCampaign} />
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">สรุประดับบริษัท</h3>
          <p className="text-sm text-slate-300">ดูจำนวนแคมเปญและรายการข้อมูลของแต่ละบริษัทก่อนเจาะลงไปที่แคมเปญ</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {companySummaries.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-slate-300 md:col-span-2 xl:col-span-3">
            ยังไม่มีข้อมูลบริษัทในระบบ
          </div>
        ) : (
          companySummaries.map((company) => (
            <article
              key={company.companyCode}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white shadow-2xl shadow-black/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">companyCode</p>
                  <h4 className="mt-2 text-xl font-bold text-white">{company.companyCode}</h4>
                </div>
                <Link
                  href={buildCompanyPackagesHref(company.companyCode)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  ดูแคมเปญ
                </Link>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-slate-300">แคมเปญ</div>
                  <div className="mt-1 text-lg font-bold text-white">{company.campaignCount.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3">
                  <div className="text-slate-300">รายการข้อมูล</div>
                  <div className="mt-1 text-lg font-bold text-white">{company.packageCount.toLocaleString()}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3 col-span-2">
                  <div className="text-slate-300">มูลค่าเบี้ยสุทธิรวม</div>
                  <div className="mt-1 text-lg font-bold text-white">{formatCurrency(company.totalNetPrice)}</div>
                </div>
                <div className="rounded-2xl bg-white/5 p-3 col-span-2">
                  <div className="text-slate-300">อัปเดตล่าสุด</div>
                  <div className="mt-1 font-semibold text-white">{formatDate(company.latestCreatedAt)}</div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">สรุประดับแคมเปญ</h3>
          <p className="text-sm text-slate-300">แต่ละการ์ดคือหนึ่ง campaign ที่อยู่ใต้บริษัทเดียวกัน</p>
        </div>
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

              <form action={updateInsuranceCampaignProviderContact} className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
                <input type="hidden" name="companyCode" value={campaign.companyCode} />
                <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                <div>
                  <div className="font-semibold text-slate-900">Provider Contact</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ข้อมูลนี้ใช้เป็นปลายทางสำหรับส่งอีเมล Magic Link ให้บริษัทประกันหลังลูกค้ายืนยันออเดอร์
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="providerName"
                    defaultValue={campaign.providerName}
                    placeholder="ชื่อบริษัทประกัน"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="providerEmail"
                    type="email"
                    defaultValue={campaign.providerEmail}
                    placeholder="provider@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="providerContactName"
                    defaultValue={campaign.providerContactName}
                    placeholder="ชื่อเจ้าหน้าที่"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="providerPhone"
                    defaultValue={campaign.providerPhone}
                    placeholder="เบอร์ติดต่อ"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  บันทึกข้อมูลบริษัทประกัน
                </button>
              </form>

              <form action={updateInsuranceCampaignPaymentSetup} className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
                <input type="hidden" name="companyCode" value={campaign.companyCode} />
                <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                <div>
                  <div className="font-semibold text-slate-900">ตั้งค่าการชำระเงินของแคมเปญ</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ลูกค้าโอนเงินเข้าบัญชีบริษัทประกันโดยตรง และระบบจะใช้ลิงก์ชำระเงินของบริษัทประกันเมื่อมีการตั้งค่าไว้
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    name="paymentBankName"
                    defaultValue={campaign.paymentBankName}
                    placeholder="ชื่อธนาคาร"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="paymentAccountName"
                    defaultValue={campaign.paymentAccountName}
                    placeholder="ชื่อบัญชี"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="paymentAccountNumber"
                    defaultValue={campaign.paymentAccountNumber}
                    placeholder="เลขที่บัญชี"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                  <input
                    name="paymentUrl"
                    type="url"
                    defaultValue={campaign.paymentUrl}
                    placeholder="ลิงก์ชำระเงินของบริษัทประกัน"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  />
                </div>
                <textarea
                  name="paymentNotes"
                  defaultValue={campaign.paymentNotes}
                  placeholder="หมายเหตุหรือคำแนะนำการชำระเงิน"
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                />
                <div className="space-y-2">
                  {campaign.paymentQrUrl ? (
                    <a
                      href={campaign.paymentQrUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      ดู QR/รูปภาพชำระเงินปัจจุบัน
                    </a>
                  ) : null}
                  <input
                    name="paymentQrFile"
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  บันทึกการตั้งค่าชำระเงิน
                </button>
              </form>

              {campaign.paymentQrUrl ? (
                <form action={deleteInsuranceCampaignPaymentQr} className="mt-3 rounded-2xl bg-slate-50 p-3">
                  <input type="hidden" name="companyCode" value={campaign.companyCode} />
                  <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    ลบ QR/รูปภาพชำระเงิน
                  </button>
                </form>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <form action={updateInsuranceCampaignLogo} className="flex-1 min-w-[240px] space-y-3 rounded-2xl bg-slate-50 p-3">
                  <input type="hidden" name="companyCode" value={campaign.companyCode} />
                  <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                  <div>
                    <div className="text-slate-500">Campaign Logo</div>
                    <p className="mt-1 text-xs text-slate-500">อัปโหลดครั้งเดียว โลโก้จะถูกใช้กับทุกแพ็กเกจในแคมเปญนี้</p>
                    {campaign.logoUrl ? (
                      <a
                        href={campaign.logoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                      >
                        ดูโลโก้ปัจจุบัน
                      </a>
                    ) : null}
                  </div>
                  <input
                    name="logoFile"
                    type="file"
                    accept="image/*"
                    required
                    className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-cyan-700"
                  />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700"
                  >
                    อัปโหลดโลโก้แคมเปญ
                  </button>
                </form>

                {campaign.logoUrl ? (
                  <form action={deleteInsuranceCampaignLogo} className="flex-1 min-w-[160px] rounded-2xl bg-slate-50 p-3">
                    <input type="hidden" name="companyCode" value={campaign.companyCode} />
                    <input type="hidden" name="campaignCode" value={campaign.campaignCode} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    >
                      ลบโลโก้แคมเปญ
                    </button>
                  </form>
                ) : null}

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
