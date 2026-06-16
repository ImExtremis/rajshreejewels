'use client';

import React, { useState, useEffect } from 'react';
import { Product, ItemStatus } from '../../types';
import { trackEvent } from '../../lib/analytics';
import { apiClient } from '../../lib/api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface ProductDetailClientProps {
  initialProduct: Product;
}

export default function ProductDetailClient({ initialProduct }: ProductDetailClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [product, setProduct] = useState<Product>(initialProduct);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [addingToCart, setAddingToCart] = useState<boolean>(false);
  const [buyingNow, setBuyingNow] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState<string | null>(null);
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/v1/settings/public');
        if (res.ok) {
          const data = await res.json();
          if (data.whatsappNumber) {
            setWhatsappNumber(data.whatsappNumber);
          }
        }
      } catch (err) {}
    }
    fetchSettings();
  }, []);

  // Track internal de-duplicated product view and GA4 view_item event on mount
  useEffect(() => {
    trackEvent('view_item', {
      item_id: product.id,
      item_name: product.displayName,
      price: product.priceINR,
      currency: 'INR'
    });

    // Unique guest session generator for de-duplication
    let sessionId = localStorage.getItem('rajshree_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('rajshree_session_id', sessionId);
    }

    // Log impression in unique analytics registry
    fetch('/api/v1/analytics/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId: product.id,
        sessionId: sessionId
      })
    }).catch(() => {});
  }, [product.id, product.displayName, product.priceINR]);

  const imagesList = product.images.length > 0 
    ? product.images 
    : [{ id: 'default', urlMedium: product.primaryImageUrl, urlFull: product.primaryImageUrl, altText: product.displayName }];

  const currentImage = imagesList[selectedImageIdx] || imagesList[0];
  const canNavigateImages = imagesList.length > 1;

  const selectPreviousImage = () => {
    setSelectedImageIdx((idx) => (idx - 1 + imagesList.length) % imagesList.length);
  };

  const selectNextImage = () => {
    setSelectedImageIdx((idx) => (idx + 1) % imagesList.length);
  };

  // Poll product details every 30 seconds to fetch real-time availability status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/products/${product.slug}`);
        if (res.ok) {
          const freshProduct = await res.json();
          
          // If status changes to RESERVED while the user is viewing, show warning toast
          if (product.status === ItemStatus.AVAILABLE && freshProduct.status === ItemStatus.RESERVED) {
            triggerToast("⚠️ Someone is currently in checkout reserving this piece!");
          }
          
          setProduct(freshProduct);
        }
      } catch (err) {}
    }, 30000); // Polls every 30 seconds as specified

    return () => clearInterval(interval);
  }, [product.status, product.slug]);

  useEffect(() => {
    if (session?.accessToken) {
      const checkWishlist = () => {
        const cached = sessionStorage.getItem('rajshree_wishlist');
        if (cached) {
          const list = JSON.parse(cached) as string[];
          setIsWishlisted(list.includes(product.id));
        }
      };

      checkWishlist();

      window.addEventListener('wishlist_updated', checkWishlist);

      const cached = sessionStorage.getItem('rajshree_wishlist');
      if (!cached) {
        if (!(window as any)._fetching_wishlist) {
          (window as any)._fetching_wishlist = true;
          fetch('/api/v1/users/me/wishlist', {
            headers: { 'Authorization': `Bearer ${session.accessToken}` }
          })
            .then(res => {
              if (res.ok) return res.json();
              throw new Error();
            })
            .then((data: any[]) => {
              const ids = data.map((item: any) => item.id);
              sessionStorage.setItem('rajshree_wishlist', JSON.stringify(ids));
              window.dispatchEvent(new CustomEvent('wishlist_updated'));
            })
            .catch(() => {})
            .finally(() => {
              (window as any)._fetching_wishlist = false;
            });
        }
      }

      return () => {
        window.removeEventListener('wishlist_updated', checkWishlist);
      };
    } else {
      setIsWishlisted(false);
    }
  }, [session?.accessToken, product.id]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleAddToCart = async () => {
    try {
      if (!session?.accessToken) {
        router.push('/auth/login');
        return;
      }
      
      setAddingToCart(true);
      
      const res = await apiClient('/cart/add', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id }),
      }, session.accessToken);
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Failed to add to cart');
      }
      
      // Track GA4 add_to_cart event
      trackEvent('add_to_cart', {
        item_id: product.id,
        item_name: product.displayName,
        value: product.priceINR,
        currency: 'INR'
      });
      
      triggerToast("✨ Item added to your cart!");
    } catch (err: any) {
      console.error('Add to cart error:', err);
      triggerToast(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.accessToken) {
      router.push('/auth/login');
      return;
    }

    const cached = sessionStorage.getItem('rajshree_wishlist');
    let list: string[] = cached ? JSON.parse(cached) : [];

    const wasWishlisted = isWishlisted;
    if (wasWishlisted) {
      list = list.filter(id => id !== product.id);
      setIsWishlisted(false);
    } else {
      list.push(product.id);
      setIsWishlisted(true);
    }
    sessionStorage.setItem('rajshree_wishlist', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('wishlist_updated'));

    try {
      const url = wasWishlisted 
        ? `/api/v1/users/me/wishlist/${product.id}`
        : `/api/v1/users/me/wishlist`;
      
      const method = wasWishlisted ? 'DELETE' : 'POST';
      const body = wasWishlisted ? undefined : JSON.stringify({ productId: product.id });

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`
        },
        body
      });

      if (!res.ok) {
        // Revert cache on failure
        const currentCached = sessionStorage.getItem('rajshree_wishlist');
        let currentList: string[] = currentCached ? JSON.parse(currentCached) : [];
        if (wasWishlisted) {
          currentList.push(product.id);
        } else {
          currentList = currentList.filter(id => id !== product.id);
        }
        sessionStorage.setItem('rajshree_wishlist', JSON.stringify(currentList));
        window.dispatchEvent(new CustomEvent('wishlist_updated'));
      } else {
        triggerToast(wasWishlisted ? "✨ Removed from wishlist" : "✨ Added to wishlist");
      }
    } catch (err) {
      // Revert cache on failure
      const currentCached = sessionStorage.getItem('rajshree_wishlist');
      let currentList: string[] = currentCached ? JSON.parse(currentCached) : [];
      if (wasWishlisted) {
        currentList.push(product.id);
      } else {
        currentList = currentList.filter(id => id !== product.id);
      }
      sessionStorage.setItem('rajshree_wishlist', JSON.stringify(currentList));
      window.dispatchEvent(new CustomEvent('wishlist_updated'));
    }
  };

  const handleBuyNow = async () => {
    try {
      if (!session?.accessToken) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/checkout?productId=${product.id}`)}`);
        return;
      }
      
      setBuyingNow(true);
      router.push(`/checkout?productId=${product.id}`);
    } catch (err: any) {
      console.error('Buy Now error:', err);
      triggerToast(err.message || 'Failed to initiate purchase');
    } finally {
      setBuyingNow(false);
    }
  };

  const handleShareWhatsApp = () => {
    if (!whatsappNumber) return;
    const pageUrl = window.location.href;
    const text = encodeURIComponent(`Check out this beautiful one-of-a-kind ${product.displayName} I found at Rajshree Jewels! ${pageUrl}`);
    window.open(`https://wa.me/91${whatsappNumber}?text=${text}`, '_blank');
  };

  const handleShareCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    triggerToast("📋 Link copied to clipboard!");
  };

  // Availability badge configuration
  const getBadgeStyle = () => {
    switch (product.status) {
      case ItemStatus.AVAILABLE:
        return { bg: 'bg-[#2D7A3A]/10 text-[#2D7A3A]', dot: 'bg-[#2D7A3A]', text: 'Available' };
      case ItemStatus.RESERVED:
        return { bg: 'bg-accent/10 text-accent', dot: 'bg-accent', text: 'Reserved (In Checkout)' };
      case ItemStatus.SOLD:
      default:
        return { bg: 'bg-sold/10 text-sold', dot: 'bg-sold', text: 'Sold Out' };
    }
  };

  const badge = getBadgeStyle();
  const isAvailable = product.status === ItemStatus.AVAILABLE;

  return (
    <div className="flex flex-col space-y-12">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-primary border border-accent text-surface py-3 px-6 rounded-card shadow-2xl animate-bounce flex items-center gap-2 text-xs font-semibold uppercase tracking-wider font-body">
          {toastMessage}
        </div>
      )}

      {/* Main product columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
        
        {/* Left Column: Image Gallery */}
        <div className="flex flex-col space-y-4">
          <div
            className="relative aspect-square w-full bg-white border border-border-custom rounded-card overflow-hidden group/image"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setZoomPos({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
              });
            }}
          >
            <img
              src={currentImage.urlFull || currentImage.urlMedium}
              alt={currentImage.altText || product.displayName}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 ease-out md:group-hover/image:scale-150"
              style={{ transformOrigin: `${zoomPos.x}% ${zoomPos.y}%` }}
            />
            {canNavigateImages && (
              <>
                <button
                  type="button"
                  onClick={selectPreviousImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-surface/90 border border-border-custom text-primary shadow hover:text-accent transition-colors"
                  aria-label="Previous product image"
                >
                  <span aria-hidden="true">&#8249;</span>
                </button>
                <button
                  type="button"
                  onClick={selectNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full bg-surface/90 border border-border-custom text-primary shadow hover:text-accent transition-colors"
                  aria-label="Next product image"
                >
                  <span aria-hidden="true">&#8250;</span>
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-primary/70 text-white px-3 py-1 text-[10px] font-body font-bold tracking-wider">
                  {selectedImageIdx + 1} / {imagesList.length}
                </div>
              </>
            )}
            {product.status === ItemStatus.SOLD && (
              <div className="absolute inset-0 bg-primary/30 backdrop-blur-[1px] flex items-center justify-center">
                <span className="font-display text-4xl font-extrabold tracking-widest text-white border-4 border-white px-6 py-3 uppercase rotate-[-6deg]">
                  SOLD OUT
                </span>
              </div>
            )}
          </div>
          
          {/* Thumbnails */}
          {imagesList.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-1">
              {imagesList.map((img: any, idx: number) => (
                <button
                  key={img.id || idx}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`relative w-20 h-20 border rounded-card overflow-hidden flex-shrink-0 transition-all ${selectedImageIdx === idx ? 'border-accent ring-2 ring-accent/20 scale-95' : 'border-border-custom hover:border-accent'}`}
                >
                  <img
                    src={img.urlThumb || img.urlMedium}
                    alt={img.altText || `Thumbnail ${idx + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details & CTA */}
        <div className="flex flex-col space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-accent font-body">
              {product.category}
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-wide leading-tight">
              {product.displayName}
            </h1>
            <p className="font-body text-xs text-text-muted italic leading-relaxed">
              {product.shortDesc}
            </p>
          </div>

          {/* Pricing & Status Badge */}
          <div className="flex items-center gap-6 border-y border-border-custom/50 py-4">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-2xl font-bold text-primary">
                ₹{product.priceINR.toLocaleString('en-IN')}
              </span>
              {product.originalPriceINR && product.originalPriceINR > product.priceINR && (
                <span className="font-mono text-sm text-text-muted line-through">
                  ₹{product.originalPriceINR.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            
            {/* Status dot badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider ${badge.bg}`}>
              <span className={`w-2 h-2 rounded-full ${badge.dot}`}></span>
              <span>{badge.text}</span>
            </div>
          </div>

          {/* Core Spec highlight */}
          <div className="grid grid-cols-2 gap-4 text-xs font-body border-b border-border-custom/50 pb-4 text-text-muted">
            {product.metal && product.metal !== 'NONE' && (
              <div>
                <span className="font-semibold text-primary">Metal:</span> {product.metal.replace('_', ' ')}
              </div>
            )}
            {product.finish && product.finish !== 'NONE' && (
              <div>
                <span className="font-semibold text-primary">Finish:</span> {product.finish.replace('_', ' ')}
              </div>
            )}
            {product.weightGrams && (
              <div>
                <span className="font-semibold text-primary">Weight:</span> {product.weightGrams}g
              </div>
            )}
            {product.occasion && (
              <div>
                <span className="font-semibold text-primary">Occasion:</span> {product.occasion}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <div className="flex gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!isAvailable || addingToCart}
                className={`flex-grow py-4 text-xs font-bold uppercase tracking-widest rounded-card shadow transition-all duration-300 ${isAvailable ? 'bg-primary text-surface hover:bg-accent' : 'bg-sold/30 text-sold/80 cursor-not-allowed'}`}
              >
                {product.status === ItemStatus.SOLD 
                  ? 'SOLD OUT' 
                  : product.status === ItemStatus.RESERVED 
                    ? 'RESERVED' 
                    : addingToCart 
                      ? 'Adding...' 
                      : 'Add to Cart'}
              </button>
              
              <button
                onClick={handleBuyNow}
                disabled={!isAvailable || buyingNow}
                className={`flex-grow py-4 text-xs font-bold uppercase tracking-widest rounded-card shadow transition-all duration-300 ${isAvailable ? 'bg-accent text-primary hover:bg-primary hover:text-surface font-semibold' : 'bg-sold/30 text-sold/80 cursor-not-allowed'}`}
              >
                {product.status === ItemStatus.SOLD 
                  ? 'SOLD OUT' 
                  : product.status === ItemStatus.RESERVED 
                    ? 'RESERVED' 
                    : buyingNow 
                      ? 'Processing...' 
                      : 'Buy Now'}
              </button>

              {!isSold && (
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  className="px-5 py-4 rounded-card border border-border-custom bg-surface hover:bg-surface-2 transition-colors flex items-center justify-center text-text-muted hover:text-error-custom shadow"
                  title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                >
                  <svg 
                    className={`h-5 w-5 transition-colors duration-200 ${isWishlisted ? 'text-error-custom fill-current' : ''}`} 
                    fill={isWishlisted ? 'currentColor' : 'none'} 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              )}
            </div>
            
            {isAvailable && (
              <p className="text-[10px] text-accent text-center font-bold tracking-wide animate-pulse uppercase">
                ⚡ Only 1 left — each jewellery piece is unique and irreplaceable!
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="font-semibold">Share:</span>
            {whatsappNumber && (
              <button onClick={handleShareWhatsApp} className="hover:text-[#25D366] transition-colors flex items-center gap-1 font-semibold">
                WhatsApp
              </button>
            )}
            <button onClick={handleShareCopy} className="hover:text-accent transition-colors flex items-center gap-1 font-semibold">
              Copy Link
            </button>
          </div>

          {/* Detailed description */}
          <div className="space-y-2 border-t border-border-custom/50 pt-6">
            <h3 className="font-display text-lg font-bold tracking-wide uppercase">The Craftsmanship</h3>
            <p className="font-body text-xs leading-relaxed text-text-muted">
              {product.description}
            </p>
          </div>

          {/* Specifications Accordion Table */}
          <div className="border-t border-border-custom/50 pt-4">
            <details className="group" open>
              <summary className="flex justify-between items-center font-display text-sm font-bold tracking-wide uppercase cursor-pointer list-none select-none">
                <span>Details & Specifications</span>
                <span className="transition-transform group-open:rotate-180">↓</span>
              </summary>
              <div className="mt-4 overflow-hidden border border-border-custom rounded-card text-xs font-body">
                <table className="min-w-full divide-y divide-border-custom">
                  <tbody className="divide-y divide-border-custom bg-surface-2/45">
                    {product.category && (
                      <tr className="grid grid-cols-2 px-4 py-2 bg-surface-2/20">
                        <td className="font-semibold text-primary">Category</td>
                        <td className="text-text-muted">{product.category.replace('_', ' ')}</td>
                      </tr>
                    )}
                    {product.metal && (
                      <tr className="grid grid-cols-2 px-4 py-2">
                        <td className="font-semibold text-primary">Base Metal</td>
                        <td className="text-text-muted">{product.metal.replace('_', ' ')}</td>
                      </tr>
                    )}
                    {product.finish && (
                      <tr className="grid grid-cols-2 px-4 py-2 bg-surface-2/20">
                        <td className="font-semibold text-primary">Polish/Finish</td>
                        <td className="text-text-muted">{product.finish.replace('_', ' ')}</td>
                      </tr>
                    )}
                    {product.weightGrams && (
                      <tr className="grid grid-cols-2 px-4 py-2">
                        <td className="font-semibold text-primary">Weight</td>
                        <td className="text-text-muted">{product.weightGrams} grams</td>
                      </tr>
                    )}
                    {product.dimensions && (
                      <tr className="grid grid-cols-2 px-4 py-2 bg-surface-2/20">
                        <td className="font-semibold text-primary">Dimensions</td>
                        <td className="text-text-muted">{product.dimensions}</td>
                      </tr>
                    )}
                    {product.stoneType && (
                      <tr className="grid grid-cols-2 px-4 py-2">
                        <td className="font-semibold text-primary">Stones / Details</td>
                        <td className="text-text-muted">{product.stoneType}</td>
                      </tr>
                    )}
                    {product.occasion && (
                      <tr className="grid grid-cols-2 px-4 py-2 bg-surface-2/20">
                        <td className="font-semibold text-primary">Best Occasion</td>
                        <td className="text-text-muted">{product.occasion}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {/* Policies Accordions */}
          <div className="border-t border-border-custom/50 pt-4 space-y-4">
            <details className="group">
              <summary className="flex justify-between items-center font-display text-sm font-bold tracking-wide uppercase cursor-pointer list-none select-none">
                <span>Shipping & Shipping Aggregates</span>
                <span className="transition-transform group-open:rotate-180">↓</span>
              </summary>
              <p className="mt-2 text-xs text-text-muted font-body leading-relaxed">
                We offer free insured delivery across India for all purchases above ₹999. Deliveries are securely aggregatively shipped using premium services like Delhivery and BlueDart. Standard transit times are 2-3 business days.
              </p>
            </details>

            <details className="group">
              <summary className="flex justify-between items-center font-display text-sm font-bold tracking-wide uppercase cursor-pointer list-none select-none">
                <span>Care Guide & Polish Longevity</span>
                <span className="transition-transform group-open:rotate-180">↓</span>
              </summary>
              <p className="mt-2 text-xs text-text-muted font-body leading-relaxed">
                To maximize your 1-gram gold and antique polish lifetime, store jewellery inside airtight plastic pouches away from moisture, spray, and perfume. Clean after use with a dry cotton cloth.
              </p>
            </details>
          </div>

        </div>

      </div>
    </div>
  );
}
