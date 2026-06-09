'use client';

import { useEffect } from 'react';

export const TRACKING_ORDER_MEMORY_KEY = 'lineAppTrackingOrderNumbers';

function readStoredOrderNumbers() {
  try {
    const rawValue = window.localStorage.getItem(TRACKING_ORDER_MEMORY_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : [];
  } catch {
    return [];
  }
}

export function rememberTrackingOrder(orderNumber: string) {
  const normalizedOrderNumber = orderNumber.trim();

  if (!normalizedOrderNumber) {
    return;
  }

  const storedOrderNumbers = readStoredOrderNumbers();
  const nextOrderNumbers = [normalizedOrderNumber, ...storedOrderNumbers.filter((storedOrderNumber) => storedOrderNumber !== normalizedOrderNumber)].slice(0, 20);

  window.localStorage.setItem(TRACKING_ORDER_MEMORY_KEY, JSON.stringify(nextOrderNumbers));
}

export function RememberTrackingOrder({ orderNumber }: { orderNumber: string }) {
  useEffect(() => {
    rememberTrackingOrder(orderNumber);
  }, [orderNumber]);

  return null;
}
