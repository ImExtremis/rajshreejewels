'use client';

import React, { useState, useEffect } from 'react';

export default function AnnouncementBanner() {
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [storageKey, setStorageKey] = useState<string>('');

  // Hash function to create a unique identifier based on text content
  const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  useEffect(() => {
    async function fetchBanner() {
      try {
        const res = await fetch('/api/v1/settings/public');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.announcementBanner && data.announcementBanner.trim() !== '') {
          const text = data.announcementBanner.trim();
          const textHash = getHash(text);
          const key = `banner_dismissed_${textHash}`;
          setStorageKey(key);
          setBannerText(text);

          // Check if previously dismissed
          const isDismissed = localStorage.getItem(key);
          if (isDismissed !== 'true') {
            setIsVisible(true);
          }
        }
      } catch (err) {
        console.error('⚠️ Failed to load announcement banner settings:', err);
      }
    }

    fetchBanner();
  }, []);

  const handleDismiss = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible || !bannerText) return null;

  return (
    <div className="relative bg-accent text-primary py-2 px-8 text-center text-xs font-body font-bold uppercase tracking-wider transition-all duration-300 shadow-sm animate-fade-in flex items-center justify-center min-h-[36px]">
      <span>{bannerText}</span>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:opacity-75 p-1 font-sans text-sm focus:outline-none transition-opacity"
        aria-label="Dismiss banner"
      >
        ✕
      </button>
    </div>
  );
}
