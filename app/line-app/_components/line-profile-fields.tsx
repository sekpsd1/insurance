'use client';

import { useEffect, useState } from 'react';

type LineProfile = {
  userId: string;
  displayName?: string;
  pictureUrl?: string;
};

type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  getProfile: () => Promise<LineProfile>;
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

export function LineProfileFields({ fallbackLineId }: { fallbackLineId: string }) {
  const [profile, setProfile] = useState<LineProfile | null>(null);

  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();

    if (!liffId) {
      return;
    }

    let cancelled = false;

    loadLiffSdk()
      .then(async (liff) => {
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const nextProfile = await liff.getProfile();

        if (!cancelled) {
          setProfile(nextProfile);
        }
      })
      .catch((error) => {
        console.warn('[LIFF] profile initialization failed', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <input type="hidden" name="lineId" value={profile?.userId || fallbackLineId} />
      <input type="hidden" name="lineDisplayName" value={profile?.displayName ?? ''} />
      <input type="hidden" name="linePictureUrl" value={profile?.pictureUrl ?? ''} />
    </>
  );
}
