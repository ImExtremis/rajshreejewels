'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [settings, setSettings] = useState<any>({
    storeName: 'RAJSHREE JEWELS',
    storeTagline: 'Handcrafted premium 1-gram gold polish, antique, kundan and fashion jewellery. Each piece is a unique physical creation.',
    storePhone: '',
    storeEmail: '',
    whatsappNumber: '',
    storeAddress: '',
    instagramUrl: '',
    facebookUrl: '',
  });

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/v1/settings/public');
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Failed to load settings in footer:', err);
      }
    }
    fetchSettings();
  }, []);

  const whatsappMessage = encodeURIComponent(`Hi ${settings.storeName || 'Rajshree Jewels'}! I saw your jewellery store online and would love to enquire about your designs.`);

  return (
    <>
      <footer className="bg-primary text-surface border-t border-border-custom/25 pt-16 pb-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            
            {/* About */}
            <div className="space-y-4">
              <h3 className="font-display text-2xl tracking-wider text-accent font-semibold uppercase">
                {settings.storeName || 'RAJSHREE JEWELS'}
              </h3>
              <p className="font-body text-xs text-white/80 leading-relaxed max-w-xs">
                {settings.storeTagline || 'Handcrafted premium 1-gram gold polish, antique, kundan and fashion jewellery. Each piece is a unique physical creation. Built to wow at every glance.'}
              </p>
            </div>

            {/* Shop Links */}
            <div>
              <h4 className="font-display text-lg font-medium text-surface mb-4 tracking-wide">Collections</h4>
              <ul className="space-y-2 text-xs text-white/80 font-body">
                <li><Link href="/categories/necklace" className="hover:text-accent transition-colors">Necklaces</Link></li>
                <li><Link href="/categories/earrings" className="hover:text-accent transition-colors">Earrings</Link></li>
                <li><Link href="/categories/bangles" className="hover:text-accent transition-colors">Bangles & Bracelets</Link></li>
                <li><Link href="/categories/ring" className="hover:text-accent transition-colors">Rings</Link></li>
                <li><Link href="/shop" className="hover:text-accent font-semibold transition-colors">Shop All</Link></li>
              </ul>
            </div>

            {/* Information / Policies (Critical for Razorpay) */}
            <div>
              <h4 className="font-display text-lg font-medium text-surface mb-4 tracking-wide">Customer Care</h4>
              <ul className="space-y-2 text-xs text-white/80 font-body">
                <li><Link href="/terms-and-conditions" className="hover:text-accent transition-colors">Terms & Conditions</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
                <li><Link href="/shipping-policy" className="hover:text-accent transition-colors">Shipping & Delivery Policy</Link></li>
                <li><Link href="/return-policy" className="hover:text-accent transition-colors">Cancellation & Refund Policy</Link></li>
                <li><Link href="/contact" className="hover:text-accent transition-colors">Contact Us</Link></li>
              </ul>
            </div>

            {/* Contact Details */}
            {(settings.storeAddress || settings.storePhone || settings.storeEmail || settings.instagramUrl || settings.facebookUrl) ? (
              <div className="space-y-3 text-xs text-white/80 font-body">
                <h4 className="font-display text-lg font-medium text-surface mb-4 tracking-wide">Contact</h4>
                {settings.storeAddress && (
                  <p className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{settings.storeAddress}</span>
                  </p>
                )}
                {settings.storePhone && (
                  <p className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{settings.storePhone}</span>
                  </p>
                )}
                {settings.storeEmail && (
                  <p className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{settings.storeEmail}</span>
                  </p>
                )}
                {(settings.instagramUrl || settings.facebookUrl) && (
                  <div className="flex gap-3 pt-2 border-t border-border-custom/10 mt-3">
                    {settings.instagramUrl && (
                      <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors font-semibold">
                        Instagram
                      </a>
                    )}
                    {settings.facebookUrl && (
                      <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors font-semibold">
                        Facebook
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border-custom/10 pt-8 flex flex-col sm:flex-row justify-between items-center text-2xs text-white/80 font-body">
            <p>© {new Date().getFullYear()} {settings.storeName || 'Rajshree Jewels'}. All Rights Reserved.</p>
            <p className="mt-2 sm:mt-0 tracking-wider uppercase">
              {settings.storeName ? `PREMIUM ${settings.storeName}` : 'PREMIUM 1-GRAM JEWELLERY'}
            </p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      {settings.whatsappNumber && (
        <a
          href={`https://wa.me/91${settings.whatsappNumber}?text=${whatsappMessage}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#20ba5a] text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
          aria-label="Chat on WhatsApp"
        >
          <svg
            className="w-7 h-7"
            fill="currentColor"
            viewBox="0 0 448 512"
          >
            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
          </svg>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out text-white text-xs font-semibold whitespace-nowrap pl-0 group-hover:pl-2">
            Chat with Us
          </span>
        </a>
      )}
    </>
  );
}
