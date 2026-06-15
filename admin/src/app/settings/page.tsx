'use client';

import React, { useState, useEffect } from 'react';

/* ── Eye icons ───────────────────────────────────────────────── */
function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({
    store_name: '',
    store_tagline: '',
    store_phone: '',
    store_email: '',
    shipping_free_above_inr: '',
    shipping_flat_rate_inr: '',
    cod_enabled: 'false',
    announcement_banner: '',
    whatsapp_number: '',
    instagram_url: '',
    facebook_url: '',
  });

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Partial changes detection original state
  const [originalSettings, setOriginalSettings] = useState<Record<string, string>>({});

  // Security password modification state
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [securityLoading, setSecurityLoading] = useState(false);

  // Password reveal toggles for security panel
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      if (!token) return;

      const res = await fetch(`${BACKEND_URL}/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Failed to load settings');

      const data = await res.json();
      setSettings((prev) => ({
        ...prev,
        ...data,
      }));
      setOriginalSettings(data);
    } catch (err: any) {
      setError(err.message || 'Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);

    try {
      const token = localStorage.getItem('admin_token');

      // Submit only changed fields (Part 6)
      const changes: Record<string, string> = {};
      for (const key in settings) {
        if (settings[key] !== originalSettings[key]) {
          changes[key] = settings[key];
        }
      }

      if (Object.keys(changes).length === 0) {
        showSuccess('No changes to save');
        setSaveLoading(false);
        return;
      }

      const res = await fetch(`${BACKEND_URL}/admin/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(changes)
      });

      if (!res.ok) throw new Error('Failed to save settings');

      showSuccess('Site settings successfully synchronized');
      fetchSettings();
    } catch (err: any) {
      showError(err.message || 'Failed to save settings');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityForm.currentPassword || !securityForm.newPassword || !securityForm.confirmPassword) {
      showError('All password fields are required');
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    if (securityForm.newPassword.length < 10) {
      showError('Password must be at least 10 characters');
      return;
    }
    
    setSecurityLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${BACKEND_URL}/admin/profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: securityForm.currentPassword,
          newPassword: securityForm.newPassword,
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'INCORRECT_CURRENT_PASSWORD') {
          throw new Error('Current password entered is incorrect');
        }
        throw new Error(data.message || 'Failed to update password');
      }

      showSuccess('🎉 Password updated successfully!');
      setSecurityForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      showError(err.message || 'Failed to change password');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return <div style={{ color: '#666', fontFamily: 'monospace' }}>SYNCHRONIZING SITE SCHEMA...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Global Configuration</h2>
        <div style={{ fontSize: '12px', color: '#666' }}>Manage store features & defaults</div>
      </div>

      <form onSubmit={handleSaveSettings} style={{ maxWidth: '800px', marginBottom: '60px' }}>
        {/* Store Information */}
        <div style={{ padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Store Details
          </h3>
          <div className="form-group">
            <label className="form-label">Store Name</label>
            <input
              type="text"
              value={settings.store_name}
              onChange={(e) => handleChange('store_name', e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Store Tagline</label>
            <input
              type="text"
              value={settings.store_tagline}
              onChange={(e) => handleChange('store_tagline', e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Email</label>
              <input
                type="email"
                value={settings.store_email}
                onChange={(e) => handleChange('store_email', e.target.value)}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="text"
                value={settings.store_phone}
                onChange={(e) => handleChange('store_phone', e.target.value)}
                className="form-control"
              />
            </div>
          </div>
        </div>

        {/* Shipping configurations */}
        <div style={{ padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Shipping & Fulfillment (INR)
          </h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Free Shipping Threshold (₹)</label>
              <input
                type="number"
                value={settings.shipping_free_above_inr}
                onChange={(e) => handleChange('shipping_free_above_inr', e.target.value)}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Flat Rate Shipping Cost (₹)</label>
              <input
                type="number"
                value={settings.shipping_flat_rate_inr}
                onChange={(e) => handleChange('shipping_flat_rate_inr', e.target.value)}
                className="form-control"
              />
            </div>
          </div>
        </div>

        {/* Payment and Promotion parameters */}
        <div style={{ padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Payments & Promotions
          </h3>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '24px' }}>
            <input
              type="checkbox"
              id="cod_enabled_checkbox"
              checked={settings.cod_enabled === 'true'}
              onChange={(e) => handleChange('cod_enabled', e.target.checked ? 'true' : 'false')}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
            />
            <label htmlFor="cod_enabled_checkbox" style={{ fontSize: '13px', color: '#fff', cursor: 'pointer', userSelect: 'none' }}>
              <strong>Enable Cash on Delivery (COD) Option</strong>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Announcement Top Banner Text (leave blank to hide)</label>
            <input
              type="text"
              placeholder="e.g. Free shipping on orders above ₹999!"
              value={settings.announcement_banner}
              onChange={(e) => handleChange('announcement_banner', e.target.value)}
              className="form-control"
            />
          </div>
        </div>

        {/* Social channels details */}
        <div style={{ padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', marginBottom: '30px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
            Social Channels & Support
          </h3>
          <div className="form-group">
            <label className="form-label">WhatsApp Contact Number (10 digits, e.g. 9876543210)</label>
            <input
              type="text"
              maxLength={10}
              value={settings.whatsapp_number}
              onChange={(e) => handleChange('whatsapp_number', e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Instagram URL</label>
            <input
              type="url"
              value={settings.instagram_url}
              onChange={(e) => handleChange('instagram_url', e.target.value)}
              className="form-control"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Facebook URL</label>
            <input
              type="url"
              value={settings.facebook_url}
              onChange={(e) => handleChange('facebook_url', e.target.value)}
              className="form-control"
            />
          </div>
        </div>

        {/* Save button CTA */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saveLoading} className="btn btn-primary" style={{ padding: '12px 30px', fontSize: '13px' }}>
            {saveLoading ? 'Syncing...' : 'Save Site Settings'}
          </button>
        </div>
      </form>

      {/* Security / Password modification panel */}
      <div style={{ padding: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '4px', maxWidth: '800px', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '13px', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
          Change Administrative Password
        </h3>
        <form onSubmit={handlePasswordChange}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={securityForm.currentPassword}
                onChange={(e) => setSecurityForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                className="form-control"
                placeholder="Enter current password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', padding: '2px' }}
              >
                {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">New Password (minimum 10 characters)</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  minLength={10}
                  value={securityForm.newPassword}
                  onChange={(e) => setSecurityForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="form-control"
                  placeholder="Enter new password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  {showNew ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={securityForm.confirmPassword}
                  onChange={(e) => setSecurityForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="form-control"
                  placeholder="Confirm new password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', padding: '2px' }}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" disabled={securityLoading} className="btn btn-secondary" style={{ padding: '10px 20px', fontSize: '12px' }}>
              {securityLoading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Global Success and Error toast status notifications */}
      <div className="toast-container">
        {successToast && <div className="toast toast-success">{successToast}</div>}
        {errorToast && <div className="toast toast-error">{errorToast}</div>}
      </div>
    </div>
  );
}
