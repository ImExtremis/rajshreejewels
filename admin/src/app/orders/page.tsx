'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithRetry } from '../utils/api';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface ProductImage {
  urlThumb: string;
}

interface Product {
  id: string;
  displayName: string;
  priceINR: number;
  primaryImageUrl: string;
}

interface User {
  name: string;
  email: string;
  phone: string | null;
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

interface Invoice {
  id: string;
  invoiceNo: string;
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
  adminNote: string | null;
  createdAt: string;
  product: Product;
  user: User;
  address: Address;
  invoice: Invoice | null;
  hasUnreadMessages?: boolean;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Order for slide-in Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Drawer action states
  const [noteText, setNoteText] = useState('');
  const [statusSelect, setStatusSelect] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [saveNoteLoading, setSaveNoteLoading] = useState(false);
  const [updateStatusLoading, setUpdateStatusLoading] = useState(false);

  // Shiprocket Courier Selection States
  const [showCourierModal, setShowCourierModal] = useState(false);
  const [couriersList, setCouriersList] = useState<any[]>([]);
  const [recommendedCourier, setRecommendedCourier] = useState<any>(null);
  const [selectedCourierOverride, setSelectedCourierOverride] = useState<any>(null);
  const [fetchingCouriersLoading, setFetchingCouriersLoading] = useState(false);

  // Manual Shipping Form State
  const [showManualShipping, setShowManualShipping] = useState(false);
  const [manualAwb, setManualAwb] = useState('');
  const [manualCourier, setManualCourier] = useState('');
  const [manualTrackUrl, setManualTrackUrl] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);

