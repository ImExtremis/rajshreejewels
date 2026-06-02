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
  status: string;
}

interface CartItem {
  productId: string;
  addedAt: string;
  cartError: string | null;
  product?: Product;
}

interface PublicSettings {
  storeName: string;
  storeTagline: string;
  shippingFreeAboveINR: number;
  shippingFlatRateINR: number;
  codEnabled: boolean;
}

interface CartClientProps {
  sessionUser: {
    id: string;
    name: string;
    email: string;
    phone: string;
    accessToken: string;
  };
}

export default function CartClient({ sessionUser }: CartClientProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  
  const [items, setItems] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 4000);
  };

  const fetchCart = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch settings
      const settingsRes = await fetch('/api/v1/settings/public');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);
      }

      // Fetch cart items
      const cartRes = await apiClient('/cart', {}, token);
      if (!cartRes.ok) throw new Error('Failed to retrieve your cart items.');
      
      const cartData = await cartRes.json();
      setItems(cartData.items || []);
    } catch (err: any) {
      console.error('❌ Failed to load cart:', err);
      setError(err.message || 'Could not fetch cart items.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    fetchCart();
  }, [status, session?.accessToken]);

  const handleRemove = async (productId: string) => {
    try {
      setRemovingId(productId);
      const res = await apiClient(`/cart/remove/${productId}`, {
        method: 'DELETE',
      }, token);

      if (!res.ok) throw new Error('Failed to remove item');

      setItems(prev => prev.filter(item => item.productId !== productId));
      triggerAlert('✨ Unique jewellery piece removed from cart');
    } catch (err: any) {
      triggerAlert('Failed to remove item. Please try again.', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  // Pricing math (Only sum prices of AVAILABLE/VALID pieces!)
  const getSubtotal = () => {
    return items
      .filter(item => !item.cartError && item.product)
      .reduce((sum, item) => sum + (item.product?.priceINR || 0), 0);
  };

  const subtotal = getSubtotal();
  const isFreeShipping = settings ? subtotal >= settings.shippingFreeAboveINR : true;
  const shippingCost = isFreeShipping ? 0 : (settings?.shippingFlatRateINR || 99);
  const total = subtotal + shippingCost;

  // Check if there are any checkout-eligible available items
  const eligibleItems = items.filter(item => !item.cartError && item.product);

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
        Your Shopping Cart
      </h1>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
          <p className="mt-4 text-text-muted font-body text-sm uppercase tracking-wider">Loading your luxury selection...</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-surface-2/20 border border-border-custom rounded-lg max-w-xl mx-auto px-4">
          <p className="text-error font-body text-sm mb-4">{error}</p>
          <button onClick={fetchCart} className="bg-primary text-surface font-body text-xs font-bold uppercase py-2.5 px-6 rounded-md hover:bg-accent transition-colors">
            Retry Loading
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-surface border border-border-custom rounded-lg max-w-xl mx-auto px-6 shadow-sm">
          <div className="bg-surface-2 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border-custom/50">
            <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-primary mb-2">Your Cart is Empty</h2>
          <p className="text-text-muted font-body text-sm mb-8 max-w-md mx-auto leading-relaxed">
            You haven't reserved any of our handcrafted, completely one-of-a-kind jewellery creations yet.
          </p>
          <Link href="/shop" className="inline-block bg-primary text-surface font-body text-xs font-bold uppercase tracking-wider py-3 px-8 rounded hover:bg-accent transition-colors">
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => {
              const prod = item.product;
              const isInvalid = !!item.cartError;
              
              if (!prod) return null;

              return (
                <div
                  key={item.productId}
                  className={`border border-border-custom rounded-lg p-4 bg-surface flex flex-col sm:flex-row sm:items-center sm:justify-between relative transition-all duration-300 ${
                    isInvalid ? 'opacity-65 bg-surface-2/10' : 'hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-4 flex-grow">
                    <img
                      src={prod.primaryImageUrl}
                      alt={prod.displayName}
                      className="w-20 h-20 object-cover rounded border border-border-custom flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-display text-base font-bold text-primary leading-tight flex items-center">
                        {prod.displayName}
                        {isInvalid && (
                          <span className="ml-2 text-[9px] font-bold tracking-wider uppercase bg-error/10 border border-error/20 text-error px-2 py-0.5 rounded">
                            {item.cartError === 'ITEM_SOLD' ? 'SOLD OUT' : 'UNAVAILABLE'}
                          </span>
                        )}
                      </h3>
                      <p className="font-body text-xs text-text-muted mt-1 leading-normal line-clamp-2 pr-4">{prod.shortDesc}</p>
                      
                      {!isInvalid && (
                        <span className="font-mono text-xs text-accent mt-2 inline-block bg-accent/5 border border-accent/10 px-2 py-0.5 rounded">
                          Only 1 available
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price and Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-border-custom/50 flex-shrink-0">
                    <span className={`font-mono text-sm font-bold block mb-2 ${isInvalid ? 'text-text-muted line-through' : 'text-primary'}`}>
                      Rs. {prod.priceINR.toLocaleString('en-IN')}
                    </span>
                    
                    <button
                      disabled={removingId === prod.id}
                      onClick={() => handleRemove(prod.id)}
                      className="text-error hover:text-red-500 font-body text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {removingId === prod.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pricing Sidebar */}
          <div className="lg:col-span-1">
            <div className="border border-border-custom rounded-lg p-6 bg-surface shadow-sm sticky top-28">
              <h2 className="font-display text-lg font-bold text-primary uppercase tracking-wider border-b border-border-custom pb-3 mb-6">
                Pricing Details
              </h2>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-body">
                  <span className="text-text-muted">Subtotal:</span>
                  <span className="text-primary font-mono font-bold">Rs. {subtotal.toLocaleString('en-IN')}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm font-body">
                  <span className="text-text-muted">Shipping:</span>
                  <span className="text-primary font-semibold">
                    {shippingCost === 0 ? (
                      <span className="text-success uppercase">Free</span>
                    ) : (
                      <span className="font-mono font-bold">Rs. {shippingCost.toLocaleString('en-IN')}</span>
                    )}
                  </span>
                </div>

                {/* Free Shipping Progress bar alert */}
                {settings && subtotal > 0 && subtotal < settings.shippingFreeAboveINR && (
                  <div className="bg-accent/5 border border-accent/15 p-3 rounded text-center">
                    <span className="font-body text-[11px] font-semibold text-accent leading-normal block">
                      ✨ Shop for Rs. {(settings.shippingFreeAboveINR - subtotal).toLocaleString('en-IN')} more to unlock FREE shipping!
                    </span>
                  </div>
                )}

                <div className="border-t border-border-custom pt-4 flex justify-between items-center">
                  <span className="font-display text-base font-bold text-primary">GRAND TOTAL:</span>
                  <span className="font-mono text-lg font-bold text-accent">
                    Rs. {total.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="pt-6">
                  {eligibleItems.length > 0 ? (
                    <button
                      onClick={() => router.push(`/checkout?productId=${eligibleItems[0].product?.id}`)}
                      className="w-full bg-primary text-surface hover:bg-accent py-3.5 rounded-md font-body text-xs font-bold uppercase tracking-wider transition-colors text-center block"
                    >
                      Proceed to Checkout
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-surface border border-border-custom text-text-muted py-3.5 rounded-md font-body text-xs font-bold uppercase tracking-wider opacity-50 cursor-not-allowed"
                    >
                      No Available Items
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
