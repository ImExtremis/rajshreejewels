'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface ProductImage {
  urlThumb: string;
}

interface Product {
  id: string;
  slug: string;
  displayName: string;
  shortDesc: string;
  priceINR: number;
  primaryImageUrl: string;
  images: ProductImage[];
}

interface Address {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
}

interface Order {
  id: string;
  orderNumber: string;
  priceINR: number;
  shippingINR: number;
  totalINR: number;
  status: string;
  paymentMethod: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  paidAt: string | null;
  courierName: string | null;
  awbCode: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  buyerNote: string | null;
  createdAt: string;
  product: Product;
  address: Address;
}

interface OrderDetailClientProps {
  orderId: string;
  sessionUser: {
    id: string;
    name: string;
    email: string;
    accessToken: string;
  };
}

export default function OrderDetailClient({ orderId, sessionUser }: OrderDetailClientProps) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Invoice state
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [payingOrder, setPayingOrder] = useState(false);

  // Success alert
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Messaging state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  const triggerAlert = (text: string, type: 'success' | 'error' = 'success') => {
    setAlertMsg({ text, type });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (!res.ok) throw new Error('Order details could not be found.');
      const data = await res.json();
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Error occurred while fetching order details.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/v1/messages/order/${orderId}`, {
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {}
  };

  const markMessagesRead = async () => {
    try {
      await fetch(`/api/v1/messages/order/${orderId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${session?.accessToken}` }
      });
    } catch (err) {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      setMessageError(null);
      const res = await fetch(`/api/v1/messages/order/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({ body: newMessage.trim() })
      });

      if (!res.ok) throw new Error('Failed to deliver message.');

      const freshMsg = await res.json();
      setMessages(prev => [...prev, freshMsg]);
      setNewMessage('');
    } catch (err: any) {
      setMessageError(err.message || 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    fetchOrder();
    fetchMessages();
    
    // Poll messages every 30 seconds
    const interval = setInterval(() => {
      fetchMessages();
    }, 30000);

    return () => clearInterval(interval);
  }, [status, session?.accessToken, orderId]);

  useEffect(() => {
    if (messages.some(m => m.fromType === 'ADMIN' && !m.readAt)) {
      markMessagesRead();
    }
  }, [messages]);

  // Invoice polling script exactly as required by Step 6 spec
  const handleDownloadInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    try {
      let attempts = 0;
      while (attempts < 10) {
        const res = await fetch(`/api/v1/orders/${orderId}/invoice`, {
          headers: { Authorization: `Bearer ${session?.accessToken}` }
        });
        if (res.status === 200) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `invoice-${order.orderNumber}.pdf`;
          a.click();
          triggerAlert('✨ Invoice PDF downloaded successfully!');
          setInvoiceLoading(false);
          return;
        }
        if (res.status === 202) {
          await new Promise(r => setTimeout(r, 2000)); // wait 2s, retry
          attempts++;
        } else break;
      }
      triggerAlert('Invoice not ready yet. Try again in a moment.', 'error');
    } catch (err) {
      triggerAlert('Failed to load invoice.', 'error');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Complete Payment (resumable checkout)
  const handleCompletePayment = () => {
    if (!order) return;
    setPayingOrder(true);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const rzp = new (window as any).Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_xxxx', // Fallback or dynamic
        amount: order.totalINR * 100, // Razorpay takes paise
        currency: 'INR',
        order_id: order.razorpayOrderId,
        name: 'Rajshree Jewels',
        description: order.product.displayName,
        image: order.product.primaryImageUrl,
        prefill: {
          name: sessionUser.name,
          email: sessionUser.email,
          contact: order.address.phone,
        },
        theme: { color: '#C9A84C' },
        handler: async (response: any) => {
          try {
            const confirmRes = await fetch('/api/v1/orders/confirm-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session?.accessToken}`
              },
              body: JSON.stringify({
                orderId: order.id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
              })
            });

            if (!confirmRes.ok) throw new Error('Payment signature verification failed.');
            
            triggerAlert('🎉 Payment confirmed! Your order is being packed.');
            fetchOrder();
          } catch (err: any) {
            triggerAlert(err.message || 'Signature verification failed', 'error');
          } finally {
            setPayingOrder(false);
          }
        },
        modal: {
          ondismiss: () => {
            triggerAlert('Payment overlay closed.', 'error');
            setPayingOrder(false);
          }
        }
      });
      rzp.open();
    };
    script.onerror = () => {
      triggerAlert('Failed to load Razorpay payment window.', 'error');
      setPayingOrder(false);
    };
    document.body.appendChild(script);
  };

  // Horizontal Stepper Progress logic
  const getStepProgress = (status: string) => {
    const steps = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const statusMap: Record<string, number> = {
      PENDING_PAYMENT: 0,
      PAYMENT_FAILED: 0,
      CONFIRMED: 1,
      PROCESSING: 2,
      SHIPPED: 3,
      DELIVERED: 4,
      CANCELLED: -1,
      REFUNDED: -1
    };

    const currentIdx = statusMap[status] ?? 0;
    return currentIdx;
  };

  const stepsLabel = ['Order Placed', 'Payment Confirmed', 'Processing', 'Shipped', 'Delivered'];
  const progressIdx = order ? getStepProgress(order.status) : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
        <p className="mt-4 text-text-muted font-body text-sm uppercase tracking-wider">Synchronizing order tracking ledger...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="bg-surface-2 border border-border-custom p-8 rounded-card">
          <svg className="h-12 w-12 text-error mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="font-display text-2xl font-bold uppercase tracking-wider">Order Unresolved</h2>
          <p className="text-text-muted font-body text-xs mt-2 leading-relaxed">{error || 'No active order matching criteria'}</p>
          <Link href="/account" className="luxury-btn inline-block py-2.5 px-6 rounded-card text-2xs uppercase tracking-widest font-bold mt-6">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-body space-y-8 relative">
      {/* Alert toast */}
      {alertMsg && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 border py-3 px-6 rounded-card shadow-2xl text-2xs font-semibold uppercase tracking-wider ${
          alertMsg.type === 'success' ? 'bg-[#2D7A3A]/10 border-[#2D7A3A] text-[#2D7A3A]' : 'bg-error-custom/10 border-error-custom text-error-custom'
        }`}>
          {alertMsg.text}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-custom pb-6">
        <div>
          <span className="font-mono text-xs text-accent font-bold uppercase">Order History Ledger</span>
          <h1 className="font-display text-3xl font-bold tracking-wide mt-1">Order Details #{order.orderNumber}</h1>
          <p className="text-3xs text-text-muted mt-1 uppercase font-semibold">
            Placed on: {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
        <Link href="/account" className="border border-border-custom hover:border-accent hover:text-accent font-semibold px-4 py-2 rounded-card text-[10px] uppercase tracking-wider">
          ← Dashboard
        </Link>
      </div>

      {/* Horizontal Stepper Progress visualizer */}
      {progressIdx >= 0 ? (
        <div className="bg-surface-2 border border-border-custom p-6 rounded-card shadow-sm space-y-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Logistics Tracking</h3>
          
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 md:gap-0 relative">
            {stepsLabel.map((label, idx) => {
              const active = idx <= progressIdx;
              const current = idx === progressIdx;

              return (
                <div key={label} className="flex flex-col items-center flex-1 relative w-full md:w-auto">
                  {/* Line connection (horizontal) */}
                  {idx > 0 && (
                    <div className={`hidden md:block absolute left-[-50%] right-[50%] top-3.5 h-[2px] z-0 ${
                      idx <= progressIdx ? 'bg-accent' : 'bg-border-custom'
                    }`}></div>
                  )}

                  {/* Step Dot */}
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs z-10 transition-all ${
                    current ? 'bg-accent text-surface ring-4 ring-accent/20 scale-110' :
                    active ? 'bg-accent text-surface' : 'bg-surface border border-border-custom text-text-muted'
                  }`}>
                    {active ? '✓' : idx + 1}
                  </div>

                  <span className={`text-[10px] font-bold uppercase tracking-wider mt-3 text-center ${
                    current ? 'text-accent' : active ? 'text-primary' : 'text-text-muted'
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-surface-2 border border-border-custom p-6 rounded-card text-center space-y-2">
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-error-custom">Order Cancelled</h3>
          <p className="text-xs text-text-muted">This order was cancelled {order.status === 'REFUNDED' && 'and refunded in full'}.</p>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Side: Order item details */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Purchased Item details card */}
          <div className="bg-surface-2 border border-border-custom p-6 rounded-card space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-custom/50 pb-2">
              Purchased Piece
            </h3>
            <div className="flex gap-5 items-center">
              <img
                src={order.product.primaryImageUrl}
                alt={order.product.displayName}
                className="w-20 h-20 object-cover rounded border border-border-custom"
              />
              <div className="space-y-1">
                <h4 className="font-display text-base font-bold text-primary">{order.product.displayName}</h4>
                <p className="text-xs text-text-muted leading-relaxed line-clamp-2">{order.product.shortDesc}</p>
                <div className="font-mono text-xs font-bold text-accent pt-1">
                  Rs. {order.priceINR.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            {order.buyerNote && (
              <div className="mt-3 p-3 bg-surface border border-border-custom rounded-card text-2xs text-text-muted italic">
                <strong>Your Note:</strong> "{order.buyerNote}"
              </div>
            )}
          </div>

          {/* Direct Curation Inquiry Chat */}
          <div className="bg-surface-2 border border-border-custom p-6 rounded-card space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-custom/50 pb-2 flex justify-between items-center">
              <span>💬 Direct Inquiry Chat thread</span>
              <span className="text-[10px] text-accent lowercase">30s live updates</span>
            </h3>

            {/* Scrollable Message Box */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
              {messages.length === 0 ? (
                <p className="text-center text-text-muted font-body text-xs py-8">
                  No messages inside this order thread yet. Type below to inquire with the seller.
                </p>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.fromType === 'CUSTOMER';
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-lg p-3 text-xs font-body leading-relaxed shadow-sm ${
                        isMe 
                          ? 'bg-accent/10 border border-accent/25 text-primary rounded-br-none' 
                          : 'bg-surface border border-border-custom text-text rounded-bl-none'
                      }`}>
                        <p>{msg.body}</p>
                        <div className="flex justify-between items-center gap-4 text-[9px] text-text-muted mt-2 font-mono">
                          <span>{new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          {isMe && (
                            <span>{msg.readAt ? '✓✓ read' : '✓ sent'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Message Reply Box */}
            <form onSubmit={handleSendMessage} className="border-t border-border-custom/50 pt-4 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={1000}
                  placeholder="Type an inquiry message regarding this creation..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="bg-surface border border-border-custom rounded-card py-2 px-3 text-xs focus:outline-none focus:border-accent text-text w-full"
                />
                <button
                  type="submit"
                  disabled={sendingMessage || !newMessage.trim()}
                  className="bg-accent text-surface hover:bg-accent-light px-5 py-2 rounded-card text-2xs font-bold uppercase tracking-wider disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </div>
              {messageError && (
                <p className="text-error-custom text-[10px] font-semibold">{messageError}</p>
              )}
            </form>
          </div>

          {/* Shipping & Delivery details */}
          {progressIdx >= 3 && order.awbCode && (
            <div className="bg-surface-2 border border-border-custom p-6 rounded-card space-y-4 shadow-sm animate-fade-in">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-custom/50 pb-2">
                Shipping Tracking info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-body leading-relaxed">
                <div>
                  <p className="text-text-muted uppercase text-3xs font-semibold">Courier Partner</p>
                  <p className="text-primary font-bold text-sm mt-0.5">{order.courierName || 'Shiprocket Partner'}</p>
                </div>
                <div>
                  <p className="text-text-muted uppercase text-3xs font-semibold">AWB Tracking Code</p>
                  <p className="text-primary font-bold text-sm mt-0.5">{order.awbCode}</p>
                </div>
              </div>
              {order.trackingUrl && (
                <div className="pt-2">
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="luxury-btn inline-block text-center w-full py-2.5 rounded-card text-2xs uppercase tracking-widest font-bold"
                  >
                    Track Shipment ↗
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Resumable Checkout complete button */}
          {order.status === 'PENDING_PAYMENT' && (
            <div className="bg-surface-2 border border-accent p-6 rounded-card text-center space-y-4 shadow-sm animate-pulse">
              <h3 className="font-display text-lg font-bold uppercase tracking-wider text-accent">Payment Needed</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                The holding reservation is still active. Please click below to open secure checkout and complete your gold jewellery purchase.
              </p>
              <button
                onClick={handleCompletePayment}
                disabled={payingOrder}
                className="luxury-btn py-3 px-8 rounded-card text-xs font-bold uppercase tracking-widest transition-all"
              >
                {payingOrder ? 'Opening Secure Portal...' : 'Complete Payment Now'}
              </button>
            </div>
          )}

        </div>

        {/* Right Side: Billing summary, Invoice downloads, shipping addresses */}
        <div className="md:col-span-1 space-y-6">
          
          {/* Cost Summary Details */}
          <div className="bg-surface-2 border border-border-custom p-6 rounded-card space-y-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-custom/50 pb-2">
              Billing Ledger
            </h3>
            <div className="text-xs space-y-2.5 font-body">
              <div className="flex justify-between">
                <span className="text-text-muted">Piece Price:</span>
                <span className="text-primary font-mono font-bold">Rs. {order.priceINR.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Shipping Cost:</span>
                <span className="text-primary font-semibold">
                  {order.shippingINR === 0 ? <span className="text-success uppercase">Free</span> : <span className="font-mono font-bold">Rs. {order.shippingINR}</span>}
                </span>
              </div>
              <div className="border-t border-border-custom/50 pt-2.5 flex justify-between items-center text-sm">
                <span className="font-bold text-primary">GRAND TOTAL:</span>
                <span className="font-mono font-bold text-accent text-base">₹{order.totalINR.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-3xs text-text-muted uppercase font-semibold pt-1">
                <span>Method:</span>
                <span>{order.paymentMethod}</span>
              </div>
            </div>

            {/* Action buttons (Invoice downloads) */}
            {order.status !== 'PENDING_PAYMENT' && order.status !== 'PAYMENT_FAILED' && (
              <div className="pt-2">
                <button
                  onClick={handleDownloadInvoice}
                  disabled={invoiceLoading}
                  className="w-full text-center border border-border-custom hover:border-accent text-text hover:text-accent font-semibold py-2 rounded-card text-3xs uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {invoiceLoading ? 'Compiling PDF...' : 'Download Invoice PDF'}
                </button>
              </div>
            )}
          </div>

          {/* Delivery Address Details */}
          <div className="bg-surface-2 border border-border-custom p-6 rounded-card space-y-3 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border-custom/50 pb-2">
              Delivery Address
            </h3>
            <div className="text-2xs text-text-muted leading-relaxed font-body">
              <p className="font-bold text-primary text-xs mb-1">{order.address.name}</p>
              <p className="font-mono">{order.address.phone}</p>
              <p className="mt-2">{order.address.line1}</p>
              {order.address.line2 && <p>{order.address.line2}</p>}
              <p>{order.address.city}, {order.address.state} - <span className="font-mono font-semibold">{order.address.pincode}</span></p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
