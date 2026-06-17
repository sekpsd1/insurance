'use client';

import { useEffect } from 'react';

export function CheckoutScrollReset() {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const originalScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    const scrollToTop = () => window.scrollTo(0, 0);
    scrollToTop();

    const animationFrame = window.requestAnimationFrame(scrollToTop);
    const shortTimer = window.setTimeout(scrollToTop, 120);
    const longTimer = window.setTimeout(scrollToTop, 350);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
      window.history.scrollRestoration = originalScrollRestoration;
    };
  }, []);

  return null;
}
