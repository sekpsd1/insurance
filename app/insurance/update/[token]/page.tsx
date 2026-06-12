import { createHash } from 'crypto';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { updateOrderFromMagicLink } from '@/lib/actions';
import {
  getOrderStatusLabel,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getStatusHistoryMessageLabel
} from '@/lib/status-labels';

type InsurerUpdatePageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ updated?: string }>;
};

function hashMagicToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString('th-TH') : '-';
}

function getFullAddress(order: {
  customerAddress: string | null;
  subDistrict: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
}) {
  return [
    order.customerAddress,
    order.subDistrict,
    order.district,
    order.province,
    order.postalCode
  ]
    .filter(Boolean)
    .join(' ') || '-';
}

function MagicLinkUnavailablePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7ff] px-4 py-10 text-[#101828]">
      <section className="w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Insurance Provider</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">ลิงก์นี้ไม่สามารถใช้งานได้</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Magic Link อาจหมดอายุ ถูกใช้ไปแล้ว หรือไม่ถูกต้อง กรุณาติดต่อ broker เพื่อขอลิงก์ใหม่สำหรับอัปเดตสถานะกรมธรรม์
        </p>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-left text-sm leading-6 text-slate-600">
          <div className="font-semibold text-slate-900">สิ่งที่ตรวจสอบได้</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>เปิดลิงก์จากอีเมลล่าสุดของคำสั่งซื้อนี้</li>
            <li>ตรวจสอบว่าไม่ได้คัดลอกลิงก์ขาดบางส่วน</li>
            <li>หากเคยบันทึกสถานะสุดท้ายแล้ว ต้องให้ broker สร้างลิงก์ใหม่</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default async function InsurerUpdatePage({ params, searchParams }: InsurerUpdatePageProps) {
  const { token } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const decodedToken = decodeURIComponent(token);
  const magicToken = await prisma.magicLinkToken.findUnique({
    where: {
      tokenHash: hashMagicToken(decodedToken)
    },
    include: {
      order: {
        include: {
          user: true,
          pkg: true,
          statusHistory: {
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          }
        }
      }
    }
  });

  if (!magicToken || magicToken.expiresAt < new Date()) {
    return <MagicLinkUnavailablePage />;
  }

  const order = magicToken.order;
  const customerName = order.customerName ?? order.user.name ?? '-';
  const customerPhone = order.customerPhone ?? order.user.phone ?? '-';
  const vehicle = [order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / ') || '-';
  const plate = [order.plateNumber, order.plateProvince].filter(Boolean).join(' ') || '-';
  const deliveryAddress =
    order.deliveryAddressMode === 'other'
      ? [order.deliveryRecipientName, order.deliveryRecipientPhone, order.deliveryAddress].filter(Boolean).join(' / ')
      : getFullAddress(order);
  const providerName = order.pkg.providerName ?? order.pkg.company;
  const isFinalStatus = order.status === 'POLICY_ISSUED' || order.status === 'REJECTED';
  const isMagicLinkUsed = Boolean(magicToken.usedAt && isFinalStatus);
  const statusSelectDefaultValue = order.status === 'POLICY_APPROVED' ? 'POLICY_ISSUED' : 'INSURER_REVIEWING';

  return (
    <main className="min-h-screen bg-[#f4f7ff] px-4 py-8 text-[#101828]">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0052CC]">Insurance Provider</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">ตรวจสอบคำขอออกกรมธรรม์</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            กรุณาตรวจสอบข้อมูลลูกค้า รถยนต์ แพ็กเกจ และหลักฐานชำระเงินก่อนอัปเดตสถานะกลับมายังระบบ
          </p>

          {resolvedSearchParams.updated ? (
            <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
              บันทึกสถานะเรียบร้อยแล้ว ระบบได้จำลองการแจ้ง broker และ LINE ถึงลูกค้าแล้ว
            </div>
          ) : null}

          {isMagicLinkUsed ? (
            <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">
              Magic Link นี้ถูกใช้เพื่อบันทึกสถานะสุดท้ายแล้ว หากต้องแก้ไขเพิ่มเติม กรุณาให้ broker สร้างลิงก์ใหม่
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">เลขที่คำสั่งซื้อ</div>
              <div className="mt-1 font-semibold text-slate-950">{order.orderNumber}</div>
              <div className="mt-1 text-xs text-slate-500">สร้างเมื่อ {order.createdAt.toLocaleString('th-TH')}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">สถานะปัจจุบัน</div>
              <div className="mt-1 font-semibold text-slate-950">{getOrderStatusLabel(order.status)}</div>
              <div className="mt-1 text-xs text-slate-500">Magic Link หมดอายุ {magicToken.expiresAt.toLocaleDateString('th-TH')}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">ข้อมูลผู้เอาประกัน</div>
              <div className="mt-1 font-semibold text-slate-950">{customerName}</div>
              <div className="mt-1 text-slate-600">{customerPhone}</div>
              <div className="mt-1 text-slate-600">{order.customerEmail ?? '-'}</div>
              <div className="mt-2 text-xs text-slate-500">เลขบัตรประชาชน: {order.idCardNumber ?? '-'}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">ที่อยู่ผู้เอาประกัน</div>
              <div className="mt-1 leading-6 text-slate-700">{getFullAddress(order)}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">ข้อมูลรถยนต์</div>
              <div className="mt-1 font-semibold text-slate-950">{vehicle}</div>
              <div className="mt-1 text-slate-600">ทะเบียน {plate}</div>
              <div className="mt-1 text-slate-600">เลขตัวถัง: {order.chassisNumber ?? '-'}</div>
              <div className="mt-1 text-slate-600">วันที่เริ่มคุ้มครองภาคสมัครใจ: {formatDate(order.policyStartDate)}</div>
              {order.ctpSelected ? (
                <div className="mt-1 text-slate-600">วันที่เริ่มคุ้มครอง พ.ร.บ.: {formatDate(order.ctpPolicyStartDate)}</div>
              ) : null}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-slate-500">บริษัทประกัน</div>
              <div className="mt-1 font-semibold text-slate-950">{providerName}</div>
              <div className="mt-1 text-slate-600">{order.pkg.providerContactName ?? '-'}</div>
              <div className="mt-1 text-slate-600">{order.pkg.providerPhone ?? '-'}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <div className="text-slate-500">ที่อยู่จัดส่งกรมธรรม์</div>
              <div className="mt-1 leading-6 text-slate-700">{deliveryAddress || '-'}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <div className="text-slate-500">แพ็กเกจที่เลือก</div>
              <div className="mt-1 font-semibold text-slate-950">{order.pkg.name}</div>
              <div className="mt-1 text-slate-600">{order.pkg.company}</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-500">ประเภทซ่อม</div>
                  <div className="font-semibold text-slate-900">{order.pkg.repairType ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ความคุ้มครอง</div>
                  <div className="font-semibold text-slate-900">{order.pkg.coverage ?? '-'}</div>
                </div>
                {order.ctpSelected ? (
                  <div>
                    <div className="text-xs text-slate-500">พ.ร.บ.</div>
                    <div className="font-semibold text-slate-900">
                      {order.ctpRateCode ?? '-'} / {formatCurrency(order.ctpTotal)}
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="text-xs text-slate-500">ยอดชำระ</div>
                  <div className="font-semibold text-slate-900">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50 p-4 sm:col-span-2">
              <div className="text-slate-600">การชำระเงิน</div>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-slate-500">วิธีชำระเงิน</div>
                  <div className="font-semibold text-slate-950">{getPaymentMethodLabel(order.paymentMethod)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">สถานะชำระเงิน</div>
                  <div className="font-semibold text-slate-950">{getPaymentStatusLabel(order.paymentStatus)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">จำนวนเงิน</div>
                  <div className="font-semibold text-slate-950">{formatCurrency(order.paymentAmount ?? order.pkg.netPrice)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {order.slipUrl ? (
                  <a
                    href={order.slipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-[#0052CC] px-4 py-2 text-sm font-semibold text-white"
                  >
                    เปิดสลิปชำระเงิน
                  </a>
                ) : null}
                {order.gatewayUrl ? (
                  <a
                    href={order.gatewayUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    เปิดลิงก์ Gateway
                  </a>
                ) : null}
                {!order.slipUrl && !order.gatewayUrl ? (
                  <span className="text-sm text-slate-500">ยังไม่มีไฟล์สลิปหรือลิงก์ชำระเงิน</span>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
              <div className="text-slate-500">เอกสารและกรมธรรม์</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {order.vehicleDocumentUrl ? (
                  <a
                    href={order.vehicleDocumentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
                  >
                    เปิด{order.vehicleDocumentType ?? 'เอกสารรถ'}
                  </a>
                ) : (
                  <span className="text-sm text-slate-500">ยังไม่มีเอกสารรถ</span>
                )}
                {order.policyPdfUrl ? (
                  <a
                    href={order.policyPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    เปิด PDF กรมธรรม์
                  </a>
                ) : null}
              </div>
              {order.policyNumber ? <div className="mt-2 text-sm font-semibold text-slate-700">เลขกรมธรรม์: {order.policyNumber}</div> : null}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-bold text-slate-950">อัปเดตสถานะกรมธรรม์</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            สถานะนี้จะถูกบันทึกใน timeline ของลูกค้า และแจ้งกลับไปยัง broker
          </p>

          {isMagicLinkUsed ? (
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              สถานะปัจจุบัน: <span className="font-semibold text-slate-950">{getOrderStatusLabel(order.status)}</span>
              {magicToken.usedAt ? <span className="mt-1 block">บันทึกเมื่อ {magicToken.usedAt.toLocaleString('th-TH')}</span> : null}
            </div>
          ) : (
          <form action={updateOrderFromMagicLink} encType="multipart/form-data" className="mt-5 space-y-4">
            <input type="hidden" name="token" value={decodedToken} />

            <div>
              <label htmlFor="actorName" className="mb-1 block text-sm font-semibold text-slate-700">
                ชื่อเจ้าหน้าที่
              </label>
              <input
                id="actorName"
                name="actorName"
                type="text"
                placeholder="เช่น คุณสมชาย"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="status" className="mb-1 block text-sm font-semibold text-slate-700">
                สถานะ
              </label>
              <select
                id="status"
                name="status"
                required
                defaultValue={statusSelectDefaultValue}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="INSURER_REVIEWING">รับเรื่อง / กำลังตรวจสอบ</option>
                <option value="POLICY_APPROVED">อนุมัติกรมธรรม์แล้ว</option>
                <option value="POLICY_ISSUED">ออกกรมธรรม์แล้ว</option>
                <option value="REJECTED">ไม่อนุมัติ / ขอปฏิเสธ</option>
              </select>
            </div>

            <div>
              <label htmlFor="policyNumber" className="mb-1 block text-sm font-semibold text-slate-700">
                เลขกรมธรรม์
              </label>
              <input
                id="policyNumber"
                name="policyNumber"
                type="text"
                defaultValue={order.policyNumber ?? ''}
                placeholder="กรอกเลขกรมธรรม์เมื่อทราบ"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="policyPdfFile" className="mb-1 block text-sm font-semibold text-slate-700">
                แนบ PDF กรมธรรม์
              </label>
              <input
                id="policyPdfFile"
                name="policyPdfFile"
                type="file"
                accept="application/pdf"
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none file:mr-3 file:rounded-xl file:border-0 file:bg-[#0052CC] file:px-3 file:py-2 file:font-semibold file:text-white focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                ต้องแนบ PDF ก่อนบันทึกสถานะ “ออกกรมธรรม์แล้ว”
              </p>
            </div>

            <div>
              <label htmlFor="insurerNote" className="mb-1 block text-sm font-semibold text-slate-700">
                ข้อความเพิ่มเติม
              </label>
              <textarea
                id="insurerNote"
                name="insurerNote"
                rows={5}
                placeholder="เช่น อนุมัติแล้ว รอจัดส่งกรมธรรม์ภายใน 1 วันทำการ"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[16px] outline-none focus:border-[#0052CC] focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#0052CC] px-4 py-4 text-base font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-[#0040a2]"
            >
              บันทึกและแจ้งลูกค้า
            </button>
          </form>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h2 className="font-bold text-slate-950">Timeline ล่าสุด</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {order.statusHistory.length === 0 ? (
              <p className="text-sm text-slate-500">ยังไม่มีประวัติสถานะ</p>
            ) : (
              order.statusHistory.map((item) => (
                <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-950">{getOrderStatusLabel(item.status)}</div>
                    <div className="text-xs text-slate-500">{item.createdAt.toLocaleString('th-TH')}</div>
                  </div>
                  {item.message ? <p className="mt-1 text-sm text-slate-600">{getStatusHistoryMessageLabel(item.message)}</p> : null}
                </div>
              ))
            )}
          </div>
          <Link href={`/line-app/tracking/${order.orderNumber}`} className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
            ดูหน้าติดตามสถานะลูกค้า
          </Link>
        </section>
      </div>
    </main>
  );
}
