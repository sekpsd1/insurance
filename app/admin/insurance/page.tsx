import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import {
  deleteInsuranceCampaignLogo,
  deleteInsuranceCampaignPaymentQr,
  deleteInsuranceCampaign,
  importInsuranceCampaign,
  updateCtpRate,
  updateInsuranceCampaignLogo,
  updateInsuranceCampaignPaymentSetup,
  updateInsuranceCampaignProviderContact,
  updateSalesLeadEmailSetting
} from '@/lib/actions';
import { CampaignImportModal } from './_components/campaign-import-modal';
import { ConfirmSubmitButton } from './_components/confirm-submit-button';
import {
  getInsuranceCampaignSummaries,
  getInsuranceCompanySummaries,
  getPremiumImportAuditSummary
} from '@/lib/insurance-import';
import { getAdminCtpRates } from '@/lib/ctp-rates';
import { getSalesLeadEmailSetting } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumberInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const textInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

const moneyInputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-base font-semibold tabular-nums text-slate-950 outline-none placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100';

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
  const [campaignSummaries, companySummaries, packageCount, premiumAudit] = await Promise.all([
    getInsuranceCampaignSummaries(),
    getInsuranceCompanySummaries(),
    prisma.insurancePackage.count(),
    getPremiumImportAuditSummary()
  ]);

  return {
    campaignSummaries,
    companySummaries,
    premiumAudit,
    packageCount,
    companyCount: companySummaries.length
  };
}

