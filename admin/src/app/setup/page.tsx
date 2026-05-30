'use client';

import React, { useState, useEffect } from 'react';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

export default function SetupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if setup is already complete
    fetch(`${BACKEND_URL}/admin/setup/status`)
      .then(res => res.json())
      .then(data => {
        if (data.setupComplete) {
          // If setup is already complete, redirect to main login page
          window.location.href = '/';
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 20) {
      setError('Username must be alphanumeric or underscore, between 3 and 20 characters.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/admin/setup/create-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, username, password, confirmPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Owner setup failed');
      }

      // Auto login owner
      localStorage.setItem('admin_token', data.accessToken);
      localStorage.setItem('admin_user', JSON.stringify(data.user));

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'An error occurred during setup.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', color: '#666', fontFamily: 'monospace' }}>
        VERIFYING STORE STATE...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0a0a', fontFamily: 'IBM Plex Mono, monospace', color: '#e0e0e0', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '40px 30px', background: '#111', border: '1px solid #222', borderRadius: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        
        {/* Logo / Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '35px' }}>
          <img src="/logo.png" alt="Rajshree Jewels Logo" style={{ height: '70px', width: 'auto', margin: '0 auto 15px auto', display: 'block' }} />
          <h1 style={{ color: '#C9A84C', fontSize: '22px', letterSpacing: '2px', fontWeight: 'bold', margin: '0 0 5px 0' }}>RAJSHREE JEWELS</h1>
          <p style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>Initial System Configuration</p>
        </div>

        <div style={{ borderTop: '1px solid #222', paddingTop: '20px', marginBottom: '25px' }}>
          <h2 style={{ fontSize: '15px', color: '#fff', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>Welcome. Let's set up your store.</h2>
          <p style={{ fontSize: '12px', color: '#666', lineHeight: '1.5', margin: 0 }}>Create the owner account. This can never be deleted or demoted and holds permanent administrative privileges.</p>
        </div>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px', borderRadius: '4px', marginBottom: '20px' }}>
            ERROR: {error.toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Full Name</label>
            <input
              type="text"
              value={name}
              placeholder="e.g. Rajshree Sharma"
              onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Email Address</label>
            <input
              type="email"
              value={email}
              placeholder="owner@rajshreejewels.com"
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Username</label>
            <input
              type="text"
              value={username}
              placeholder="alphanumeric_or_underscore"
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Password (min 10 chars)</label>
            <input
              type="password"
              value={password}
              placeholder="••••••••••••"
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              placeholder="••••••••••••"
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '12px', background: '#C9A84C', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'inherit', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'background-color 0.2s' }}
          >
            {loading ? 'CREATING ACCOUNT...' : 'INITIALIZE OWNER ACCOUNT'}
          </button>
        </form>
      </div>
    </div>
  );
}