  // Messaging state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Global messages
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  };

  // Sync searchQuery from URL on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const searchParam = params.get('search');
      if (searchParam) {
        setSearchQuery(searchParam);
      }
    }
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const filterParam = statusFilter === 'All' ? 'All' : statusFilter.toUpperCase();
      const res = await fetchWithRetry(
        `${BACKEND_URL}/admin/orders?status=${filterParam}&page=${page}&limit=20&search=${searchQuery}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!res.ok) throw new Error('Failed to load orders');

      const data = await res.json();
      setOrders(data.orders);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      // Re-populate selected order details if drawer is open to get fresh data
      if (selectedOrder) {
        const fresh = data.orders.find((o: Order) => o.id === selectedOrder.id);
        if (fresh) {
          setSelectedOrder(fresh);
          setNoteText(fresh.adminNote || '');
          setStatusSelect(fresh.status);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (orderId: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetchWithRetry(`${BACKEND_URL}/messages/order/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {}
  };

  const markMessagesRead = async (orderId: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/messages/order/${orderId}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchOrders();
      }
    } catch (err) {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !newMessage.trim() || sendingMessage) return;

    try {
      setSendingMessage(true);
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/messages/order/${selectedOrder.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ body: newMessage.trim() })
      });

      if (!res.ok) throw new Error('Failed to send message.');

      const data = await res.json();
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    } catch (err: any) {
      showError(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  useEffect(() => {
    if (!selectedOrder) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedOrder.id);

    const interval = setInterval(() => {
      fetchMessages(selectedOrder.id);
    }, 30000); // Poll messages every 30 seconds inside admin panel

    return () => clearInterval(interval);
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (selectedOrder && messages.some(m => m.fromType === 'CUSTOMER' && !m.readAt)) {
      markMessagesRead(selectedOrder.id);
    }
  }, [messages, selectedOrder?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setNoteText(order.adminNote || '');
    setStatusSelect(order.status);
    setShowManualShipping(false);
    setManualAwb('');
    setManualCourier('');
    setManualTrackUrl('');
    fetchMessages(order.id);
  };

  const handleSaveAdminNote = async () => {
    if (!selectedOrder) return;
    setSaveNoteLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: selectedOrder.status, adminNote: noteText })
      });

      if (!res.ok) throw new Error('Failed to save admin note');

      showSuccess('Admin note saved successfully');
      fetchOrders();
    } catch (err: any) {
      showError(err.message || 'Failed to save admin note');
    } finally {
      setSaveNoteLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder) return;
    setUpdateStatusLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: statusSelect })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update order status');

      showSuccess(`Order status updated to ${statusSelect}`);
      fetchOrders();
    } catch (err: any) {
      showError(err.message || 'Failed to update status');
    } finally {
      setUpdateStatusLoading(false);
    }
  };

  const handleFetchCouriers = async () => {
    if (!selectedOrder) return;
    setFetchingCouriersLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/couriers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch couriers');

      if (data.error === 'PINCODE_NOT_SERVICEABLE') {
        showError(`⚠️ Serviceability Error: ${data.message}`);
        setShowManualShipping(true);
        return;
      }

      setCouriersList(data.couriers || []);
      setRecommendedCourier(data.recommended || null);
      setSelectedCourierOverride(data.recommended || null); // Default to recommended
      setShowCourierModal(true);
    } catch (err: any) {
      showError(err.message || 'Failed to check serviceability');
    } finally {
      setFetchingCouriersLoading(false);
    }
  };

  const handleBookCourier = async (courierId?: number) => {
    if (!selectedOrder) return;
    setBookingLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/book-courier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ courierOverride: courierId })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || 'Shiprocket booking failed');
      }

      showSuccess(`Courier shipment booked! AWB: ${data.awbCode}`);
      setShowCourierModal(false);
      fetchOrders();
    } catch (err: any) {
      showError(err.message || 'Courier booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleManualShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!manualAwb.trim() || !manualCourier.trim()) {
      showError('AWB Tracking Code and Courier Name are required.');
      return;
    }
    setManualLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/shipping`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          awbCode: manualAwb,
          courierName: manualCourier,
          trackingUrl: manualTrackUrl || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to update manual shipping');

      showSuccess('Manual tracking details stored successfully');
      setShowManualShipping(false);
      fetchOrders();
    } catch (err: any) {
      showError(err.message || 'Failed to record tracking');
    } finally {
      setManualLoading(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!refundReason || refundReason.trim().length < 5) {
      showError('Reason for Refund is required and must be at least 5 characters.');
      return;
    }
    setRefundLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${selectedOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: refundReason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to issue refund');

      showSuccess(`Refund successfully initiated! Refund ID: ${data.refundId}`);
      setShowRefundModal(false);
      setRefundReason('');
      fetchOrders();
    } catch (err: any) {
      showError(err.message || 'Refund request failed');
    } finally {
      setRefundLoading(false);
    }
  };

  const downloadInvoice = async (orderId: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${orderId}/invoice`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 200) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice-${orderId}.pdf`;
        a.click();
        showSuccess('Invoice PDF downloaded');
      } else if (res.status === 202) {
        showError('Invoice is generating. Try again in a second.');
      } else {
        throw new Error('Invoice file not ready or missing');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to load invoice');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="badge badge-yellow">Confirmed</span>;
      case 'PROCESSING':
        return <span className="badge badge-yellow">Processing</span>;
      case 'SHIPPED':
        return <span className="badge badge-blue">Shipped</span>;
      case 'DELIVERED':
        return <span className="badge badge-green">Delivered</span>;
      case 'CANCELLED':
        return <span className="badge badge-red">Cancelled</span>;
      case 'REFUNDED':
        return <span className="badge badge-grey">Refunded</span>;
      default:
        return <span className="badge badge-grey">{status}</span>;
    }
  };

  const statusOptions = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Order Management</h2>
        <div style={{ fontSize: '12px', color: '#666' }}>{total} Orders Total</div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs-bar">
        {['All', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'].map((status) => (
          <button
            key={status}
            onClick={() => { setStatusFilter(status); setPage(1); }}
            className={`tab-btn ${statusFilter === status ? 'active' : ''}`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search by order #, buyer name, or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-control"
          style={{ maxWidth: '400px' }}
        />
        <button type="submit" className="btn btn-secondary">Search</button>
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(''); setPage(1); setTimeout(() => fetchOrders(), 50); }}
            className="btn btn-secondary"
            style={{ color: '#888' }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Main Table */}
      <div className="table-container">
        <table className="dense-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date</th>
              <th>Buyer</th>
              <th>Total INR</th>
              <th>Method</th>
              <th>Courier / Tracking</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? (
              orders.map((order) => (
                <tr key={order.id} onClick={() => handleSelectOrder(order)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{order.orderNumber}</span>
                    {order.hasUnreadMessages && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '8px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        NEW CHAT
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: '#888' }}>
                    {new Date(order.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ color: '#fff' }}>{order.user.name}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>{order.address.phone}</div>
                  </td>
                  <td style={{ fontWeight: 'bold' }}>₹{order.totalINR.toLocaleString('en-IN')}</td>
                  <td>{order.paymentMethod}</td>
                  <td>
                    {order.awbCode ? (
                      <div>
                        <div style={{ color: '#fff', fontSize: '12px' }}>{order.courierName}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>AWB: {order.awbCode}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#555', fontSize: '11px' }}>UNSHIPPED</span>
                    )}
                  </td>
                  <td>{getStatusBadge(order.status)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  {loading ? 'SYNCHRONIZING INCOMING TRANSACTIONS...' : 'NO ORDERS MATCHING FILTER'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '40px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="btn btn-secondary"
          >
            Prev
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px', color: '#666' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="btn btn-secondary"
          >
            Next
          </button>
        </div>
      )}

      {/* Slide-in Order Details Drawer */}
      {selectedOrder && (
        <div className="drawer-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="drawer-title">Order details: {selectedOrder.orderNumber}</span>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div className="drawer-body">
              {/* Status Section */}
              <div className="detail-section">
                <div className="detail-title">Operational Status</div>
                <div className="detail-row">
                  <span className="detail-label">Current Status:</span>
                  <span className="detail-value">{getStatusBadge(selectedOrder.status)}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <select
                    value={statusSelect}
                    onChange={(e) => setStatusSelect(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '12px', padding: '6px 10px', flexGrow: 1 }}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={updateStatusLoading}
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '11px' }}
                  >
                    Update
                  </button>
                </div>
              </div>

              {/* Buyer Contact details */}
              <div className="detail-section">
                <div className="detail-title">Buyer Contact</div>
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{selectedOrder.user.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedOrder.user.email}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">{selectedOrder.address.phone}</span>
                </div>
              </div>

              {/* Shipping address details */}
              <div className="detail-section">
                <div className="detail-title">Shipping Address</div>
                <div style={{ fontSize: '13px', lineHeight: '1.6', color: '#fff' }}>
                  {selectedOrder.address.name}<br />
                  {selectedOrder.address.line1}<br />
                  {selectedOrder.address.line2 && <>{selectedOrder.address.line2}<br /></>}
                  {selectedOrder.address.city}, {selectedOrder.address.state} - <strong>{selectedOrder.address.pincode}</strong>
                </div>
              </div>

              {/* Product purchased details */}
              <div className="detail-section">
                <div className="detail-title">Purchased Item</div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                  {selectedOrder.product.primaryImageUrl && (
                    <img
                      src={selectedOrder.product.primaryImageUrl}
                      alt={selectedOrder.product.displayName}
                      style={{ width: '60px', height: '60px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border)' }}
                    />
                  )}
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>{selectedOrder.product.displayName}</div>
                    <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '4px' }}>₹{selectedOrder.priceINR.toLocaleString('en-IN')}</div>
                  </div>
                </div>
                {selectedOrder.buyerNote && (
                  <div style={{ marginTop: '12px', padding: '10px', background: '#1a1a1a', border: '1px dashed #333', fontSize: '12px', color: '#888' }}>
                    <strong>Buyer Note:</strong> "{selectedOrder.buyerNote}"
                  </div>
                )}
              </div>

              {/* Payment info details */}
              <div className="detail-section">
                <div className="detail-title">Payment Snapshot</div>
                <div className="detail-row">
                  <span className="detail-label">Method:</span>
                  <span className="detail-value">{selectedOrder.paymentMethod}</span>
                </div>
                {selectedOrder.razorpayOrderId && (
                  <div className="detail-row">
                    <span className="detail-label">Razorpay Order:</span>
                    <span className="detail-value" style={{ fontSize: '11px' }}>{selectedOrder.razorpayOrderId}</span>
                  </div>
                )}
                {selectedOrder.razorpayPaymentId && (
                  <div className="detail-row">
                    <span className="detail-label">Razorpay Payment:</span>
                    <span className="detail-value" style={{ fontSize: '11px' }}>{selectedOrder.razorpayPaymentId}</span>
                  </div>
                )}
                {selectedOrder.paidAt && (
                  <div className="detail-row">
                    <span className="detail-label">Paid At:</span>
                    <span className="detail-value">{new Date(selectedOrder.paidAt).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

              {/* Shipping tracking details */}
              <div className="detail-section">
                <div className="detail-title">Shipping & Logistics</div>
                {selectedOrder.awbCode ? (
                  <>
                    <div className="detail-row">
                      <span className="detail-label">Courier:</span>
                      <span className="detail-value">{selectedOrder.courierName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">AWB Tracking Code:</span>
                      <span className="detail-value" style={{ fontWeight: 'bold' }}>{selectedOrder.awbCode}</span>
                    </div>
                    {selectedOrder.trackingUrl && (
                      <div style={{ marginTop: '8px' }}>
                        <a href={selectedOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ width: '100%', fontSize: '11px', padding: '6px' }}>
                          Track Courier Website ↗
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#666', fontSize: '12px' }}>Shipment is not booked yet.</div>
                )}

                {/* Shipping booking actions */}
                {!selectedOrder.awbCode && selectedOrder.status === 'CONFIRMED' && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                      onClick={handleFetchCouriers}
                      disabled={fetchingCouriersLoading || bookingLoading}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '10px' }}
                    >
                      {fetchingCouriersLoading ? 'Checking Serviceability...' : 'Book Shipment via Shiprocket'}
                    </button>
                    <button
                      onClick={() => setShowManualShipping(!showManualShipping)}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '8px' }}
                    >
                      Enter Shipping Manually
                    </button>
                  </div>
                )}

                {showManualShipping && (
                  <form onSubmit={handleManualShippingSubmit} style={{ marginTop: '16px', padding: '16px', background: '#181818', borderRadius: '4px', border: '1px solid #333' }}>
                    <div className="form-group">
                      <label className="form-label">AWB Tracking Code</label>
                      <input type="text" value={manualAwb} onChange={(e) => setManualAwb(e.target.value)} className="form-control" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Courier Name</label>
                      <input type="text" placeholder="e.g. Delhivery, BlueDart" value={manualCourier} onChange={(e) => setManualCourier(e.target.value)} className="form-control" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tracking URL (Optional)</label>
                      <input type="url" value={manualTrackUrl} onChange={(e) => setManualTrackUrl(e.target.value)} className="form-control" />
                    </div>
                    <button type="submit" disabled={manualLoading} className="btn btn-primary" style={{ width: '100%' }}>
                      {manualLoading ? 'Saving...' : 'Confirm Tracking'}
                    </button>
                  </form>
                )}
              </div>

              {/* Client Inquiry Chat Thread */}
              <div className="detail-section" style={{ borderTop: '1px solid #222', paddingTop: '16px' }}>
                <div className="detail-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>💬 Client Inquiry Chat</span>
                  <span style={{ fontSize: '10px', color: '#C9A84C', textTransform: 'lowercase', fontWeight: 'normal' }}>10s live updates</span>
                </div>
                
                {/* Scrollable messages container */}
                <div style={{
                  maxHeight: '240px',
                  overflowY: 'auto',
                  marginTop: '12px',
                  paddingRight: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {messages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '11px', padding: '24px 0' }}>
                      No messages in this chat thread. Type below to message the client.
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.fromType === 'ADMIN';
                      return (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            maxWidth: '85%',
                            borderRadius: '4px',
                            padding: '8px 12px',
                            fontSize: '12px',
                            lineHeight: '1.4',
                            border: isMe ? '1px solid rgba(201, 168, 76, 0.3)' : '1px solid #333',
                            background: isMe ? 'rgba(201, 168, 76, 0.08)' : '#1a1a1a',
                            color: '#fff',
                            borderBottomRightRadius: isMe ? '0px' : '4px',
                            borderBottomLeftRadius: isMe ? '4px' : '0px'
                          }}>
                            <p style={{ margin: 0 }}>{msg.body}</p>
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '9px',
                              color: '#666',
                              marginTop: '6px',
                              fontFamily: 'monospace'
                            }}>
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

                {/* Reply box */}
                <form onSubmit={handleSendMessage} style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    maxLength={1000}
                    placeholder="Type an inquiry message regarding this creation..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="form-control"
                    style={{ fontSize: '12px', padding: '8px 12px', flexGrow: 1 }}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="btn btn-primary"
                    style={{ padding: '6px 16px', fontSize: '12px' }}
                  >
                    Send
                  </button>
                </form>
              </div>

              {/* Admin Note Section */}
              <div className="detail-section">
                <div className="detail-title">Internal Workspace Notes</div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record packaging conditions, customer coordination details, etc..."
                  className="form-control"
                  style={{ minHeight: '60px', fontSize: '12px' }}
                />
                <button
                  onClick={handleSaveAdminNote}
                  disabled={saveNoteLoading}
                  className="btn btn-secondary"
                  style={{ marginTop: '10px', float: 'right', padding: '6px 12px', fontSize: '11px' }}
                >
                  {saveNoteLoading ? 'Saving...' : 'Save Note'}
                </button>
                <div style={{ clear: 'both' }}></div>
              </div>
            </div>

            {/* Footer Quick Controls */}
            <div className="drawer-footer">
              <button
                onClick={() => downloadInvoice(selectedOrder.id)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Download Invoice
              </button>
              {(selectedOrder.status === 'CONFIRMED' || selectedOrder.status === 'SHIPPED') && (
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                >
                  Issue Refund
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Refund reason Modal dialog */}
      {showRefundModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <span className="drawer-title" style={{ color: 'var(--error)' }}>Issue Order Refund</span>
              <button onClick={() => { setShowRefundModal(false); setRefundReason(''); }} style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleRefundSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '15px' }}>
                  Are you sure you want to issue a full refund of <strong>₹{selectedOrder?.totalINR.toLocaleString('en-IN')}</strong>? This will execute automatically via Razorpay (or mark COD orders as refunded) and release the unique item back to store inventory if not yet shipped.
                </p>
                <div className="form-group">
                  <label className="form-label">Reason for Refund (min 5 chars)</label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter customer return reason or cancellation cause..."
                    className="form-control"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => { setShowRefundModal(false); setRefundReason(''); }} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={refundLoading || refundReason.trim().length < 5} className="btn btn-danger">Confirm Refund</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Courier Selection Modal */}
      {showCourierModal && (
        <div className="modal-backdrop" onClick={() => setShowCourierModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: '650px', background: '#111', color: '#fff', border: '1px solid #C9A84C' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #222' }}>
              <span className="drawer-title" style={{ color: '#C9A84C' }}>Available Couriers for {selectedOrder?.address.pincode}</span>
              <button onClick={() => setShowCourierModal(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <p style={{ fontSize: '12px', color: '#888', marginBottom: '15px' }}>
                Select a courier company below. The system recommendation is highlighted in gold.
              </p>
              <table className="dense-table" style={{ width: '100%' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #333' }}>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Courier</th>
                    <th style={{ textAlign: 'center', padding: '10px' }}>Est. Delivery</th>
                    <th style={{ textAlign: 'right', padding: '10px' }}>Rate</th>
                    <th style={{ textAlign: 'center', padding: '10px' }}>COD</th>
                    <th style={{ textAlign: 'right', padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {couriersList.map((c) => {
                    const isRecommended = recommendedCourier && recommendedCourier.courier_company_id === c.courier_company_id;
                    const isSelected = selectedCourierOverride && selectedCourierOverride.courier_company_id === c.courier_company_id;
                    return (
                      <tr
                        key={c.courier_company_id}
                        onClick={() => setSelectedCourierOverride(c)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(201, 168, 76, 0.1)' : 'transparent',
                          borderBottom: '1px solid #222',
                          borderColor: isSelected ? '#C9A84C' : '#222'
                        }}
                      >
                        <td style={{ padding: '12px 10px' }}>
                          <div style={{ fontWeight: 'bold', color: isSelected ? '#C9A84C' : '#fff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            {c.courier_name}
                            {isRecommended && (
                              <span style={{ fontSize: '9px', background: '#C9A84C', color: '#111', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                                RECOMMENDED
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: '#555' }}>ID: {c.courier_company_id} | {c.is_surface ? 'Surface' : 'Air'}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 10px', fontSize: '12px' }}>
                          {c.estimated_delivery_days} days
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 10px', fontWeight: 'bold', fontSize: '12px' }}>
                          ₹{c.rate}
                        </td>
                        <td style={{ textAlign: 'center', padding: '12px 10px', fontSize: '12px' }}>
                          {c.cod_available ? '✓ Yes' : '✗ No'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 10px' }}>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSelectedCourierOverride(c)}
                            style={{ accentColor: '#C9A84C' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #222', display: 'flex', gap: '10px', justifyContent: 'end' }}>
              <button type="button" onClick={() => setShowCourierModal(false)} className="btn btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={() => handleBookCourier(selectedCourierOverride?.courier_company_id)}
                disabled={bookingLoading || !selectedCourierOverride}
                className="btn btn-primary"
                style={{ backgroundColor: '#C9A84C', color: '#111', fontWeight: 'bold' }}
              >
                {bookingLoading ? 'Booking Shipment...' : `Confirm & Book (${selectedCourierOverride?.courier_name})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Success and Error toast indicators */}
      <div className="toast-container">
        {successToast && <div className="toast toast-success">{successToast}</div>}
        {errorToast && <div className="toast toast-error">{errorToast}</div>}
      </div>
    </div>
  );
}
