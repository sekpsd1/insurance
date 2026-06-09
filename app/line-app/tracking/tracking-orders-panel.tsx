'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getOrderStatusLabel, getPaymentStatusLabel } from '@/lib/status-labels';
import { TRACKING_ORDER_MEMORY_KEY } from '@/app/line-app/_components/tracking-order-memory';

type LineProfile = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  getProfile: () => Promise<LineProfile>;
};

type CustomerOrder = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  packageName: string;
  vehicleLabel: string;
  paymentAmount: number;
  createdAt: string;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';

function loadLiffSdk() {
  if (window.liff) {
    return Promise.resolve(window.liff);
  }

  return new Promise<LiffClient>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${LIFF_SDK_URL}"]`);

    if (existingScript) {
      existingScript.addEventListener('load', () => (window.liff ? resolve(window.liff) : reject(new Error('LIFF SDK did not load'))), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('LIFF SDK failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LIFF_SDK_URL;
    script.async = true;
    script.onload = () => (window.liff ? resolve(window.liff) : reject(new Error('LIFF SDK did not load')));
    script.onerror = () => reject(new Error('LIFF SDK failed to load'));
    document.head.appendChild(script);
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function readStoredOrderNumbers() {
  try {
    const rawValue = window.localStorage.getItem(TRACKING_ORDER_MEMORY_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
  } catch {
    return [];
  }
}

async function fetchTrackingOrders(lineId: string, orderNumbers: string[]) {
  const params = new URLSearchParams();

  if (lineId) {
    params.set('lineId', lineId);
  }

  if (orderNumbers.length > 0) {
    params.set('orderNumbers', orderNumbers.join(','));
  }

  if (!params.toString()) {
    return [];
  }

  const response = await fetch(`/api/line-app/tracking/orders?${params.toString()}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error('Tracking orders request failed');
  }

  const data = (await response.json()) as { orders?: CustomerOrder[] };
  return data.orders ?? [];
}

export function TrackingOrdersPanel() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'unavailable' | 'error'>('loading');

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
    const storedOrderNumbers = readStoredOrderNumbers();

    if (!liffId && storedOrderNumbers.length === 0) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;

    const loadOrders = async (lineId = '') => {
      const nextOrders = await fetchTrackingOrders(lineId, storedOrderNumbers);

      if (!cancelled) {
        setOrders(nextOrders);
        setStatus('loaded');
      }
    };

    if (!liffId) {
      loadOrders().catch((error) => {
        console.warn('[Tracking] stored order lookup failed', error);
        if (!cancelled) {
          setStatus('error');
        }
      });
      return () => {
        cancelled = true;
      };
    }

    loadLiffSdk()
      .then(async (liff) => {
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          await loadOrders();
          return;
        }

        const profile = await liff.getProfile();
        await loadOrders(profile.userId);
      })
      .catch((error) => {
        console.warn('[LIFF] tracking order lookup failed', error);
        if (storedOrderNumbers.length > 0) {
          loadOrders().catch((storedOrderError) => {
            console.warn('[Tracking] stored order lookup failed', storedOrderError);
            if (!cancelled) {
              setStatus('error');
            }
          });
        } else if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'unavailable') {
    return null;
  }

  if (status === 'loading') {
    return (
      <div className="mt-6 rounded-2xl bg-[#eef3ff] p-4 text-sm text-slate-600">
        กำลังดึงรายการคำสั่งซื้อของคุณ...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-100">
        ยังดึงรายการคำสั่งซื้ออัตโนมัติไม่ได้ กรุณากรอกเลขที่คำสั่งซื้อด้านล่าง
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-100">
        ยังไม่พบคำสั่งซื้อจาก LINE นี้ หากเคยสั่งซื้อไว้ กรุณากรอกเลขที่คำสั่งซื้อด้านล่าง
      </div>
    );
  }

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-950">รายการคำสั่งซื้อของคุณ</h2>
        <p className="mt-1 text-sm text-slate-500">เลือกออเดอร์เพื่อดูสถานะล่าสุด</p>
      </div>
      <div className="space-y-3">
        {orders.map((order) => (
          <Link
            key={order.orderNumber}
            href={`/line-app/tracking/${encodeURIComponent(order.orderNumber)}`}
            className="block rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 transition hover:bg-white hover:ring-blue-200"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0052CC]">Order</div>
                <div className="mt-1 text-base font-bold text-slate-950">{order.orderNumber}</div>
              </div>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0052CC]">
                {getOrderStatusLabel(order.status)}
              </div>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-800">{order.packageName}</div>
            {order.vehicleLabel ? <div className="mt-1 text-sm text-slate-500">{order.vehicleLabel}</div> : null}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm">
              <span className="text-slate-500">{getPaymentStatusLabel(order.paymentStatus)}</span>
              <span className="font-bold text-slate-950">{formatCurrency(order.paymentAmount)}</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">สร้างเมื่อ {formatDate(order.createdAt)}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
