'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithRetry } from './utils/api';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface Order {
  id: string;
  orderNumber: string;
  priceINR: number;
  shippingINR: number;
  totalINR: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  product: {
    displayName: string;
  };
  user: {
    name: string;
    email: string;
  };
}

interface DashboardStats {
  revenue: { today: number; total: number };
  orders: { total: number; today: number; pendingShipment: number; active: number };
  inventory: { available: number; sold: number };
  recentOrders: Order[];
}

export default function OverviewPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Quick Action States
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStats = async (silent = false) => {
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const res = await fetchWithRetry(`${BACKEND_URL}/admin/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to load dashboard stats');

      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Error occurred');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Setup 60-second silent polling for live dashboard updates
    const interval = setInterval(() => {
      fetchStats(true);
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const handleBookCourier = async (orderId: string) => {
    setBookingId(orderId);
    setActionError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/orders/${orderId}/book-courier`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || 'Courier booking failed');
      }

      setSuccessMsg(`Successfully booked! AWB: ${data.awbCode} via ${data.courierName}`);
      fetchStats(true);
    } catch (err: any) {
      setActionError(err.message || 'Courier booking failed');
    } finally {
      setBookingId(null);
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

  if (loading) {
    return <div style={{ color: '#666', fontFamily: 'monospace' }}>SYNCHRONIZING STATS...</div>;
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)' }}>
        <h3>ERROR: {error}</h3>
        <button onClick={() => fetchStats()} className="btn btn-secondary" style={{ marginTop: '10px' }}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Operations Console</h2>
        <div style={{ fontSize: '11px', color: '#666' }}>
          LAST UPDATE: {new Date().toLocaleTimeString()} (AUTO-REFRESH ACTIVE)
        </div>
      </div>

      {actionError && (
        <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
          ⚠️ BOOKING ERROR: {actionError.toUpperCase()}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', color: 'var(--success)', borderRadius: '4px', marginBottom: '20px', fontSize: '13px' }}>
          ✓ SUCCESS: {successMsg}
        </div>
      )}

      {/* Stats KPI grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">₹{(stats?.revenue.today || 0).toLocaleString('en-IN')}</div>
          <div className="stat-label">Today's Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.orders.pendingShipment || 0}</div>
          <div className="stat-label">Pending Shipment</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.inventory.available || 0}</div>
          <div className="stat-label">Items Live</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.orders.today || 0}</div>
          <div className="stat-label">New Orders Today</div>
        </div>
      </div>

      <div style={{ margin: '40px 0 20px 0' }}>
        <h3 style={{ fontSize: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Customer Orders
        </h3>
      </div>

      {/* Orders table */}
      <div className="table-container">
        <table className="dense-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Creation Time</th>
              <th>Buyer</th>
              <th>Product Details</th>
              <th>Total (INR)</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stats?.recentOrders && stats.recentOrders.length > 0 ? (
              stats.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td style={{ fontWeight: 'bold', color: '#fff' }}>
                    <a href={`/orders?search=${order.orderNumber}`}>{order.orderNumber}</a>
                  </td>
                  <td style={{ fontSize: '12px', color: '#888' }}>
                    {new Date(order.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <div style={{ color: '#fff', fontSize: '13px' }}>{order.user.name}</div>
                    <div style={{ fontSize: '11px', color: '#666' }}>{order.user.email}</div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{order.product?.displayName}</td>
                  <td style={{ fontWeight: 'bold' }}>₹{order.totalINR.toLocaleString('en-IN')}</td>
                  <td>{getStatusBadge(order.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <a href={`/orders?search=${order.orderNumber}`} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px' }}>
                        View Detail
                      </a>
                      {order.status === 'CONFIRMED' && (
                        <button
                          onClick={() => handleBookCourier(order.id)}
                          disabled={bookingId === order.id}
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          {bookingId === order.id ? 'Booking...' : 'Book Courier'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: '#666', padding: '30px' }}>
                  NO ORDERS RECORDED YET
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
