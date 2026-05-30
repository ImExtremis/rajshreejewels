// lib/analytics.ts
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  } else {
    // Fallback/log in non-production environments
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 [Analytics Event Logged]: ${name}`, params);
    }
  }
}
