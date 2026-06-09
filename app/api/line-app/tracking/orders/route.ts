import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function toPaymentAmount(order: {
  paymentAmount: number | null;
  ctpSelected: boolean;
  ctpTotal: number | null;
  pkg: {
    payablePrice: number | null;
    netPrice: number;
  };
}) {
  const ctpTotal = order.ctpSelected ? (order.ctpTotal ?? 0) : 0;
  return order.paymentAmount ?? (order.pkg.payablePrice ?? order.pkg.netPrice) + ctpTotal;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lineId = searchParams.get('lineId')?.trim();

  if (!lineId) {
    return NextResponse.json({ orders: [] });
  }

  const user = await prisma.user.findUnique({
    where: { lineId },
    select: { id: true }
  });

  if (!user) {
    return NextResponse.json({ orders: [] });
  }

  const orders = await prisma.order.findMany({
    where: {
      userId: user.id
    },
    include: {
      pkg: {
        select: {
          name: true,
          payablePrice: true,
          netPrice: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 20
  });

  return NextResponse.json({
    orders: orders.map((order) => ({
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      packageName: order.pkg.name,
      vehicleLabel: [order.carBrand, order.carModel, order.carYear].filter(Boolean).join(' / '),
      paymentAmount: toPaymentAmount(order),
      createdAt: order.createdAt.toISOString()
    }))
  });
}
