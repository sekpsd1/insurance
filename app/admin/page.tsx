import { prisma } from '@/lib/prisma';
import { updateOrderStatus } from '@/lib/actions';

function getStatusStyles(status: string) {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'REVIEWING':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

export default async function AdminPage() {
  const orders = await prisma.order.findMany({
    take: 20,
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      user: true,
      pkg: true
    }
  });

  const adminOrders = orders as Array<
    (typeof orders)[number] & {
      plateNumber: string | null;
    }
  >;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Admin Dashboard
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-white">จัดการออเดอร์</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-300">
          ดูรายการออเดอร์ล่าสุด 20 รายการ ส่วนการจัดการแพ็กเกจและแคมเปญให้ไปที่หน้า Insurance Campaigns
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl shadow-black/10">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">รายการออเดอร์</h3>
              <p className="text-sm text-slate-500">เรียงจากใหม่ไปเก่า</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
              {orders.length} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-white">
              <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <th className="px-5 py-4 sm:px-6">เลขคำสั่งซื้อ</th>
                <th className="px-5 py-4 sm:px-6">ชื่อลูกค้า / ทะเบียนรถ</th>
                <th className="px-5 py-4 sm:px-6">แพ็กเกจ</th>
                <th className="px-5 py-4 sm:px-6">สถานะ</th>
                <th className="px-5 py-4 sm:px-6 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={5}>
                    ยังไม่มีออเดอร์ในระบบ
                  </td>
                </tr>
              ) : (
                adminOrders.map((order) => (
                  <tr key={order.id} className="align-top transition hover:bg-slate-50/70">
                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-semibold text-slate-900">{order.orderNumber}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleString('th-TH')}
                      </div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.user.name ?? '-'}</div>
                      <div className="mt-1 text-sm text-slate-500 uppercase tracking-wide">
                        {order.plateNumber ?? '-'}
                      </div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="font-medium text-slate-900">{order.pkg.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{order.pkg.company}</div>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyles(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </td>

                    <td className="px-5 py-5 sm:px-6">
                      <div className="flex flex-col justify-end gap-2 sm:flex-row">
                        <form action={updateOrderStatus}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 sm:w-auto"
                          >
                            อนุมัติ
                          </button>
                        </form>

                        <form action={updateOrderStatus}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="status" value="REJECTED" />
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 sm:w-auto"
                          >
                            ปฏิเสธ
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 px-5 py-4 text-sm text-cyan-50 shadow-2xl shadow-black/10">
        <div className="font-semibold text-white">จัดการแพ็กเกจย้ายไปหน้า Insurance Campaigns แล้ว</div>
        <p className="mt-1 text-cyan-100">
          ตอนนี้หน้า /admin จะเบาลงมาก เพราะไม่ต้องโหลดรายการแพ็กเกจจำนวนมากในหน้าเดียวอีกต่อไป
        </p>
      </div>
    </section>
  );
}
