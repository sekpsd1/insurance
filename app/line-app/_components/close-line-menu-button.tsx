'use client';

import { useState } from 'react';

type LineMenuLiffClient = {
  init: (config: { liffId: string; withLoginOnExternalBrowser?: boolean }) => Promise<void>;
  closeWindow?: () => void;
  isInClient?: () => boolean;
};

type CloseLineMenuButtonProps = {
  label?: string;
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

function goToLineOfficialAccount() {
  const fallbackUrl = process.env.NEXT_PUBLIC_LINE_OA_URL?.trim() || 'https://line.me/R/ti/p/@164csqch';
  window.location.assign(fallbackUrl);
}

export default function CloseLineMenuButton({ label = 'กลับสู่เมนู' }: CloseLineMenuButtonProps) {
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

      if (typeof liff?.closeWindow === 'function' && (typeof liff.isInClient !== 'function' || liff.isInClient())) {
        liff.closeWindow();
        window.setTimeout(() => {
          goToLineOfficialAccount();
        }, 1200);
        return;
      }
    } catch (error) {
      console.warn('[LIFF] close menu failed', error);
    }

    window.close();
    window.setTimeout(() => {
      goToLineOfficialAccount();
    }, 500);
  }

  return (
    <button
      type="button"
      onClick={handleClose}
      disabled={isClosing}
      className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#ffdc45] bg-[#fff257] px-2 text-xs font-bold text-[#06408f] shadow-[0_2px_0_rgba(2,53,132,0.25)] transition hover:bg-[#fff78c] disabled:cursor-wait disabled:opacity-70"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5V20h13v-9.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 20v-5h5v5" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
