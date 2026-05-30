'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiClient } from '../../lib/api';

interface Product {
  id: string;
  slug: string;
  displayName: string;
  shortDesc: string;
  priceINR: number;
  primaryImageUrl: string;
  status: 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'UNLISTED';
}

interface WishlistItem {
  id: string;
  productId: string;
  addedAt: string;
  product: Product;
}

interface WishlistClientProps {
  sessionUser: {
    id: string;
    name: string;
    email: string;
    phone: string;
    accessToken: string;
  };
}

export default function WishlistClient({ sessionUser }: WishlistClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.accessToken || sessionUser.accessToken;

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiClient('/users/me/wishlist', {}, token);
      if (!res.ok) throw new Error('Failed to retrieve your wishlist items.');

      const data = await res.json();
      setItems(data.wishlist || []);
    } catch (err: any) {
      console.error('❌ Failed to load wishlist:', err);
      setError(err.message || 'Could not fetch wishlist items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [sessionUser.accessToken]);

  const handleRemove = async (productId: string) => {
    try {
      setRemovingId(productId);
      const res = await apiClient(`/users/me/wishlist/${productId}`, {
        method: 'DELETE',
      }, token);

      if (!res.ok) throw new Error('Failed to remove item');

      setItems(prev => prev.filter(item => item.productId !== productId));
      triggerAlert('✨ Removed from your wishlist');
    } catch (err: any) {
      triggerAlert('Failed to remove item. Please try again.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Toast Alert */}
      {alertMsg && (
        <div className={`fixed top-6 right-6 z-50 flex items-center p-4 rounded-lg shadow-xl border animate-slide-in ${
          alertMsg.type === 'error' ? 'bg-error/10 border-error/20 text-error' : 'bg-success/10 border-success/20 text-success'
        }`}>
          <span className="font-body text-sm font-semibold">{alertMsg.text}</span>
        </div>
      )}

      <h1 className="font-display text-3xl font-semibold uppercase tracking-wider text-primary border-b border-border-custom pb-4 mb-8">
        My Wishlist
      </h1>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          <p className="mt-4 text-text-muted font-body text-sm uppercase tracking-wider">Loading your saved creations...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-surface-2/20 border border-border-custom rounded-lg max-w-xl mx-auto px-4">
          <p className="text-error font-body text-sm mb-4">{error}</p>
          <button onClick={fetchWishlist} className="bg-primary text-surface font-body text-xs font-bold uppercase py-2.5 px-6 rounded-md hover:bg-accent transition-colors">
            Retry Loading
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface border border-border-custom rounded-lg max-w-xl mx-auto px-6 shadow-sm">
          <div className="bg-surface-2 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border-custom/50">
            <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-primary mb-2">Your Wishlist is Empty</h2>
          <p className="text-text-muted font-body text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Save unique handcrafted gold & imitation jewellery designs here to track their availability.
          </p>
          <Link href="/shop" className="inline-block bg-primary text-surface font-body text-xs font-bold uppercase tracking-wider py-3 px-8 rounded hover:bg-accent transition-colors">
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fade-in">
          {items.map(item => {
            const prod = item.product;
            if (!prod) return null;

            const isAvailable = prod.status === 'AVAILABLE';
            const isReserved = prod.status === 'RESERVED';
            const isSold = prod.status === 'SOLD';

            return (
              <div
                key={item.id}
                className="border border-border-custom rounded-lg bg-surface hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden relative group"
              >
                {/* Image Gallery wrapper */}
                <div className="relative aspect-square overflow-hidden bg-surface-2/30 border-b border-border-custom flex-shrink-0">
                  <img
                    src={prod.primaryImageUrl}
                    alt={prod.displayName}
                    className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                      isSold ? 'grayscale-[40%] contrast-75' : ''
                    }`}
                  />
                  {isSold && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                      <span className="font-display text-base font-bold tracking-widest text-surface border border-surface/50 py-1.5 px-6 uppercase">
                        Sold Out
                      </span>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-4 flex-grow flex flex-col justify-between">
                  <div className="space-y-1.5">
                    {/* Status Dot */}
                    <div className="flex items-center space-x-1.5 mb-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        isAvailable ? 'bg-success animate-pulse' : isReserved ? 'bg-amber-500' : 'bg-sold'
                      }`}></span>
                      <span className="font-body text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        {isAvailable ? 'Available' : isReserved ? 'Reserved' : 'Sold Out'}
                      </span>
                    </div>

                    <h3 className="font-display text-sm font-bold text-primary line-clamp-1 group-hover:text-accent transition-colors">
                      {prod.displayName}
                    </h3>
                    <p className="font-body text-xs text-text-muted leading-relaxed line-clamp-2">{prod.shortDesc}</p>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border-custom/50 flex flex-col space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-sm font-bold text-primary">
                        Rs. {prod.priceINR.toLocaleString('en-IN')}
                      </span>
                      <button
                        disabled={removingId === prod.id}
                        onClick={() => handleRemove(prod.id)}
                        className="text-text-muted hover:text-error font-body text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {removingId === prod.id ? '...' : 'Remove'}
                      </button>
                    </div>

                    {/* Action button CTA */}
                    {isAvailable ? (
                      <button
                        onClick={() => router.push(`/checkout?productId=${prod.id}`)}
                        className="w-full bg-primary text-surface hover:bg-accent py-2 rounded text-center font-body text-[10px] font-bold uppercase tracking-widest transition-colors"
                      >
                        Buy Now →
                      </button>
                    ) : isReserved ? (
                      <button
                        disabled
                        className="w-full bg-surface-2 border border-border-custom text-text-muted py-2 rounded font-body text-[10px] font-bold uppercase tracking-widest opacity-60 cursor-not-allowed text-center"
                      >
                        Item Reserved
                      </button>
                    ) : (
                      <button
                        disabled
                        className="w-full bg-surface-2 border border-border-custom text-text-muted py-2 rounded font-body text-[10px] font-bold uppercase tracking-widest opacity-60 cursor-not-allowed text-center"
                      >
                        Sold Out
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
