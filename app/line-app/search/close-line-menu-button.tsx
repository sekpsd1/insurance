'use client';

import { useState } from 'react';

type LineMenuLiffClient = {
  init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>;
  closeWindow?: () => void;
};

function loadLiffSdk() {
  const currentWindow = window as unknown as { liff?: LineMenuLiffClient };

  if (currentWindow.liff) {
    return Promise.resolve(currentWindow.liff);
  }

  return new Promise<LineMenuLiffClient>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
    script.async = true;
    script.onload = () => {
      const loadedWindow = window as unknown as { liff?: LineMenuLiffClient };
      if (loadedWindow.liff) {
        resolve(loadedWindow.liff);
      } else {
        reject(new Error('LIFF SDK failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('LIFF SDK failed to load'));
    document.head.appendChild(script);
  });
}

export default function CloseLineMenuButton() {
  const [isClosing, setIsClosing] = useState(false);

  async function handleClose() {
    if (isClosing) {
      return;
    }

    setIsClosing(true);
    const currentWindow = window as unknown as { liff?: LineMenuLiffClient };

    try {
      let liff = currentWindow.liff;
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();

      if (!liff && liffId) {
        liff = await loadLiffSdk();
        await liff?.init({ liffId, withLoginOnExternalBrowser: false });
      }

      if (typeof liff?.closeWindow === 'function') {
        liff.closeWindow();
        window.setTimeout(() => {
          setIsClosing(false);
        }, 1000);
        return;
      }
    } catch (error) {
      console.warn('[LIFF] close menu failed', error);
    }

    window.close();
    window.setTimeout(() => {
      setIsClosing(false);
    }, 500);
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={isClosing}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#ffdc45] bg-[#fff257] px-2.5 text-sm font-bold text-[#06408f] shadow-[0_2px_0_rgba(2,53,132,0.25)] transition hover:bg-[#fff78c] disabled:cursor-wait disabled:opacity-70"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5V20h13v-9.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20v-5h5v5" />
      </svg>
      <span>กลับสู่เมนู</span>
    </button>
  );
}
