'use client';

import React, { useState, useEffect } from 'react';
import { fetchWithRetry } from '../utils/api';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isVerified: boolean;
  isAdmin: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

interface CustomerStats {
  total: number;
  verified: number;
  unverified: number;
  newThisMonth: number;
}

interface DetailOrder {
  id: string;
  orderNumber: string;
  productName: string;
  amount: number;
  status: string;
  date: string;
}

interface DetailAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface DetailWishlist {
  id: string;
  productId: string;
  productName: string;
  price: number;
  image: string;
}

interface CustomerDetails {
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isVerified: boolean;
    isAdmin: boolean;
    createdAt: string;
    totalSpent: number;
    lastOrderDate: string | null;
  };
  orders: DetailOrder[];
  addresses: DetailAddress[];
  wishlist: DetailWishlist[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter and pagination state
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Drawer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Modal confirm delete state
  const [deleteUser, setDeleteUser] = useState<Customer | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast alerts state
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

  const fetchCustomersList = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort,
        ...(search.trim() ? { search } : {})
      });

      const res = await fetchWithRetry(`${BACKEND_URL}/admin/customers?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load customers');

      const data = await res.json();
      setCustomers(data.customers);
      setTotalPages(data.totalPages);
      setStats(data.stats);
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message || 'Error loading customers list');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchCustomerProfile = async (id: string) => {
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/customers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load customer profile details');

      const data = await res.json();
      setDetails(data);
    } catch (err: any) {
      showError(err.message || 'Failed to fetch customer profile');
      setDrawerOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomersList();
  }, [page, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCustomersList();
  };

  const handleOpenDrawer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDetails(null);
    setDrawerOpen(true);
    fetchCustomerProfile(customer.id);
  };

  const handleManualVerify = async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/customers/${id}/verify`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Verification failed');

      showSuccess('🎉 Customer account manually verified!');
      fetchCustomersList(true);
      if (selectedCustomerId === id) {
        fetchCustomerProfile(id);
      }
    } catch (err: any) {
      showError(err.message || 'Failed to manually verify user');
    }
  };

  const handleResendEmail = async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/customers/${id}/send-verification`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Email resend failed');

      showSuccess('✓ Verification email with active OTP resent successfully');
    } catch (err: any) {
      showError(err.message || 'Failed to resend verification email');
    }
  };

  const initiateDelete = (customer: Customer) => {
    setDeleteUser(customer);
    setDeleteWarning(null);
  };

  const confirmDelete = async (force = false) => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const queryParams = new URLSearchParams({
        ...(force ? { force: 'true' } : {})
      });

      const res = await fetch(`${BACKEND_URL}/admin/customers/${deleteUser.id}?${queryParams.toString()}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'CUSTOMER_HAS_ORDERS') {
          setDeleteWarning(data.message);
          setDeleteLoading(false);
          return;
        }
        throw new Error(data.message || 'Delete operation failed');
      }

      showSuccess('🗑 Customer deleted and active orders anonymised successfully.');
      setDeleteUser(null);
      setDeleteWarning(null);
      setDrawerOpen(false);
      fetchCustomersList(true);
    } catch (err: any) {
      showError(err.message || 'Failed to delete customer account');
      setDeleteUser(null);
      setDeleteWarning(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
      case 'PROCESSING':
        return <span className="badge badge-yellow">{status}</span>;
      case 'SHIPPED':
        return <span className="badge badge-blue">Shipped</span>;
      case 'DELIVERED':
        return <span className="badge badge-green">Delivered</span>;
      case 'CANCELLED':
        return <span className="badge badge-red">Cancelled</span>;
      default:
        return <span className="badge badge-grey">{status}</span>;
    }
  };

  if (loading) {
    return <div style={{ color: '#666', fontFamily: 'monospace' }}>SYNCHRONIZING CUSTOMERS SCHEMA...</div>;
  }

  if (error) {
    return (
      <div style={{ color: 'var(--error)' }}>
        <h3>ERROR LOADING HUB: {error}</h3>
        <button onClick={() => fetchCustomersList()} className="btn btn-secondary" style={{ marginTop: '10px' }}>Retry Connection</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header section */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="page-title">Customers</h2>
          <span style={{ background: '#1a1a1a', border: '1px solid #333', color: 'var(--accent)', fontSize: '11px', fontWeight: 'bold', padding: '3px 8px', borderRadius: '4px' }}>
            {stats?.total || 0} TOTAL
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#666' }}>
          LAST SYNC: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* KPI statistics cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.total || 0}</div>
          <div className="stat-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{stats?.verified || 0}</div>
          <div className="stat-label">Verified Accounts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f97316' }}>{stats?.unverified || 0}</div>
          <div className="stat-label">Unverified Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.newThisMonth || 0}</div>
          <div className="stat-label">New This Month</div>
        </div>
      </div>

      {/* Search & Sort Panel */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flexGrow: 1 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search customer name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '400px' }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sort By:</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="form-control"
            style={{ width: '180px', padding: '8px 12px', fontSize: '12px' }}
          >
            <option value="newest">Newest Joined</option>
            <option value="oldest">Oldest Joined</option>
            <option value="most_orders">Most Orders</option>
            <option value="most_spent">Most Spent (₹)</option>
          </select>
        </div>
      </div>

      {/* Main Customers dense data table */}
      <div className="table-container">
        <table className="dense-table">
          <thead>
            <tr>
              <th>Customer Details</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Orders</th>
              <th style={{ textAlign: 'right' }}>Total Spent</th>
              <th>Joined Date</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? (
              customers.map((c) => (
                <tr key={c.id}>
                  {/* Name with initials avatar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#222', border: '1px solid #444', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <button
                          onClick={() => handleOpenDrawer(c)}
                          style={{ background: 'none', border: 'none', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '13px', textAlign: 'left', padding: 0 }}
                          className="hover:underline"
                        >
                          {c.name}
                        </button>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{c.email}</td>
                  <td style={{ fontSize: '13px', color: c.phone ? '#fff' : '#666' }}>{c.phone || '—'}</td>
                  <td>
                    {c.isVerified ? (
                      <span className="badge badge-green">Verified</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)' }}>Unverified</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: '500' }}>{c.orderCount}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: c.totalSpent > 0 ? 'var(--accent)' : '#888' }}>
                    ₹{c.totalSpent.toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontSize: '12px', color: '#888' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleOpenDrawer(c)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                      >
                        View Profile
                      </button>
                      {!c.isVerified && (
                        <button
                          onClick={() => handleManualVerify(c.id)}
                          className="btn btn-primary"
                          style={{ padding: '4px 8px', fontSize: '10px' }}
                        >
                          Verify
                        </button>
                      )}
                      <button
                        onClick={() => initiateDelete(c)}
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
                  NO CUSTOMER RECORDS MATCHING FILTERS FOUND
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center', marginBottom: '40px' }}>
          <button
            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
            disabled={page === 1}
            className="btn btn-secondary"
            style={{ padding: '6px 12px' }}
          >
            Previous
          </button>
          <span style={{ fontSize: '12px', color: '#888' }}>PAGE {page} OF {totalPages}</span>
          <button
            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
            disabled={page === totalPages}
            className="btn btn-secondary"
            style={{ padding: '6px 12px' }}
          >
            Next
          </button>
        </div>
      )}

      {/* sliding Drawer detail component */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3 className="drawer-title">Customer Dossier</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div className="drawer-body">
              {detailsLoading ? (
                <div style={{ color: '#666', fontFamily: 'monospace', textAlign: 'center', padding: '40px 0' }}>RECOVERING DOSSIER DATA...</div>
              ) : details ? (
                <div>
                  {/* Account overview section */}
                  <div className="detail-section">
                    <h4 className="detail-title">Identity & Profile</h4>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#222', border: '1px solid #444', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                        {getInitials(details.customer.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>{details.customer.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Registered: {new Date(details.customer.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Email Address</span>
                      <span className="detail-value">{details.customer.email}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Phone Number</span>
                      <span className="detail-value">{details.customer.phone || '—'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Verification Status</span>
                      <span className="detail-value">
                        {details.customer.isVerified ? (
                          <span className="badge badge-green">Verified Account</span>
                        ) : (
                          <span className="badge animate-pulse" style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.3)' }}>Unverified</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Financial stats */}
                  <div className="detail-section">
                    <h4 className="detail-title">Acquisition & Operations</h4>
                    <div className="detail-row">
                      <span className="detail-label">Total Completed Orders</span>
                      <span className="detail-value" style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{details.orders.length} Orders</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Net Lifetime Value (LTV)</span>
                      <span className="detail-value" style={{ color: 'var(--success)', fontWeight: 'bold' }}>₹{details.customer.totalSpent.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Last Order Placed</span>
                      <span className="detail-value">
                        {details.customer.lastOrderDate 
                          ? new Date(details.customer.lastOrderDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'
                        }
                      </span>
                    </div>
                  </div>

                  {/* Order History */}
                  <div className="detail-section">
                    <h4 className="detail-title">Order Ledger</h4>
                    {details.orders.length > 0 ? (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '4px' }}>
                        <table className="dense-table" style={{ fontSize: '11px' }}>
                          <thead>
                            <tr>
                              <th>Order No</th>
                              <th>Product</th>
                              <th style={{ textAlign: 'right' }}>Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {details.orders.map(o => (
                              <tr key={o.id}>
                                <td style={{ fontWeight: 'bold' }}>
                                  <a href={`/orders?search=${o.orderNumber}`} style={{ color: 'var(--accent)' }}>{o.orderNumber}</a>
                                </td>
                                <td style={{ color: '#ccc' }}>{o.productName}</td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>₹{o.amount.toLocaleString('en-IN')}</td>
                                <td>{getOrderStatusBadge(o.status)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>No completed orders registered.</p>
                    )}
                  </div>

                  {/* Address Book */}
                  <div className="detail-section">
                    <h4 className="detail-title">Address Registry</h4>
                    {details.addresses.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {details.addresses.map(a => (
                          <div key={a.id} style={{ background: '#171717', border: '1px solid var(--border)', padding: '12px', borderRadius: '4px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <strong>{a.label} {a.isDefault && <span style={{ color: 'var(--accent)', fontSize: '9px', textTransform: 'uppercase', border: '1px solid var(--accent)', padding: '1px 4px', borderRadius: '2px', marginLeft: '6px' }}>Default</span>}</strong>
                              <span style={{ color: '#888' }}>{a.phone}</span>
                            </div>
                            <div style={{ color: '#ccc' }}>{a.name}</div>
                            <div style={{ color: '#999', marginTop: '2px' }}>
                              {a.line1}, {a.line2 ? `${a.line2}, ` : ''}{a.city}, {a.state} — {a.pincode}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>No addresses configured.</p>
                    )}
                  </div>

                  {/* Wishlist */}
                  <div className="detail-section">
                    <h4 className="detail-title">Wishlist Favorites</h4>
                    {details.wishlist.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {details.wishlist.map(w => (
                          <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#171717', border: '1px solid var(--border)', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                            <div>
                              <strong style={{ color: '#fff' }}>{w.productName}</strong>
                              <div style={{ color: 'var(--accent)', fontWeight: '600', marginTop: '2px' }}>₹{w.price.toLocaleString('en-IN')}</div>
                            </div>
                            <a href={`/products?search=${w.productName}`} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '9px' }}>
                              Inspect Product
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#555', fontSize: '12px', fontStyle: 'italic' }}>No wishlist favorites recorded.</p>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--error)' }}>Failed to load profile dossier details.</p>
              )}
            </div>

            {/* Footer with quick action controls */}
            <div className="drawer-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {details && !details.customer.isVerified && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleManualVerify(details.customer.id)}
                      className="btn btn-primary"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleResendEmail(details.customer.id)}
                      className="btn btn-secondary"
                    >
                      Resend OTP
                    </button>
                  </div>
                )}
              </div>
              <div>
                {details && (
                  <button
                    onClick={() => initiateDelete(customers.find(c => c.id === details.customer.id) || { ...details.customer, orderCount: details.orders.length, lastOrderAt: details.customer.lastOrderDate } as Customer)}
                    className="btn btn-danger"
                  >
                    Delete Customer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <div className="modal-backdrop" onClick={() => { if (!deleteLoading) { setDeleteUser(null); setDeleteWarning(null); } }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="drawer-title" style={{ color: 'var(--error)' }}>⚠ Confirm Account Purge</h3>
              <button
                onClick={() => { if (!deleteLoading) { setDeleteUser(null); setDeleteWarning(null); } }}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}
                disabled={deleteLoading}
              >
                &times;
              </button>
            </div>

            <div className="modal-body" style={{ fontSize: '13px', lineHeight: '1.6' }}>
              <p>You are initiating an emergency deletion of the customer account:</p>
              <div style={{ margin: '15px 0', padding: '12px', background: '#171717', border: '1px solid var(--border)', borderRadius: '4px' }}>
                <div><strong>Name:</strong> {deleteUser.name}</div>
                <div><strong>Email:</strong> {deleteUser.email}</div>
              </div>

              {deleteWarning ? (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error)', borderRadius: '4px', marginBottom: '15px', fontWeight: '500' }}>
                  ⚠ WARNING: {deleteWarning}
                  <p style={{ marginTop: '8px', fontSize: '12px', color: '#ccc', fontWeight: 'normal' }}>
                    Confirming this action will keep the order records intact for accounting/audits, but will anonymise them under `anonymised@rajshreejewels.com` and purge the customer's personal data.
                  </p>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)' }}>This action will permanently delete all associated address books, session histories, and wishlist favorites. This cannot be undone.</p>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={() => { setDeleteUser(null); setDeleteWarning(null); }}
                className="btn btn-secondary"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              
              {deleteWarning ? (
                <button
                  onClick={() => confirmDelete(true)}
                  className="btn btn-danger animate-pulse"
                  style={{ background: 'var(--error)', color: '#fff' }}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Anonymising...' : 'Anonymise & Delete anyway'}
                </button>
              ) : (
                <button
                  onClick={() => confirmDelete(false)}
                  className="btn btn-danger"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Proceed with Deletion'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global alert toast notification component */}
      <div className="toast-container">
        {successToast && <div className="toast toast-success">{successToast}</div>}
        {errorToast && <div className="toast toast-error">{errorToast}</div>}
      </div>
    </div>
  );
}
