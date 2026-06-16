'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENTAGE' | 'FIXED_INR' | 'FREE_SHIPPING';
  value: number;
  minOrderINR: number;
  maxUsesTotal: number | null;
  maxUsesPerUser: number;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SiteSale {
  id: string;
  isActive: boolean;
  label: string;
  discountPct: number;
  bannerText: string | null;
  startsAt: string | null;
  endsAt: string | null;
}

export default function OffersPage() {
  const [activeTab, setActiveTab] = useState<'coupons' | 'sale'>('coupons');
  const [token, setToken] = useState<string | null>(null);

  // Coupons State
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponLoading, setCouponLoading] = useState(true);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  
  // Coupon Form State
  const [couponForm, setCouponForm] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_INR' | 'FREE_SHIPPING',
    value: 0,
    minOrderINR: 0,
    maxUsesTotal: '' as number | string,
    maxUsesPerUser: 1,
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: '',
    isActive: true
  });
  const [couponError, setCouponError] = useState('');
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  // Sitewide Sale State
  const [sale, setSale] = useState<SiteSale | null>(null);
  const [saleLoading, setSaleLoading] = useState(true);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [testProductPrice, setTestProductPrice] = useState<number>(5000);

  // Toast notifications
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      fetchCoupons(savedToken);
      fetchSale(savedToken);
    }
  }, []);

  const fetchCoupons = async (authToken: string) => {
    try {
      setCouponLoading(true);
      const res = await fetch(`${BACKEND_URL}/admin/coupons`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCoupons(data);
      }
    } catch (err) {
      console.error('Failed to fetch coupons', err);
    } finally {
      setCouponLoading(false);
    }
  };

  const fetchSale = async (authToken: string) => {
    try {
      setSaleLoading(true);
      // Fetch public settings for sale status first, or admin endpoints
      const res = await fetch(`${BACKEND_URL}/settings/sale`);
      if (res.ok) {
        const data = await res.json();
        setSale({
          id: data.id || '1',
          isActive: data.isActive || false,
          label: data.label || 'Festive Offer',
          discountPct: data.discountPct || 10,
          bannerText: data.bannerText || '',
          startsAt: data.startsAt ? new Date(data.startsAt).toISOString().slice(0, 16) : '',
          endsAt: data.endsAt ? new Date(data.endsAt).toISOString().slice(0, 16) : ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch sale config', err);
    } finally {
      setSaleLoading(false);
    }
  };

  const handleCreateOrUpdateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!couponForm.code.trim()) {
      setCouponError('Coupon code is required.');
      return;
    }
    if (couponForm.type !== 'FREE_SHIPPING' && (couponForm.value === undefined || couponForm.value === null || couponForm.value <= 0)) {
      setCouponError('Discount value must be greater than 0.');
      return;
    }
    if (couponForm.minOrderINR === undefined || couponForm.minOrderINR === null || couponForm.minOrderINR < 0) {
      setCouponError('Minimum order INR must be 0 or greater.');
      return;
    }
    if (!couponForm.validFrom) {
      setCouponError('Valid from date is required.');
      return;
    }

    setCouponSubmitting(true);
    setCouponError('');

    try {
      const payload = {
        code: couponForm.code.toUpperCase().trim(),
        description: couponForm.description || undefined,
        type: couponForm.type,
        value: Number(couponForm.value),
        minOrderINR: Number(couponForm.minOrderINR),
        maxUsesTotal: couponForm.maxUsesTotal === '' ? null : Number(couponForm.maxUsesTotal),
        maxUsesPerUser: Number(couponForm.maxUsesPerUser),
        validFrom: new Date(couponForm.validFrom).toISOString(),
        validUntil: couponForm.validUntil ? new Date(couponForm.validUntil).toISOString() : null,
        isActive: couponForm.isActive
      };

      const url = selectedCoupon 
        ? `${BACKEND_URL}/admin/coupons/${selectedCoupon.id}`
        : `${BACKEND_URL}/admin/coupons`;

      const method = selectedCoupon ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save coupon');
      }

      triggerToast(selectedCoupon ? '✨ Coupon updated successfully!' : '✨ New coupon created successfully!');
      setShowCouponModal(false);
      setSelectedCoupon(null);
      fetchCoupons(token);
    } catch (err: any) {
      setCouponError(err.message || 'Failed to save coupon');
    } finally {
      setCouponSubmitting(false);
    }
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setCouponForm({
      code: coupon.code,
      description: coupon.description || '',
      type: coupon.type,
      value: coupon.value,
      minOrderINR: coupon.minOrderINR,
      maxUsesTotal: coupon.maxUsesTotal === null ? '' : coupon.maxUsesTotal,
      maxUsesPerUser: coupon.maxUsesPerUser,
      validFrom: new Date(coupon.validFrom).toISOString().slice(0, 16),
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().slice(0, 16) : '',
      isActive: coupon.isActive
    });
    setShowCouponModal(true);
  };

  const handleToggleCouponActive = async (coupon: Coupon) => {
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...coupon,
          isActive: !coupon.isActive,
          validFrom: coupon.validFrom,
          validUntil: coupon.validUntil
        })
      });
      if (res.ok) {
        triggerToast(`Coupon code ${coupon.code} ${!coupon.isActive ? 'activated' : 'deactivated'} successfully.`);
        fetchCoupons(token);
      } else {
        throw new Error('Failed to update status');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Status toggle failed', 'error');
    }
  };

  const handleDeleteCoupon = async (coupon: Coupon) => {
    if (!token) return;
    const confirmDelete = window.confirm(`Are you absolutely sure you want to permanently delete coupon "${coupon.code}"? This action is irreversible.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${BACKEND_URL}/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        triggerToast(`Coupon code "${coupon.code}" deleted successfully.`);
        fetchCoupons(token);
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete coupon');
      }
    } catch (err: any) {
      triggerToast(err.message || 'Coupon deletion failed', 'error');
    }
  };

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !sale) return;

    if (!sale.label.trim()) {
      triggerToast('Sale label is required', 'error');
      return;
    }
    if (sale.discountPct === undefined || sale.discountPct === null || sale.discountPct < 1 || sale.discountPct > 90) {
      triggerToast('Discount percentage must be between 1% and 90%', 'error');
      return;
    }

    setSaleSubmitting(true);

    try {
      const payload = {
        isActive: sale.isActive,
        label: sale.label,
        discountPct: Number(sale.discountPct),
        bannerText: sale.bannerText || null,
        startsAt: sale.startsAt ? new Date(sale.startsAt).toISOString() : null,
        endsAt: sale.endsAt ? new Date(sale.endsAt).toISOString() : null
      };

      const res = await fetch(`${BACKEND_URL}/admin/settings/sale`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to update sitewide sale settings');
      }

      triggerToast('✨ Sitewide Sale configuration saved and storefront pages revalidated!');
      fetchSale(token);
    } catch (err: any) {
      triggerToast(err.message || 'Failed to save sale configuration', 'error');
    } finally {
      setSaleSubmitting(false);
    }
  };

  const calculatePreview = () => {
    if (!sale) return { discountedPrice: testProductPrice, savings: 0 };
    const savings = Math.floor((testProductPrice * sale.discountPct) / 100);
    return {
      discountedPrice: testProductPrice - savings,
      savings
    };
  };

  const preview = calculatePreview();

  return (
    <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: '#e0e0e0', padding: '10px' }}>
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : '#C9A84C',
          color: '#000',
          padding: '12px 20px',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          {toast.text.toUpperCase()}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h2 style={{ color: '#C9A84C', fontSize: '22px', letterSpacing: '2px', fontWeight: 'bold', margin: 0, fontFamily: 'Cinzel, Georgia, serif' }}>OFFERS & PROMOTIONS</h2>
          <p style={{ fontSize: '10px', color: '#666', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Manage Coupon Codes and Sitewide Sale Events</p>
        </div>

        {activeTab === 'coupons' && (
          <button
            onClick={() => {
              setSelectedCoupon(null);
              setCouponForm({
                code: '',
                description: '',
                type: 'PERCENTAGE',
                value: 0,
                minOrderINR: 0,
                maxUsesTotal: '',
                maxUsesPerUser: 1,
                validFrom: new Date().toISOString().slice(0, 16),
                validUntil: '',
                isActive: true
              });
              setCouponError('');
              setShowCouponModal(true);
            }}
            className="btn btn-primary"
            style={{ padding: '8px 16px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            + Create Coupon
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '1px solid #222' }}>
        <button
          onClick={() => setActiveTab('coupons')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'coupons' ? '2px solid #C9A84C' : '2px solid transparent',
            color: activeTab === 'coupons' ? '#C9A84C' : '#666',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: 'inherit'
          }}
        >
          Coupon Codes ({coupons.length})
        </button>
        <button
          onClick={() => setActiveTab('sale')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'sale' ? '2px solid #C9A84C' : '2px solid transparent',
            color: activeTab === 'sale' ? '#C9A84C' : '#666',
            padding: '10px 20px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: 'inherit'
          }}
        >
          Sitewide Sale Active {sale?.isActive && '🟢'}
        </button>
      </div>

      {/* Coupon Codes Tab */}
      {activeTab === 'coupons' && (
        <div>
          {couponLoading ? (
            <div style={{ textAlign: 'center', padding: '50px 0', color: '#666', fontSize: '12px' }}>LOADING COUPONS FROM VAULT...</div>
          ) : coupons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px dashed #222', borderRadius: '4px', background: '#111' }}>
              <p style={{ color: '#666', fontSize: '13px', margin: '0 0 15px 0' }}>NO ACTIVE OR EXPIRED COUPONS IN THE DATABASE</p>
              <button
                onClick={() => setShowCouponModal(true)}
                style={{ padding: '6px 14px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
              >
                Create First Coupon
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #222', background: '#0a0a0a' }}>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Code</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Description</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Discount Type</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Value</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Min Order</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Usage (Total / Per User)</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Expiry</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '15px 20px', color: '#666', fontWeight: 'normal', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => (
                    <tr key={coupon.id} style={{ borderBottom: '1px solid #1c1c1c' }}>
                      <td style={{ padding: '15px 20px', fontWeight: 'bold', color: '#C9A84C' }}>{coupon.code}</td>
                      <td style={{ padding: '15px 20px', color: '#aaa' }}>{coupon.description || '-'}</td>
                      <td style={{ padding: '15px 20px', color: '#888' }}>
                        {coupon.type === 'PERCENTAGE' ? 'PERCENT OFF (%)' : coupon.type === 'FIXED_INR' ? 'RUPEES OFF (₹)' : 'FREE SHIPPING'}
                      </td>
                      <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>
                        {coupon.type === 'PERCENTAGE' ? `${coupon.value}%` : coupon.type === 'FIXED_INR' ? `₹${coupon.value}` : 'N/A'}
                      </td>
                      <td style={{ padding: '15px 20px' }}>₹{coupon.minOrderINR.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '15px 20px' }}>
                        {coupon.usedCount} / {coupon.maxUsesTotal === null ? 'Unlimited' : coupon.maxUsesTotal} 
                        <span style={{ color: '#666', fontSize: '10px', display: 'block', marginTop: '2px' }}>Max {coupon.maxUsesPerUser} per user</span>
                      </td>
                      <td style={{ padding: '15px 20px', color: coupon.validUntil && new Date(coupon.validUntil) < new Date() ? '#ef4444' : '#aaa' }}>
                        {coupon.validUntil ? new Date(coupon.validUntil).toLocaleDateString('en-IN') : 'No Expiry'}
                      </td>
                      <td style={{ padding: '15px 20px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '2px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          background: coupon.isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: coupon.isActive ? '#22c55e' : '#ef4444',
                          border: coupon.isActive ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                        }}>
                          {coupon.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '10px' }}>
                          <button
                            onClick={() => handleToggleCouponActive(coupon)}
                            style={{
                              background: 'none',
                              border: '1px solid #333',
                              color: coupon.isActive ? '#ef4444' : '#22c55e',
                              padding: '4px 8px',
                              fontSize: '10px',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {coupon.isActive ? 'DISABLE' : 'ENABLE'}
                          </button>
                          <button
                            onClick={() => handleEditCoupon(coupon)}
                            style={{
                              background: '#222',
                              border: '1px solid #444',
                              color: '#fff',
                              padding: '4px 8px',
                              fontSize: '10px',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon)}
                            style={{
                              background: '#ef4444',
                              border: '1px solid #ef4444',
                              color: '#000',
                              padding: '4px 8px',
                              fontSize: '10px',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            DELETE
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sitewide Sale Tab */}
      {activeTab === 'sale' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          {saleLoading ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '50px 0', color: '#666' }}>LOADING SITEWIDE SALE SETTINGS...</div>
          ) : (
            <>
              {/* Form Block */}
              <div style={{ background: '#111', border: '1px solid #222', padding: '30px', borderRadius: '4px' }}>
                <h3 style={{ fontSize: '15px', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>CONFIGURATION</h3>
                
                {sale && (
                  <form onSubmit={handleSaveSale}>
                    <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: '#0a0a0a', padding: '15px', border: '1px solid #222', borderRadius: '4px' }}>
                      <input
                        type="checkbox"
                        id="saleActive"
                        checked={sale.isActive}
                        onChange={(e) => setSale({ ...sale, isActive: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#C9A84C' }}
                      />
                      <label htmlFor="saleActive" style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', color: sale.isActive ? '#C9A84C' : '#888', cursor: 'pointer' }}>
                        Enable Sitewide Sale Discount
                      </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Sale Label / Tag</label>
                      <input
                        type="text"
                        value={sale.label}
                        onChange={(e) => setSale({ ...sale, label: e.target.value })}
                        placeholder="e.g. Diwali Dhamaka, Black Friday"
                        style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Discount Percentage (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={sale.discountPct}
                        onChange={(e) => setSale({ ...sale, discountPct: Number(e.target.value) })}
                        style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                      />
                      <small style={{ color: '#555', fontSize: '10px', display: 'block', marginTop: '4px' }}>Applies percentage reduction directly onto all items price tags (1-90%)</small>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Announcement Banner Text</label>
                      <textarea
                        value={sale.bannerText || ''}
                        onChange={(e) => setSale({ ...sale, bannerText: e.target.value })}
                        placeholder="e.g. ✨ DIWALI SPECIAL: 20% EXTRA DISCOUNT APPLIED AUTOMATICALLY AT CHECKOUT! ✨"
                        style={{ width: '100%', height: '80px', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', resize: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Starts At (Optional)</label>
                        <input
                          type="datetime-local"
                          value={sale.startsAt || ''}
                          onChange={(e) => setSale({ ...sale, startsAt: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Ends At (Optional)</label>
                        <input
                          type="datetime-local"
                          value={sale.endsAt || ''}
                          onChange={(e) => setSale({ ...sale, endsAt: e.target.value })}
                          style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={saleSubmitting}
                      style={{ width: '100%', padding: '12px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer' }}
                    >
                      {saleSubmitting ? 'SAVING & REVALIDATING STOREFRONT...' : 'Save Configuration'}
                    </button>
                  </form>
                )}
              </div>

              {/* Preview Block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: '#111', border: '1px solid #222', padding: '30px', borderRadius: '4px' }}>
                  <h3 style={{ fontSize: '15px', color: '#C9A84C', borderBottom: '1px solid #222', paddingBottom: '10px', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>DASHBOARD LIVE PREVIEW</h3>
                  
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Test Product Price (₹)</label>
                    <input
                      type="number"
                      value={testProductPrice}
                      onChange={(e) => setTestProductPrice(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '4px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
                      <span style={{ color: '#666' }}>Standard Retail:</span>
                      <span style={{ textDecoration: sale?.isActive ? 'line-through' : 'none', color: sale?.isActive ? '#666' : '#fff' }}>₹{testProductPrice.toLocaleString('en-IN')}</span>
                    </div>

                    {sale?.isActive && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px', color: '#22c55e', fontWeight: 'bold' }}>
                          <span>Sale Discount ({sale.discountPct}%):</span>
                          <span>- ₹{preview.savings.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ borderTop: '1px solid #222', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', color: '#C9A84C' }}>
                          <span>Offer Price:</span>
                          <span>₹{preview.discountedPrice.toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ background: 'rgba(201, 168, 76, 0.05)', border: '1px solid rgba(201, 168, 76, 0.15)', padding: '25px', borderRadius: '4px' }}>
                  <h4 style={{ color: '#C9A84C', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', margin: '0 0 10px 0', letterSpacing: '1px' }}>⚠️ AUTOMATIC STOREFRONT REVALIDATION</h4>
                  <p style={{ fontSize: '11px', color: '#aaa', lineHeight: '1.6', margin: 0 }}>
                    Saving the sale configuration triggers on-demand Incremental Static Regeneration (ISR) to clean and rebuild the public gallery page and all product detail paths. Buyers will instantly observe struck-through pricing and custom announcement banners without server restarts.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Coupon modal */}
      {showCouponModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: '4px',
            width: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '30px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#C9A84C', fontSize: '16px', letterSpacing: '1px', borderBottom: '1px solid #222', paddingBottom: '10px', textTransform: 'uppercase' }}>
              {selectedCoupon ? 'Edit Coupon Settings' : 'Create New Coupon'}
            </h3>

            {couponError && (
              <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '11px', borderRadius: '2px', marginBottom: '20px' }}>
                {couponError.toUpperCase()}
              </div>
            )}

            <form onSubmit={handleCreateOrUpdateCoupon} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Coupon Code (Uppercase)</label>
                <input
                  type="text"
                  disabled={!!selectedCoupon}
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. LAUNCH20"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', textTransform: 'uppercase', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Description</label>
                <input
                  type="text"
                  value={couponForm.description}
                  onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })}
                  placeholder="e.g. 20% discount on initial launch pieces"
                  style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Type</label>
                  <select
                    value={couponForm.type}
                    onChange={(e) => setCouponForm({ ...couponForm, type: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  >
                    <option value="PERCENTAGE">PERCENT OFF (%)</option>
                    <option value="FIXED_INR">RUPEES OFF (₹)</option>
                    <option value="FREE_SHIPPING">FREE SHIPPING</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Value</label>
                  <input
                    type="number"
                    disabled={couponForm.type === 'FREE_SHIPPING'}
                    value={couponForm.value}
                    onChange={(e) => setCouponForm({ ...couponForm, value: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Min Order INR (₹)</label>
                  <input
                    type="number"
                    value={couponForm.minOrderINR}
                    onChange={(e) => setCouponForm({ ...couponForm, minOrderINR: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Max Total Uses</label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={couponForm.maxUsesTotal}
                    onChange={(e) => setCouponForm({ ...couponForm, maxUsesTotal: e.target.value === '' ? '' : Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Max Uses Per User</label>
                  <input
                    type="number"
                    value={couponForm.maxUsesPerUser}
                    onChange={(e) => setCouponForm({ ...couponForm, maxUsesPerUser: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                  <input
                    type="checkbox"
                    id="couponActive"
                    checked={couponForm.isActive}
                    onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })}
                    style={{ width: '16px', height: '16px', accentColor: '#C9A84C', cursor: 'pointer' }}
                  />
                  <label htmlFor="couponActive" style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', cursor: 'pointer' }}>Is Active</label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Valid From</label>
                  <input
                    type="datetime-local"
                    value={couponForm.validFrom}
                    onChange={(e) => setCouponForm({ ...couponForm, validFrom: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '9px', color: '#666', textTransform: 'uppercase', marginBottom: '6px' }}>Valid Until (Expiry)</label>
                  <input
                    type="datetime-local"
                    value={couponForm.validUntil}
                    onChange={(e) => setCouponForm({ ...couponForm, validUntil: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontSize: '12px', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'end' }}>
                <button
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  style={{ padding: '8px 16px', background: 'none', border: '1px solid #333', color: '#aaa', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={couponSubmitting}
                  style={{ padding: '8px 18px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  {couponSubmitting ? 'SAVING...' : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
