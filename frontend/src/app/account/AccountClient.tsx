'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signOut, useSession } from 'next-auth/react';
import ProductCard from '../../components/product/ProductCard';
import { Product } from '../../types';
import { apiClient } from '../../lib/api';

interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface AccountClientProps {
  sessionUser: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    accessToken: string;
    isVerified?: boolean;
  };
}

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  phone: z.string().trim().min(10, 'Phone must be at least 10 digits'),
});

const addressSchema = z.object({
  label: z.string().trim().min(1, 'Label is required'),
  name: z.string().trim().min(2, 'Recipient name is required'),
  phone: z.string().trim().min(10, 'Phone number is required'),
  line1: z.string().trim().min(5, 'Address must be at least 5 characters'),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, 'City is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  isDefault: z.boolean(),
});

type ProfileFields = z.infer<typeof profileSchema>;
type AddressFields = z.infer<typeof addressSchema>;

export default function AccountClient({ sessionUser }: AccountClientProps) {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const [activeTab, setActiveTab] = useState<'profile' | 'addresses' | 'orders' | 'wishlist' | 'payment-methods'>('profile');
  const [user, setUser] = useState(sessionUser);
  const [freshUser, setFreshUser] = useState<any | null>(null);
  const isVerified = freshUser?.isVerified ?? session?.user?.isVerified ?? user.isVerified ?? false;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Saved Payment Methods states
  const [savedUpis, setSavedUpis] = useState<any[]>([]);
  const [recentUsedMethods, setRecentUsedMethods] = useState<any[]>([]);
  const [upisLoading, setUpisLoading] = useState(false);
  const [newUpiId, setNewUpiId] = useState('');
  const [newUpiLabel, setNewUpiLabel] = useState('');

  const fetchPaymentMethods = async () => {
    setUpisLoading(true);
    try {
      const res = await apiClient('/users/me/payment-methods', {}, token);
      if (res.ok) {
        const data = await res.json();
        setSavedUpis(data.savedUpis || []);
        setRecentUsedMethods(data.recentUsedMethods || []);
      }
    } catch (_) {}
    setUpisLoading(false);
  };

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUpiId.trim()) {
      triggerAlert('UPI ID is required', 'error');
      return;
    }
    if (!/^[\w.-]+@[\w.-]+$/.test(newUpiId.trim())) {
      triggerAlert('Please enter a valid UPI ID (e.g. user@okaxis)', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient('/users/me/payment-methods', {
        method: 'POST',
        body: JSON.stringify({ upiId: newUpiId.trim(), label: newUpiLabel.trim() || undefined }),
      }, token);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to save UPI handle');
      
      triggerAlert('✨ Payment method saved successfully!');
      setNewUpiId('');
      setNewUpiLabel('');
      fetchPaymentMethods();
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to save payment method', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUpi = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved UPI handle?')) return;
    setLoading(true);
    try {
      const res = await apiClient(`/users/me/payment-methods/${id}`, {
        method: 'DELETE',
      }, token);
      if (!res.ok) throw new Error('Failed to delete payment method');
      triggerAlert('Payment method deleted successfully');
      fetchPaymentMethods();
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to delete payment method', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefaultUpi = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiClient(`/users/me/payment-methods/${id}/default`, {
        method: 'PUT',
      }, token);
      if (!res.ok) throw new Error('Failed to set default payment method');
      triggerAlert('✨ Default payment method updated');
      fetchPaymentMethods();
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to set default payment method', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Email verification status banner states
  const [showBanner, setShowBanner] = useState(true);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationOtp, setVerificationOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const sendVerificationEmail = async () => {
    setSendingVerification(true);
    try {
      const res = await fetch('/api/v1/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      setOtpSent(true);
      triggerAlert('✨ Verification email sent successfully!');
      if (data.debugOtp) {
        console.log(`✨ Debug OTP: ${data.debugOtp}`);
      }
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to send verification email', 'error');
    } finally {
      setSendingVerification(false);
    }
  };

  const fetchFreshUser = async () => {
    try {
      const res = await apiClient('/users/me', {}, token);
      if (res.ok) {
        const data = await res.json();
        setFreshUser(data);
        setUser((prev) => ({
          ...prev,
          isVerified: data.isVerified,
          name: data.name || prev.name,
          phone: data.phone || prev.phone,
        }));
      }
    } catch (_) {}
  };

  const handleVerifyOtp = async () => {
    if (verificationOtp.length !== 6) {
      triggerAlert('Please enter a 6-digit code', 'error');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await fetch('/api/v1/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otp: verificationOtp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      
      // Fetch fresh user details to instantly refresh verified state in UI
      await fetchFreshUser();
      setFreshUser((u: any) => u ? { ...u, isVerified: true } : u);
      triggerAlert('🎉 Email verified successfully!');
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to verify OTP', 'error');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Address form collapse states
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const { register: regProfile, handleSubmit: handleProfileSave, formState: { errors: errorsProfile }, reset: resetProfile } = useForm<ProfileFields>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name, phone: user.phone || '' },
  });

  const { register: regAddress, handleSubmit: handleAddressSave, formState: { errors: errorsAddress }, reset: resetAddress, setValue: setAddressValue } = useForm<AddressFields>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      label: 'Home',
      name: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      isDefault: false,
    },
  });

  // Fetch address and wishlist details on mount
  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    fetchFreshUser();
    fetchAddresses();
    fetchWishlist();
  }, [status, session?.accessToken]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken) return;
    if (activeTab === 'orders') {
      fetchOrders();
    } else if (activeTab === 'payment-methods') {
      fetchPaymentMethods();
    }
  }, [status, session?.accessToken, activeTab]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await apiClient('/orders/my', {}, token);
      if (res.ok) {
        const data = await res.json();
        setOrders(data || []);
      }
    } catch (_) {}
    setOrdersLoading(false);
  };

  const triggerAlert = (msg: string, type: 'success' | 'error' = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchAddresses = async () => {
    try {
      const res = await apiClient('/users/me', {}, token);
      if (res.ok) {
        const data = await res.json();
        setAddresses(data.addresses || []);
        if (data.isVerified !== undefined) {
          setUser((prev) => ({ ...prev, isVerified: data.isVerified }));
        }
      }
    } catch (_) {}
  };

  const fetchWishlist = async () => {
    try {
      const res = await apiClient('/users/me/wishlist', {}, token);
      if (res.ok) {
        const data = await res.json();
        setWishlist(data || []);
      }
    } catch (_) {}
  };

  // Profile Save
  const onProfileSubmit = async (data: ProfileFields) => {
    setLoading(true);
    try {
      const res = await apiClient('/users/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      }, token);

      if (!res.ok) throw new Error('Failed to update profile');
      const updated = await res.json();
      setUser((prev) => ({ ...prev, name: updated.name, phone: updated.phone }));
      triggerAlert('✨ Profile updated successfully!');
    } catch (err: any) {
      triggerAlert(err.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Address Create/Update
  const onAddressSubmit = async (data: AddressFields) => {
    setLoading(true);
    try {
      const endpoint = editingAddressId
        ? `/users/me/addresses/${editingAddressId}`
        : '/users/me/addresses';

      const method = editingAddressId ? 'PUT' : 'POST';

      const res = await apiClient(endpoint, {
        method,
        body: JSON.stringify(data),
      }, token);

      if (!res.ok) throw new Error('Failed to save address');
      
      triggerAlert(editingAddressId ? 'Address updated!' : 'Address added successfully!');
      fetchAddresses();
      resetAddress();
      setShowAddressForm(false);
      setEditingAddressId(null);
    } catch (err: any) {
      triggerAlert(err.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Edit address trigger (collapses form and populates it)
  const startEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressValue('label', addr.label);
    setAddressValue('name', addr.name);
    setAddressValue('phone', addr.phone);
    setAddressValue('line1', addr.line1);
    setAddressValue('line2', addr.line2 || '');
    setAddressValue('city', addr.city);
    setAddressValue('state', addr.state);
    setAddressValue('pincode', addr.pincode);
    setAddressValue('isDefault', addr.isDefault);
    setShowAddressForm(true);
  };

  // Set default address
  const handleSetDefaultAddress = async (id: string) => {
    try {
      const res = await apiClient(`/users/me/addresses/${id}/default`, {
        method: 'PUT',
      }, token);
      if (!res.ok) throw new Error('Failed');
      triggerAlert('Default address updated!');
      fetchAddresses();
    } catch (_) {
      triggerAlert('Failed to update default address', 'error');
    }
  };

  // Delete address
  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      const res = await apiClient(`/users/me/addresses/${id}`, {
        method: 'DELETE',
      }, token);
      if (!res.ok) throw new Error('Failed');
      triggerAlert('Address deleted successfully!');
      fetchAddresses();
    } catch (_) {
      triggerAlert('Failed to delete address', 'error');
    }
  };

  // Remove from Wishlist
  const handleRemoveWishlist = async (productId: string) => {
    try {
      const res = await apiClient(`/users/me/wishlist/${productId}`, {
        method: 'DELETE',
      }, token);
      if (!res.ok) throw new Error('Failed');
      triggerAlert('Item removed from wishlist');
      fetchWishlist();
    } catch (_) {
      triggerAlert('Failed to remove item', 'error');
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 font-body space-y-10 relative">
      {/* Alert toast */}
      {alert && (
        <div className={`fixed top-24 left-1/2 transform -translate-x-1/2 z-50 border py-3 px-6 rounded-card shadow-2xl animate-bounce text-xs font-semibold uppercase tracking-wider ${alert.type === 'success' ? 'bg-[#2D7A3A]/10 border-[#2D7A3A] text-[#2D7A3A]' : 'bg-error-custom/10 border-error-custom text-error-custom'}`}>
          {alert.msg}
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-custom pb-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-wide">My Account</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Welcome back, <span className="font-bold text-accent">{user.name}</span>. Manage your elegant profile, shipping books and wishlists.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="border border-border-custom hover:border-accent hover:text-accent font-semibold px-5 py-2 rounded-card text-2xs uppercase tracking-wider"
        >
          Logout
        </button>
      </div>

      {showBanner && !isVerified && freshUser !== null && (
        <div className="bg-[#FFF5F5] border border-[#D4A0A0] rounded-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm animate-fade-in font-body">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-[#8B1A1A] uppercase tracking-wide">Email Verification Required</h4>
            <p className="text-xs text-text-muted">Verify your email address to secure your account and seamlessly complete checkouts.</p>
            
            {otpSent && (
              <div className="flex items-center gap-3 mt-3">
                <input
                  type="text"
                  maxLength={6}
                  value={verificationOtp}
                  onChange={(e) => setVerificationOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit OTP"
                  className="bg-surface border border-border-custom rounded-card py-1.5 px-3 focus:outline-none focus:border-accent text-center font-bold font-mono tracking-widest text-xs w-36"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp}
                  className="luxury-btn py-1.5 px-4 rounded-card text-2xs font-bold uppercase tracking-wider disabled:opacity-55"
                >
                  {verifyingOtp ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {!otpSent && (
              <button
                onClick={sendVerificationEmail}
                disabled={sendingVerification}
                className="text-xs font-bold text-[#8B1A1A] hover:underline uppercase tracking-wider"
              >
                {sendingVerification ? 'Sending...' : 'Verify Now →'}
              </button>
            )}
            <button
              onClick={() => setShowBanner(false)}
              className="text-[#7a5c5c] hover:text-primary text-xs font-bold uppercase tracking-wider"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Tabs layout */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="flex flex-col space-y-2 bg-surface-2 border border-border-custom p-4 rounded-card h-fit shadow-sm">
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full text-left py-2.5 px-4 rounded-card text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'profile' ? 'bg-primary text-surface' : 'text-text-muted hover:text-accent hover:bg-surface'}`}
          >
            Profile Details
          </button>
          <button
            onClick={() => setActiveTab('addresses')}
            className={`w-full text-left py-2.5 px-4 rounded-card text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'addresses' ? 'bg-primary text-surface' : 'text-text-muted hover:text-accent hover:bg-surface'}`}
          >
            Address Book
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`w-full text-left py-2.5 px-4 rounded-card text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'orders' ? 'bg-primary text-surface' : 'text-text-muted hover:text-accent hover:bg-surface'}`}
          >
            My Orders
          </button>
          <button
            onClick={() => setActiveTab('wishlist')}
            className={`w-full text-left py-2.5 px-4 rounded-card text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'wishlist' ? 'bg-primary text-surface' : 'text-text-muted hover:text-accent hover:bg-surface'}`}
          >
            My Wishlist
          </button>
          <button
            onClick={() => setActiveTab('payment-methods')}
            className={`w-full text-left py-2.5 px-4 rounded-card text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'payment-methods' ? 'bg-primary text-surface' : 'text-text-muted hover:text-accent hover:bg-surface'}`}
          >
            Saved Payments
          </button>
        </div>

        {/* Dynamic Panels */}
        <div className="md:col-span-3">
          
          {/* A. PROFILE DETAILS TAB */}
          {activeTab === 'profile' && (
            <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-sm space-y-6">
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide border-b border-border-custom/50 pb-3">
                Profile Details
              </h2>
              
              <form onSubmit={handleProfileSave(onProfileSubmit)} className="space-y-4 text-xs max-w-md">
                <div className="space-y-1">
                  <label className="font-semibold text-primary uppercase tracking-wide">Email Address</label>
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full bg-surface/50 border border-border-custom/55 rounded-card py-2.5 px-4 cursor-not-allowed text-text-muted"
                  />
                  <p className="text-3xs text-text-muted italic">Email address cannot be changed once verified.</p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-primary uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    {...regProfile('name')}
                    className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text font-medium"
                  />
                  {errorsProfile.name && (
                    <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errorsProfile.name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-primary uppercase tracking-wide">Phone Number</label>
                  <input
                    type="tel"
                    {...regProfile('phone')}
                    className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-text font-medium"
                  />
                  {errorsProfile.phone && (
                    <p className="text-error-custom text-2xs font-semibold uppercase tracking-wide mt-1">{errorsProfile.phone.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="luxury-btn py-3 px-8 rounded-card text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-55"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}

          {/* B. ADDRESS BOOK TAB */}
          {activeTab === 'addresses' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-surface-2 border border-border-custom px-6 py-4 rounded-card shadow-sm">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">Shipping Address Book</h2>
                <button
                  onClick={() => {
                    setEditingAddressId(null);
                    resetAddress();
                    setShowAddressForm(!showAddressForm);
                  }}
                  className="luxury-btn text-2xs uppercase tracking-widest font-bold py-2 px-4 rounded-card"
                >
                  {showAddressForm ? 'Cancel' : 'Add New'}
                </button>
              </div>

              {/* Collapsible address creation/edit form */}
              {showAddressForm && (
                <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-card space-y-4 animate-fade-in text-xs">
                  <h3 className="font-display text-lg font-bold uppercase tracking-wide border-b border-border-custom/50 pb-2">
                    {editingAddressId ? 'Edit Address' : 'Add New Address'}
                  </h3>
                  
                  <form onSubmit={handleAddressSave(onAddressSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Address Label</label>
                      <input
                        type="text"
                        {...regAddress('label')}
                        placeholder="e.g. Home, Office"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.label && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.label.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Recipient Name</label>
                      <input
                        type="text"
                        {...regAddress('name')}
                        placeholder="Recipient full name"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.name && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.name.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Contact Phone</label>
                      <input
                        type="tel"
                        {...regAddress('phone')}
                        placeholder="10 digit phone number"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.phone && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.phone.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Pincode</label>
                      <input
                        type="text"
                        maxLength={6}
                        {...regAddress('pincode')}
                        placeholder="6 digit postal pincode"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent font-mono"
                      />
                      {errorsAddress.pincode && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.pincode.message}</p>}
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Address Line 1</label>
                      <input
                        type="text"
                        {...regAddress('line1')}
                        placeholder="House no, Building, Street address"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.line1 && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.line1.message}</p>}
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        {...regAddress('line2')}
                        placeholder="Apartment, Landmark, Locality"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">City</label>
                      <input
                        type="text"
                        {...regAddress('city')}
                        placeholder="City"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.city && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.city.message}</p>}
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-primary uppercase tracking-wide">State</label>
                      <input
                        type="text"
                        {...regAddress('state')}
                        placeholder="State"
                        className="w-full bg-surface border border-border-custom rounded-card py-2 px-3 focus:outline-none focus:border-accent"
                      />
                      {errorsAddress.state && <p className="text-error-custom text-2xs mt-1 font-semibold uppercase">{errorsAddress.state.message}</p>}
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-2 py-2">
                      <input
                        type="checkbox"
                        {...regAddress('isDefault')}
                        className="accent-accent h-4 w-4"
                      />
                      <label className="font-semibold text-primary uppercase tracking-wide cursor-pointer">Set as default shipping address</label>
                    </div>

                    <div className="sm:col-span-2 pt-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="luxury-btn py-3 px-8 rounded-card text-xs font-bold uppercase tracking-widest transition-all"
                      >
                        {loading ? 'Saving...' : 'Save Address'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Address List */}
              {addresses.length === 0 ? (
                <div className="text-center py-10 bg-surface-2 border border-border-custom rounded-card text-text-muted text-xs">
                  No saved addresses found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`bg-surface-2 border rounded-card p-6 flex flex-col justify-between space-y-4 shadow-sm hover:shadow transition-all relative ${addr.isDefault ? 'border-accent ring-1 ring-accent/15' : 'border-border-custom'}`}
                    >
                      {/* Badge / label */}
                      <div className="flex justify-between items-start">
                        <span className="font-display font-semibold uppercase tracking-wider text-xs border-b border-accent pb-0.5">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="bg-[#2D7A3A]/10 text-[#2D7A3A] px-2 py-0.5 text-[9px] font-bold uppercase rounded">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-text-muted leading-relaxed font-body">
                        <p className="font-bold text-primary text-sm mb-1">{addr.name}</p>
                        <p className="font-mono text-2xs">{addr.phone}</p>
                        <p className="mt-2">{addr.line1}</p>
                        {addr.line2 && <p>{addr.line2}</p>}
                        <p>{addr.city}, {addr.state} - <span className="font-mono font-semibold">{addr.pincode}</span></p>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-4 border-t border-border-custom/50 text-[10px] uppercase font-bold tracking-wider">
                        <div className="flex gap-4">
                          <button onClick={() => startEditAddress(addr)} className="text-text hover:text-accent">
                            Edit
                          </button>
                          <button onClick={() => handleDeleteAddress(addr.id)} className="text-error-custom hover:underline">
                            Delete
                          </button>
                        </div>
                        {!addr.isDefault && (
                          <button onClick={() => handleSetDefaultAddress(addr.id)} className="text-accent hover:underline">
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* C. MY ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-sm space-y-6">
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide border-b border-border-custom/50 pb-3 text-left">
                My Orders
              </h2>
              {ordersLoading ? (
                <div className="text-center py-12 text-xs text-text-muted animate-pulse">SYNCHRONIZING SECURE LEDGER...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16 text-text-muted text-xs space-y-4">
                  <svg className="h-10 w-10 text-text-muted/30 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>You have not placed any orders yet. Discover unique creations in our shop!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-border-custom hover:border-accent rounded-card p-5 bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all"
                    >
                      <div className="flex gap-4 items-center">
                        <img
                          src={order.product?.primaryImageUrl ? order.product.primaryImageUrl : '/placeholder.jpg'}
                          alt={order.product?.displayName}
                          className="w-16 h-16 object-cover rounded border border-border-custom bg-surface-2"
                        />
                        <div>
                          <p className="font-mono text-2xs text-text-muted">#{order.orderNumber}</p>
                          <p className="font-semibold text-primary text-sm mt-1">{order.product?.displayName}</p>
                          <p className="text-3xs text-text-muted mt-1">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end w-full sm:w-auto gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-border-custom/50">
                        <div>
                          <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded tracking-wide ${
                            order.status === 'CONFIRMED' || order.status === 'PROCESSING' ? 'bg-amber-100 text-amber-800' :
                            order.status === 'SHIPPED' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED' ? 'bg-rose-100 text-rose-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="flex gap-4 items-center">
                          <p className="font-bold text-accent text-sm">₹{order.totalINR.toLocaleString('en-IN')}</p>
                          <a
                            href={`/account/orders/${order.id}`}
                            className="border border-border-custom hover:border-accent text-text hover:text-accent font-semibold px-4 py-1.5 rounded-card text-[10px] uppercase tracking-widest transition-all"
                          >
                            Details
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* D. WISHLIST TAB */}
          {activeTab === 'wishlist' && (
            <div className="space-y-6">
              <div className="bg-surface-2 border border-border-custom px-6 py-4 rounded-card shadow-sm">
                <h2 className="font-display text-xl font-bold uppercase tracking-wide">My Saved Pieces</h2>
              </div>

              {wishlist.length === 0 ? (
                <div className="text-center py-12 bg-surface-2 border border-border-custom rounded-card text-text-muted text-xs">
                  Your wishlist is empty. Discover gorgeous physical creations to save!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {wishlist.map((product) => (
                    <div key={product.id} className="relative group flex flex-col justify-between bg-surface border border-border-custom rounded-card overflow-hidden">
                      <div className="flex-grow">
                        <ProductCard product={product} />
                      </div>
                      <div className="p-4 pt-0 bg-surface-2/45">
                        <button
                          onClick={() => handleRemoveWishlist(product.id)}
                          className="w-full py-2 bg-error-custom/10 hover:bg-error-custom hover:text-white border border-error-custom/40 text-error-custom text-[10px] uppercase tracking-wider font-bold rounded-card transition-all"
                        >
                          Remove from Wishlist
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* E. SAVED PAYMENT METHODS TAB */}
          {activeTab === 'payment-methods' && (
            <div className="bg-surface-2 border border-border-custom p-8 rounded-card shadow-sm space-y-8 animate-fade-in font-body">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide border-b border-border-custom/50 pb-3 text-left">
                  Saved Payments
                </h2>
                <p className="text-2xs text-text-muted mt-2 leading-relaxed text-left">
                  Manage saved PCI-compliant VPA addresses and view recent payment preferences for rapid checkouts.
                </p>
              </div>

              {/* Add New UPI Form */}
              <div className="bg-surface border border-border-custom p-6 rounded-card space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-accent text-left">
                  + Add New UPI Handle
                </h3>
                <form onSubmit={handleSaveUpi} className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1 text-left">
                    <label className="font-semibold text-primary uppercase tracking-wide text-3xs">UPI ID / Virtual Address</label>
                    <input
                      type="text"
                      value={newUpiId}
                      onChange={(e) => setNewUpiId(e.target.value)}
                      placeholder="e.g. name@okaxis"
                      className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-xs"
                    />
                  </div>
                  <div className="space-y-1 text-left">
                    <label className="font-semibold text-primary uppercase tracking-wide text-3xs">Label (Optional)</label>
                    <input
                      type="text"
                      value={newUpiLabel}
                      onChange={(e) => setNewUpiLabel(e.target.value)}
                      placeholder="e.g. PhonePe Personal"
                      className="w-full bg-surface border border-border-custom rounded-card py-2.5 px-4 focus:outline-none focus:border-accent text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2 pt-2 text-left">
                    <button
                      type="submit"
                      disabled={loading}
                      className="luxury-btn py-3 px-8 rounded-card text-xs font-bold uppercase tracking-widest transition-all"
                    >
                      {loading ? 'Saving...' : 'Save UPI Address'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Saved UPI Handles List */}
              <div className="space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-left">
                  Saved UPI Addresses
                </h3>
                {upisLoading ? (
                  <div className="text-center py-6 text-xs text-text-muted animate-pulse">DECRYPTING SAVED WALLETS...</div>
                ) : savedUpis.length === 0 ? (
                  <div className="text-center py-8 bg-surface border border-border-custom rounded-card text-text-muted text-xs text-left">
                    No saved UPI addresses found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {savedUpis.map((upi) => (
                      <div
                        key={upi.id}
                        className={`bg-surface border rounded-card p-5 flex flex-col justify-between space-y-3 shadow-sm hover:shadow transition-all relative ${upi.isDefault ? 'border-accent ring-1 ring-accent/15' : 'border-border-custom'}`}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-display font-semibold uppercase tracking-wider text-2xs border-b border-accent pb-0.5">
                            {upi.label || 'UPI Handle'}
                          </span>
                          {upi.isDefault && (
                            <span className="bg-[#2D7A3A]/10 text-[#2D7A3A] px-2 py-0.5 text-[9px] font-bold uppercase rounded">
                              Default
                            </span>
                          )}
                        </div>

                        <div className="text-left font-mono font-bold text-accent text-sm py-1 truncate">
                          {upi.upiId}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-border-custom/50 text-[10px] uppercase font-bold tracking-wider">
                          <button onClick={() => handleDeleteUpi(upi.id)} className="text-error-custom hover:underline">
                            Delete
                          </button>
                          {!upi.isDefault && (
                            <button onClick={() => handleSetDefaultUpi(upi.id)} className="text-accent hover:underline">
                              Set Default
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Payment Modes */}
              <div className="space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-left">
                  Recent Payment Preferences
                </h3>
                {recentUsedMethods.length === 0 ? (
                  <div className="text-center py-6 bg-surface border border-border-custom rounded-card text-text-muted text-xs text-left">
                    No recent transaction records discovered.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-4">
                    {recentUsedMethods.map((um) => (
                      <div
                        key={um.method}
                        className="bg-surface border border-border-custom rounded-card py-3 px-5 flex items-center gap-3 shadow-sm"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-accent"></span>
                        <div className="text-left">
                          <p className="font-bold text-xs uppercase text-primary">{um.method}</p>
                          <p className="text-3xs text-text-muted mt-0.5">Last used: {new Date(um.lastUsed).toLocaleDateString('en-IN')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
