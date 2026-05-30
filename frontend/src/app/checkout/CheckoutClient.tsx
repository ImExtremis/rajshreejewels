'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { trackEvent } from '../../lib/analytics';
import { useSession } from 'next-auth/react';
import { apiClient } from '../../lib/api';

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface Product {
  id: string;
  slug: string;
  displayName: string;
  shortDesc: string;
  priceINR: number;
  primaryImageUrl: string;
}

interface PublicSettings {
  storeName: string;
  storeTagline: string;
  shippingFreeAboveINR: number;
  shippingFlatRateINR: number;
  codEnabled: boolean;
}

const addressSchema = z.object({
  label: z.string().trim().min(2, 'Label must be at least 2 characters'),
  name: z.string().trim().min(2, 'Recipient name must be at least 2 characters'),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Phone must be a valid 10-digit number'),
  line1: z.string().trim().min(5, 'Address must be at least 5 characters'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().regex(/^[0-9]{6}$/, 'Pincode must be a valid 6-digit postal code'),
  isDefault: z.boolean(),
});

type AddressFields = z.infer<typeof addressSchema>;

interface CheckoutClientProps {
  sessionUser: {
    id: string;
    name: string;
    email: string;
    phone: string;
    accessToken: string;
  };
}

type CheckoutStep = 'address' | 'review' | 'payment';

export default function CheckoutClient({ sessionUser }: CheckoutClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const token = (session as any)?.accessToken || sessionUser.accessToken;
  const targetProductId = searchParams.get('productId');

  // Steps state
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');

  // Data state
  const [product, setProduct] = useState<Product | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Email verification check states
  const [isVerified, setIsVerified] = useState<boolean>(true);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const handleCheckoutVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setOtpError('Please enter a 6-digit verification code.');
      return;
    }
    setVerifyingOtp(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: sessionUser.id, otp: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      setIsVerified(true);
      setShowOtpModal(false);
      triggerAlert('🎉 Email verified successfully! Resuming your checkout...');
      
      // Resume checkout placement immediately
      setTimeout(() => {
        handlePlaceOrder();
      }, 500);
    } catch (err: any) {
      setOtpError(err.message || 'Invalid code entered. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCheckoutResendOtp = async () => {
    setResendingOtp(true);
    setOtpError(null);
    try {
      const res = await fetch('/api/v1/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: sessionUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend code');
      triggerAlert('✨ A new verification code has been sent!');
      if (data.debugOtp) {
        console.log(`✨ Debug OTP sent during checkout: ${data.debugOtp}`);
      }
    } catch (err: any) {
      setOtpError(err.message || 'Failed to resend code.');
    } finally {
      setResendingOtp(false);
    }
  };

  // Address form expansion
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Order state
  const [buyerNote, setBuyerNote] = useState('');
  const [isCod, setIsCod] = useState(false);
  const [orderInitiatedData, setOrderInitiatedData] = useState<any>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // Reservation countdown timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // in seconds (900s = 15m)
  const [timerExpired, setTimerExpired] = useState(false);

  // Alert/Toast states
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string;
    code: string;
    type: string;
    value: number;
  } | null>(null);

  // Address hook form
  const { register: regAddress, handleSubmit: handleAddressSave, formState: { errors: errorsAddress }, reset: resetAddress } = useForm<AddressFields>({
    resolver: zodResolver(addressSchema),
    defaultValues: { label: 'Home', isDefault: false },
  });

  const triggerAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  // Fetch initial checkout data (settings, addresses, product)
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch public settings
        const settingsRes = await fetch('/api/v1/settings/public');
        if (!settingsRes.ok) throw new Error('Failed to load store configurations');
        const settingsData = await settingsRes.json();
        setSettings(settingsData);

        // 2. Fetch user details (including verified status and shipping addresses)
        const userRes = await apiClient('/users/me', {}, token);
        if (userRes.ok) {
          const userData = await userRes.json();
          setIsVerified(userData.isVerified);
          const list = userData.addresses || [];
          setAddresses(list);
          const defaultAddr = list.find((a: Address) => a.isDefault);
          if (defaultAddr) setSelectedAddressId(defaultAddr.id);
          else if (list.length > 0) setSelectedAddressId(list[0].id);
        }

        // 3. Fetch product (either via targetProductId query, or fall back to cart contents)
        let checkoutProduct: Product | null = null;
        if (targetProductId) {
          const productRes = await fetch(`/api/v1/products/id/${targetProductId}`);
          if (productRes.ok) {
            checkoutProduct = await productRes.json();
          }
        }

        // 4. Fetch Cart to get active coupon details and fallback product
        const cartRes = await apiClient('/cart', {}, token);
        if (cartRes.ok) {
          const cartData = await cartRes.json();
          if (cartData.coupon) {
            setAppliedCoupon(cartData.coupon);
          }
          if (!checkoutProduct) {
            const firstItem = cartData.items?.find((item: any) => !item.cartError);
            if (firstItem && firstItem.product) {
              checkoutProduct = firstItem.product;
            }
          }
        }

        if (!checkoutProduct) {
          setError('No eligible item found for checkout. Please add a product to your cart or select "Buy Now" on a product detail page.');
        } else {
          setProduct(checkoutProduct);
        }
      } catch (err: any) {
        console.error('❌ Checkout initialization failed:', err);
        setError(err.message || 'An error occurred during checkout setup.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [targetProductId, sessionUser.accessToken]);

  // Reservation countdown timer effect
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      setTimerExpired(true);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft]);

  // Handle address form submission
  const onAddressSubmit = async (data: AddressFields) => {
    try {
      setSavingAddress(true);
      const res = await apiClient('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify(data),
      }, token);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to add address');
      }

      const freshAddrsRes = await apiClient('/users/me/addresses', {}, token);
      if (freshAddrsRes.ok) {
        const freshData = await freshAddrsRes.json();
        const list = freshData.addresses || [];
        setAddresses(list);
        
        // Auto-select the newly added address
        const latest = list[list.length - 1];
        if (latest) setSelectedAddressId(latest.id);
      }

      triggerAlert('✨ New address added successfully!');
      resetAddress();
      setShowAddressForm(false);
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to save address', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  // Initiate order (transitions to payment stage)
  const handlePlaceOrder = async () => {
    if (!product || !selectedAddressId) return;

    // INTERCEPT IF NOT VERIFIED
    if (!isVerified) {
      setShowOtpModal(true);
      
      // Auto-trigger OTP resend in background
      try {
        setResendingOtp(true);
        const res = await fetch('/api/v1/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: sessionUser.id }),
        });
        const data = await res.json();
        if (data.debugOtp) {
          console.log(`✨ Debug OTP sent during checkout: ${data.debugOtp}`);
        }
      } catch (err) {
        console.error('Failed to trigger background OTP resend:', err);
      } finally {
        setResendingOtp(false);
      }
      return;
    }

    try {
      setPlacingOrder(true);
      const res = await apiClient('/orders/initiate', {
        method: 'POST',
        body: JSON.stringify({
          productId: product.id,
          addressId: selectedAddressId,
          paymentMethod: isCod ? 'COD' : 'UPI',
          buyerNote: buyerNote.trim() || undefined
        })
      }, token);

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'ITEM_JUST_RESERVED') {
          throw new Error('Someone else just started checking out this unique creation. Please explore other available products.');
        }
        throw new Error(data.message || 'Could not initiate your order.');
      }

      // Track GA4 begin_checkout event
      trackEvent('begin_checkout', {
        value: pricing.total,
        currency: 'INR',
        items: [
          {
            item_id: product.id,
            item_name: product.displayName,
            price: product.priceINR,
            quantity: 1
          }
        ]
      });

      // COD Flow: Backend handles directly
      if (isCod) {
        // Track GA4 purchase event for COD
        trackEvent('purchase', {
          transaction_id: data.orderId,
          value: pricing.total,
          currency: 'INR',
          shipping: pricing.shipping,
          items: [
            {
              item_id: product.id,
              item_name: product.displayName,
              price: product.priceINR,
              quantity: 1
            }
          ]
        });

        // Clear user's local cart
        await apiClient('/cart/clear', {
          method: 'POST',
        }, token);
        
        router.push(`/account/orders/${data.orderId}?success=true`);
        return;
      }

      // Razorpay Flow
      setOrderInitiatedData(data);
      setTimeLeft(900); // Start 15-minute countdown (900 seconds)
      setCurrentStep('payment');

      // Trigger the Razorpay modal immediately
      openRazorpayPayment(data);
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to place order. Please try again.', 'error');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Open Razorpay Payment modal SDK overlay
  const openRazorpayPayment = (data: any) => {
    // Dynamic script insertion
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const rzp = new (window as any).Razorpay({
        key: data.razorpayKeyId,
        amount: data.amountPaise,
        currency: data.currency,
        order_id: data.razorpayOrderId,
        name: settings?.storeName || 'Rajshree Jewels',
        description: data.productName,
        image: data.productImage,
        prefill: {
          name: data.userName,
          email: data.userEmail,
          contact: data.userPhone,
        },
        theme: { color: '#C9A84C' },
        handler: async (response: any) => {
          try {
            setPlacingOrder(true);
            const confirmRes = await apiClient('/orders/confirm-payment', {
              method: 'POST',
              body: JSON.stringify({
                orderId: data.orderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              })
            }, token);

            const confirmData = await confirmRes.json();
            if (!confirmRes.ok) {
              throw new Error(confirmData.error || 'Payment signature confirmation failed.');
            }

            // Track GA4 purchase event for Razorpay payment
            if (product) {
              trackEvent('purchase', {
                transaction_id: confirmData.orderId,
                value: pricing.total,
                currency: 'INR',
                shipping: pricing.shipping,
                items: [
                  {
                    item_id: product.id,
                    item_name: product.displayName,
                    price: product.priceINR,
                    quantity: 1
                  }
                ]
              });
            }

            // Clear local cart
            await apiClient('/cart/clear', {
              method: 'POST',
            }, token);

            router.push(`/account/orders/${confirmData.orderId}?success=true`);
          } catch (err: any) {
            triggerAlert(err.message || 'Signature verification failed. Please contact support.', 'error');
          } finally {
            setPlacingOrder(false);
          }
        },
        modal: {
          ondismiss: () => {
            triggerAlert('Payment window closed. The unique jewellery piece is reserved for you for a few more minutes.', 'error');
          }
        }
      });
      rzp.open();
    };
    script.onerror = () => {
      triggerAlert('Failed to load payment processor script. Please check your network connection.', 'error');
    };
    document.body.appendChild(script);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      setCouponLoading(true);
      setCouponError(null);
      
      const res = await apiClient('/cart/apply-coupon', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode.trim() })
      }, token);
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to apply coupon');
      }
      
      setAppliedCoupon({
        id: data.id || '',
        code: data.code,
        type: data.type,
        value: data.value
      });
      setCouponCode('');
      triggerAlert(`✨ Coupon ${data.code} applied successfully!`);
    } catch (err: any) {
      setCouponError(err.message || 'Invalid coupon code');
      triggerAlert(err.message || 'Invalid coupon code', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    try {
      setCouponLoading(true);
      const res = await apiClient('/cart/remove-coupon', {
        method: 'DELETE',
      }, token);
      if (!res.ok) throw new Error('Failed to remove coupon');
      setAppliedCoupon(null);
      triggerAlert('Coupon removed successfully');
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to remove coupon', 'error');
    } finally {
      setCouponLoading(false);
    }
  };

  // Pricing calculations
  const getPricingSummary = () => {
    if (!product || !settings) return { itemPrice: 0, shipping: 0, discount: 0, total: 0 };
    const itemPrice = product.priceINR;
    const isFree = itemPrice >= settings.shippingFreeAboveINR;
    let shipping = isFree ? 0 : settings.shippingFlatRateINR;
    
    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.type === 'PERCENTAGE') {
        discount = Math.floor((itemPrice * appliedCoupon.value) / 100);
      } else if (appliedCoupon.type === 'FIXED_INR') {
        discount = Math.min(appliedCoupon.value, itemPrice);
      } else if (appliedCoupon.type === 'FREE_SHIPPING') {
        shipping = 0;
      }
    }
    
    return {
      itemPrice,
      shipping,
      discount,
      total: Math.max(0, itemPrice + shipping - discount)
    };
  };

  const pricing = getPricingSummary();

  // Loading & Error States
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        <p className="mt-4 text-text-muted font-body text-sm uppercase tracking-wider">Securing your checkout environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="bg-surface-2/60 border border-border-custom p-8 rounded-lg">
          <svg className="h-12 w-12 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="font-display text-2xl font-semibold mb-2">Checkout Unavailable</h2>
          <p className="text-text-muted font-body text-sm mb-6 leading-relaxed">{error}</p>
          <button onClick={() => router.push('/shop')} className="inline-block bg-primary text-surface font-body text-xs font-bold uppercase tracking-wider py-3 px-8 rounded-md hover:bg-accent transition-colors">
            Return to Gallery
          </button>
        </div>
      </div>
    );
  }

  // Timer Expiration Modal
  if (timerExpired) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-surface border border-border-custom p-8 rounded-lg max-w-md w-full text-center shadow-2xl animate-fade-in">
          <div className="bg-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-error/20">
            <svg className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-primary">Reservation Expired</h3>
          <p className="text-text-muted font-body text-sm my-4 leading-relaxed">
            Your 15-minute checkout holding time has expired. Because our pieces are physically one-of-a-kind, we have released it to allow other customers an opportunity.
          </p>
          <button
            onClick={() => router.push(product ? `/shop/${product.slug}` : '/shop')}
            className="w-full bg-primary text-surface py-3 rounded-md font-body text-xs font-bold uppercase tracking-wider hover:bg-accent transition-colors"
          >
            Check Availability
          </button>
        </div>
      </div>
    );
  }

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Dynamic Toast Alerts */}
      {alertMsg && (
        <div className={`fixed top-6 right-6 z-50 flex items-center p-4 rounded-lg shadow-xl border animate-slide-in ${
          alertMsg.type === 'error' ? 'bg-error/10 border-error/20 text-error' : 'bg-success/10 border-success/20 text-success'
        }`}>
          <span className="font-body text-sm font-semibold">{alertMsg.text}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns - Steps details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="border border-border-custom rounded-lg p-6 bg-surface-2/20 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-semibold uppercase tracking-wide border-b border-border-custom pb-3 mb-6">
              SECURE CHECKOUT
            </h2>
            
            {/* Step Navigation Progress indicator */}
            <div className="flex items-center space-x-4 mb-8">
              <span className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                currentStep === 'address' ? 'bg-accent text-surface border-accent' : 'bg-surface-2 border-border-custom text-text-muted'
              }`}>1. ADDRESS</span>
              <span className="text-border-custom">→</span>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                currentStep === 'review' ? 'bg-accent text-surface border-accent' : 'bg-surface-2 border-border-custom text-text-muted'
              }`}>2. REVIEW</span>
              <span className="text-border-custom">→</span>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
                currentStep === 'payment' ? 'bg-accent text-surface border-accent' : 'bg-surface-2 border-border-custom text-text-muted'
              }`}>3. PAYMENT</span>
            </div>

            {/* STEP 1: Address Selection */}
            {currentStep === 'address' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-display text-lg font-bold text-primary tracking-wide">SHIPPING ADDRESS</h3>
                
                {addresses.length === 0 ? (
                  <p className="text-text-muted font-body text-sm">You do not have any saved addresses. Please add a shipping address below.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {addresses.map(addr => (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all duration-300 relative ${
                          selectedAddressId === addr.id
                            ? 'border-accent bg-accent/5 shadow-md'
                            : 'border-border-custom hover:border-accent bg-surface hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">
                            {addr.label}
                          </span>
                          {selectedAddressId === addr.id && (
                            <span className="text-accent">
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <h4 className="font-body text-sm font-bold text-primary mb-1">{addr.name}</h4>
                        <p className="font-body text-xs text-text-muted leading-relaxed mb-2">
                          {addr.line1}{addr.line2 ? ', ' + addr.line2 : ''}, {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                        <p className="font-body text-xs font-semibold text-text-muted">Phone: {addr.phone}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Expandable inline address form */}
                <div className="border border-border-custom rounded-lg bg-surface">
                  <button
                    onClick={() => {
                      resetAddress();
                      setShowAddressForm(!showAddressForm);
                    }}
                    className="w-full flex items-center justify-between p-4 font-body text-sm font-semibold uppercase tracking-wider text-primary hover:text-accent transition-colors"
                  >
                    <span>{showAddressForm ? 'Close Address Form' : '+ Add New Address'}</span>
                    <span className="text-text-muted">{showAddressForm ? '−' : '＋'}</span>
                  </button>
                  
                  {showAddressForm && (
                    <div className="p-6 border-t border-border-custom bg-surface-2/10">
                      <form onSubmit={handleAddressSave(onAddressSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Address Label</label>
                          <input
                            type="text"
                            placeholder="e.g. Home, Office"
                            {...regAddress('label')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.label && <span className="text-xs text-error mt-1">{errorsAddress.label.message}</span>}
                        </div>

                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Recipient Name</label>
                          <input
                            type="text"
                            placeholder="Full Name"
                            {...regAddress('name')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.name && <span className="text-xs text-error mt-1">{errorsAddress.name.message}</span>}
                        </div>

                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Phone Number</label>
                          <input
                            type="text"
                            placeholder="10-digit number"
                            {...regAddress('phone')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.phone && <span className="text-xs text-error mt-1">{errorsAddress.phone.message}</span>}
                        </div>

                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Pincode</label>
                          <input
                            type="text"
                            placeholder="6-digit PIN"
                            {...regAddress('pincode')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.pincode && <span className="text-xs text-error mt-1">{errorsAddress.pincode.message}</span>}
                        </div>

                        <div className="flex flex-col sm:col-span-2">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Address Line 1</label>
                          <input
                            type="text"
                            placeholder="Flat/House No., Building Name, Street"
                            {...regAddress('line1')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.line1 && <span className="text-xs text-error mt-1">{errorsAddress.line1.message}</span>}
                        </div>

                        <div className="flex flex-col sm:col-span-2">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Address Line 2 (Optional)</label>
                          <input
                            type="text"
                            placeholder="Landmark, Area, Colony"
                            {...regAddress('line2')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.line2 && <span className="text-xs text-error mt-1">{errorsAddress.line2.message}</span>}
                        </div>

                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">City</label>
                          <input
                            type="text"
                            placeholder="City/Town"
                            {...regAddress('city')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.city && <span className="text-xs text-error mt-1">{errorsAddress.city.message}</span>}
                        </div>

                        <div className="flex flex-col">
                          <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">State</label>
                          <input
                            type="text"
                            placeholder="State"
                            {...regAddress('state')}
                            className="bg-surface border border-border-custom rounded py-2 px-3 text-sm focus:outline-none focus:border-accent"
                          />
                          {errorsAddress.state && <span className="text-xs text-error mt-1">{errorsAddress.state.message}</span>}
                        </div>

                        <div className="sm:col-span-2 flex items-center space-x-2 py-2">
                          <input
                            type="checkbox"
                            id="isDefault"
                            {...regAddress('isDefault')}
                            className="rounded text-accent focus:ring-accent h-4 w-4"
                          />
                          <label htmlFor="isDefault" className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer">
                            Set as default shipping address
                          </label>
                        </div>

                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            type="submit"
                            disabled={savingAddress}
                            className="bg-accent text-surface hover:bg-accent-light px-6 py-2.5 rounded font-body text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                          >
                            {savingAddress ? 'Saving Address...' : 'Save Address'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    disabled={!selectedAddressId}
                    onClick={() => setCurrentStep('review')}
                    className="bg-primary text-surface hover:bg-accent px-8 py-3 rounded-md font-body text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                  >
                    Continue to Review →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Order Review */}
            {currentStep === 'review' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-display text-lg font-bold text-primary tracking-wide">ORDER REVIEW</h3>
                  <button
                    onClick={() => setCurrentStep('address')}
                    className="text-accent hover:text-accent-light font-body text-xs font-bold uppercase tracking-wider"
                  >
                    ← Edit Address
                  </button>
                </div>

                {/* Product Detail Card */}
                {product && (
                  <div className="flex items-center space-x-4 border border-border-custom rounded-lg p-4 bg-surface">
                    <img
                      src={product.primaryImageUrl}
                      alt={product.displayName}
                      className="w-24 h-24 object-cover rounded border border-border-custom"
                    />
                    <div>
                      <h4 className="font-display text-base font-bold text-primary leading-snug">{product.displayName}</h4>
                      <p className="font-body text-xs text-text-muted mt-1 leading-relaxed line-clamp-2">{product.shortDesc}</p>
                      <span className="font-mono text-sm font-bold text-accent mt-2 inline-block">
                        Rs. {product.priceINR.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Buyer Note Section */}
                <div className="flex flex-col">
                  <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                    Add instructions or notes for the seller (Optional)
                  </label>
                  <textarea
                    maxLength={500}
                    placeholder="Enter notes (maximum 500 characters)"
                    value={buyerNote}
                    onChange={(e) => setBuyerNote(e.target.value)}
                    className="bg-surface border border-border-custom rounded-lg p-3 text-sm focus:outline-none focus:border-accent w-full h-24"
                  />
                  <div className="text-right text-[10px] text-text-muted mt-1">{buyerNote.length}/500 chars</div>
                </div>

                {/* Cash on Delivery Toggle */}
                {settings?.codEnabled && (
                  <div className="flex items-center justify-between border border-border-custom rounded-lg p-4 bg-surface-2/30">
                    <div>
                      <h4 className="font-body text-sm font-bold text-primary">CASH ON DELIVERY (COD)</h4>
                      <p className="font-body text-xs text-text-muted mt-0.5">Pay in cash on delivery to your courier partner</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCod}
                        onChange={() => setIsCod(!isCod)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface border border-border-custom rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-text-muted after:border-border-custom after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent peer-checked:after:bg-surface"></div>
                    </label>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    disabled={placingOrder}
                    onClick={handlePlaceOrder}
                    className="bg-primary text-surface hover:bg-accent px-10 py-3.5 rounded-md font-body text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {placingOrder ? 'Processing Order...' : 'Place Order →'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Payment */}
            {currentStep === 'payment' && (
              <div className="space-y-6 text-center py-10 animate-fade-in">
                {/* 15-Minute Countdown Timer Widget */}
                {timeLeft !== null && (
                  <div className="mb-8">
                    <span className="font-body text-xs font-semibold text-text-muted uppercase tracking-widest block mb-2">
                      Holding your unique piece
                    </span>
                    <div className="inline-flex items-center space-x-2 bg-accent/10 border border-accent/20 px-6 py-3 rounded-full text-accent font-mono text-2xl font-bold">
                      <svg className="h-6 w-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Item reserved for {formatTime(timeLeft)}</span>
                    </div>
                  </div>
                )}

                <div className="max-w-md mx-auto bg-surface border border-border-custom rounded-lg p-6 shadow-sm">
                  <h3 className="font-display text-xl font-bold text-primary uppercase tracking-wide mb-2">
                    Awaiting Payment Details
                  </h3>
                  <p className="text-text-muted font-body text-sm mb-6 leading-relaxed">
                    A secure checkout overlay has been prompted. If you closed the window prematurely, please trigger the payment again below.
                  </p>
                  
                  <button
                    disabled={placingOrder}
                    onClick={() => orderInitiatedData && openRazorpayPayment(orderInitiatedData)}
                    className="w-full bg-accent text-surface hover:bg-accent-light py-3 rounded-md font-body text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Open Payment Window
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary sidebar details */}
        <div className="lg:col-span-1">
          <div className="sticky top-28 border border-border-custom rounded-lg p-6 bg-surface shadow-sm">
            <h3 className="font-display text-lg font-bold text-primary uppercase tracking-wider border-b border-border-custom pb-3 mb-6">
              ORDER SUMMARY
            </h3>
            
            {product && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-body">
                  <span className="text-text-muted">Unique Creation:</span>
                  <span className="text-primary font-semibold text-right max-w-[150px] truncate">{product.displayName}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-body">
                  <span className="text-text-muted">Price:</span>
                  <span className="text-primary font-mono font-bold">Rs. {pricing.itemPrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-body">
                  <span className="text-text-muted">Shipping:</span>
                  <span className="text-primary font-semibold">
                    {pricing.shipping === 0 ? (
                      <span className="text-success uppercase font-semibold">Free</span>
                    ) : (
                      <span className="font-mono font-bold">Rs. {pricing.shipping.toLocaleString('en-IN')}</span>
                    )}
                  </span>
                </div>
                
                {/* Free Shipping Urgency callout */}
                {settings && pricing.shipping > 0 && (
                  <div className="bg-accent/5 border border-accent/15 p-3 rounded text-center">
                    <span className="font-body text-[11px] font-semibold text-accent leading-relaxed block">
                      ✨ Shop for Rs. {(settings.shippingFreeAboveINR - pricing.itemPrice).toLocaleString('en-IN')} more to unlock FREE shipping!
                    </span>
                  </div>
                )}

                {pricing.discount > 0 && (
                  <div className="flex justify-between items-center text-sm font-body text-success font-semibold">
                    <span>Coupon Discount ({appliedCoupon?.code}):</span>
                    <span className="font-mono">- Rs. {pricing.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                
                {/* Coupon Application Box */}
                <div className="border-t border-border-custom pt-4">
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between bg-success/5 border border-success/15 p-3 rounded">
                      <div className="flex flex-col">
                        <span className="font-body text-xs font-bold text-success uppercase tracking-wider">
                          🏷️ {appliedCoupon.code} Applied
                        </span>
                        <span className="font-body text-[10px] text-text-muted mt-0.5">
                          {appliedCoupon.type === 'PERCENTAGE' 
                            ? `${appliedCoupon.value}% off item price`
                            : appliedCoupon.type === 'FIXED_INR'
                              ? `Rs. ${appliedCoupon.value} off item price`
                              : 'Free shipping on this order'}
                        </span>
                      </div>
                      <button
                        onClick={handleRemoveCoupon}
                        disabled={couponLoading}
                        className="text-error hover:text-error-light font-body text-xs font-bold uppercase tracking-wider ml-4 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="font-body text-xs font-semibold text-text-muted uppercase tracking-wider block">
                        Apply Coupon Code
                      </label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          placeholder="e.g. LAUNCH20"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="bg-surface border border-border-custom rounded px-3 py-1.5 text-xs focus:outline-none focus:border-accent w-full font-mono uppercase tracking-wider text-primary"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponCode.trim()}
                          className="bg-accent text-surface hover:bg-accent-light px-4 py-1.5 rounded font-body text-xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
                        >
                          Apply
                        </button>
                      </div>
                      {couponError && (
                        <p className="text-error font-body text-[11px] font-semibold mt-1">{couponError}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-border-custom pt-4 flex justify-between items-center">
                  <span className="font-display text-base font-bold text-primary">GRAND TOTAL:</span>
                  <span className="font-mono text-lg font-bold text-accent">
                    Rs. {pricing.total.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 bg-primary/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-2 border border-border-custom max-w-md w-full p-8 rounded-card shadow-card space-y-6 animate-scale-up font-body">
            <div className="text-center space-y-2">
              <h3 className="font-display text-2xl font-bold tracking-wide text-primary">Verify Your Email</h3>
              <p className="text-xs text-text-muted">A 6-digit OTP verification code has been sent to confirm this order.</p>
            </div>

            {otpError && (
              <div className="bg-[#FFF5F5] border border-[#D4A0A0] text-[#8B1A1A] text-2xs font-semibold uppercase tracking-wider text-center p-3 rounded-card">
                {otpError}
              </div>
            )}

            <form onSubmit={handleCheckoutVerifyOtp} className="space-y-5 text-center">
              <div className="space-y-2 text-xs">
                <label className="font-semibold text-primary uppercase tracking-wide block">Verification OTP Code</label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="bg-surface border border-border-custom rounded-card py-3 px-6 focus:outline-none focus:border-accent text-center text-xl font-bold font-mono tracking-widest w-48 mx-auto block"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="w-1/2 border border-border-custom hover:border-accent py-3 rounded-card text-2xs font-bold uppercase tracking-widest transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp || otpCode.length !== 6}
                  className="w-1/2 luxury-btn py-3 rounded-card text-2xs font-bold uppercase tracking-widest transition-all disabled:opacity-55"
                >
                  {verifyingOtp ? 'Confirming...' : 'Verify & Pay'}
                </button>
              </div>
            </form>

            <div className="text-center text-xs text-text-muted mt-2 border-t border-border-custom/55 pt-4">
              Didn't receive the email?{' '}
              <button
                type="button"
                onClick={handleCheckoutResendOtp}
                disabled={resendingOtp}
                className="text-[#8B1A1A] hover:underline font-bold uppercase tracking-wider text-2xs"
              >
                {resendingOtp ? 'Resending...' : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