export default async function InsuranceCampaignAdminPage() {
  const [{ campaignSummaries, companySummaries, packageCount, companyCount, premiumAudit }, ctpRates, salesLeadEmail] = await Promise.all([
    getInsuranceDashboardStats(),
    getAdminCtpRates(),
    getSalesLeadEmailSetting()
  ]);

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

      <div className="mb-8 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl shadow-black/10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Sales Lead Email</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">อีเมลรับคำขอประกันชั้น 1</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              ใช้รับคำขอใบเสนอราคาประกันประเภท 1 จากหน้าลูกค้า เปลี่ยนตรงนี้ได้ทันทีโดยไม่ต้องแก้ Plesk หรือ restart app
            </p>
          </div>
          <form action={updateSalesLeadEmailSetting} className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
            <input
              name="salesLeadEmail"
              type="email"
              defaultValue={salesLeadEmail ?? process.env.SALES_LEAD_EMAIL ?? ''}
              required
              placeholder="sales@example.com"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              บันทึกอีเมล
            </button>
          </form>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          ถ้ายังไม่บันทึก ระบบจะใช้ค่า fallback จาก SALES_LEAD_EMAIL ใน environment
        </p>
      </div>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">Import QA</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950">ตรวจสอบเบี้ยประกันจาก prm_gapnew</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              ระบบตรวจว่า <span className="font-semibold text-slate-700">netPrice</span> ที่ใช้แสดงเบี้ยประกันตรงกับ <span className="font-semibold text-slate-700">rawData.prm_gapnew</span> จาก CSV หรือไม่ ควรใช้หลัง import หรือแทนที่แคมเปญทุกครั้ง
            </p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${
            premiumAudit.mismatchedRows === 0
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-red-50 text-red-700 ring-red-200'
          }`}>
            {premiumAudit.mismatchedRows === 0 ? 'ผ่าน' : `พบผิด ${premiumAudit.mismatchedRows.toLocaleString()} แถว`}
          </span>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-slate-500">แพ็กเกจทั้งหมด</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{premiumAudit.totalPackages.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-slate-500">มี prm_gapnew</div>
            <div className="mt-1 text-xl font-bold text-slate-950">{premiumAudit.rowsWithPrmGapNew.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="text-emerald-700">ตรงกัน</div>
            <div className="mt-1 text-xl font-bold text-emerald-800">{premiumAudit.matchingRows.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <div className="text-red-700">ไม่ตรงกัน</div>
            <div className="mt-1 text-xl font-bold text-red-800">{premiumAudit.mismatchedRows.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-amber-700">ไม่มี prm_gapnew</div>
            <div className="mt-1 text-xl font-bold text-amber-800">{premiumAudit.missingPrmGapNewRows.toLocaleString()}</div>
          </div>
        </div>

        {premiumAudit.examples.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-red-100">
            <div className="bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">ตัวอย่างแถวที่ netPrice ไม่ตรงกับ prm_gapnew</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3 text-right">netPrice</th>
                    <th className="px-4 py-3 text-right">prm_gapnew</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {premiumAudit.examples.map((example) => (
                    <tr key={example.id}>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-semibold text-slate-900">{example.campaignName || '-'}</div>
                        <div className="text-xs text-slate-500">{example.companyCode} / {example.campaignCode}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{[example.brand, example.model].filter(Boolean).join(' · ') || '-'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">{formatCurrency(example.netPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(example.prmGapNew)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            netPrice ตรงกับ rawData.prm_gapnew ทุกแถวที่มีค่า prm_gapnew
          </p>
        )}
      </div>

      <div className="mb-8 rounded-3xl border border-white/10 bg-white p-5 shadow-2xl shadow-black/10">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-950">ตั้งค่า พ.ร.บ.</h3>
          <p className="mt-1 text-sm text-slate-500">แก้ไขราคา พ.ร.บ. ตามประเภทรถ ถ้าปิด “ขาย พ.ร.บ.” ลูกค้าจะไม่เห็นตัวเลือกเพิ่ม พ.ร.บ. ของรหัสนั้น</p>
          <p className="mt-2 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900">
            ช่องราคาที่ลูกค้าต้องชำระคือ <span className="font-black">Total</span> ส่วน <span className="font-black">Rate Code</span> เป็นรหัสอ้างอิง ไม่ใช่ช่องราคา
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {ctpRates.map((rate) => (
            <form key={rate.sClass} action={updateCtpRate} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input type="hidden" name="sClass" value={rate.sClass} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">SClass {rate.sClass}</div>
                  <div className="mt-1 text-lg font-bold text-slate-950">{rate.total > 0 ? formatCurrency(rate.total) : 'ยังไม่มีราคา'}</div>
                </div>
                <div className="space-y-1 text-right text-xs text-slate-600">
                  <label className="flex items-center justify-end gap-2">
                    <span>Active</span>
                    <input name="active" type="checkbox" defaultChecked={rate.active} className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
                  </label>
                  <label className="flex items-center justify-end gap-2">
                    <span>ขาย พ.ร.บ.</span>
                    <input name="sellable" type="checkbox" defaultChecked={rate.sellable} className="h-4 w-4 rounded border-slate-300 text-cyan-600" />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Rate Code <span className="font-normal text-slate-400">(รหัส ไม่ใช่ราคา)</span></label>
                <input name="rateCode" defaultValue={rate.rateCode} placeholder={rate.sClass === '210' ? 'เช่น 210' : 'เช่น 1.10'} className={textInputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">CMI Vehicle Type Code</label>
                <input name="cmiVehicleTypeCode" defaultValue={rate.cmiVehicleTypeCode} placeholder={`เช่น ${rate.sClass}`} className={textInputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">ชื่อรายการ</label>
                <input name="label" defaultValue={rate.label} required className={textInputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">เงื่อนไขแสดงผล</label>
                <input name="eligibilityLabel" defaultValue={rate.eligibilityLabel} className={textInputClass} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Premium</label>
                  <input name="premium" inputMode="decimal" defaultValue={formatNumberInput(rate.premium)} placeholder="0.00" required className={moneyInputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Stamp</label>
                  <input name="stamp" inputMode="decimal" defaultValue={formatNumberInput(rate.stamp)} placeholder="0.00" required className={moneyInputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">VAT</label>
                  <input name="vat" inputMode="decimal" defaultValue={formatNumberInput(rate.vat)} placeholder="0.00" required className={moneyInputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Total <span className="font-normal text-cyan-700">(ยอดที่ลูกค้าจ่าย)</span></label>
                  <input name="total" inputMode="decimal" defaultValue={formatNumberInput(rate.total)} placeholder="เช่น 1,182.35" required className={`${moneyInputClass} border-cyan-200 bg-cyan-50/40`} />
                </div>
              </div>

              <button type="submit" className="inline-flex w-full items-center justify-center rounded-xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-700">
                บันทึกราคา พ.ร.บ.
              </button>
            </form>
          ))}
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
                  <ConfirmSubmitButton
                    confirmMessage={`ยืนยันลบแคมเปญ "${campaign.campaignName}" (${campaign.companyCode} / ${campaign.campaignCode}) ใช่ไหม?\n\nการลบนี้จะลบแพ็กเกจในแคมเปญนี้ รวมถึงข้อมูลคำสั่งซื้อที่ผูกกับแพ็กเกจเหล่านี้ และไม่สามารถย้อนกลับได้`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    Delete Campaign
                  </ConfirmSubmitButton>
                </form>
              </div>
            </article>
          ))
        )}
      </div>

    </section>
  );
}
