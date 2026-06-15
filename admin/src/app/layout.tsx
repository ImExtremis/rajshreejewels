'use client';

import React, { useState, useEffect } from 'react';
import './globals.css';

const BACKEND_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/v1` : 'http://backend:4000/api/v1');

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unrepliedCount, setUnrepliedCount] = useState<number>(0);
  const [unverifiedCount, setUnverifiedCount] = useState<number>(0);
  const [backendDown, setBackendDown] = useState<boolean>(false);

  // Login form state
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  useEffect(() => {
    // AbortController gives us a 5-second timeout so the loading screen
    // never gets stuck when the backend is slow or down
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const savedToken = localStorage.getItem('admin_token');

    const initApp = async () => {
      try {
        if (savedToken) {
          // Fetch unified setup status, user profile, and operational console analytics
          const res = await fetch(`${BACKEND_URL}/admin/init`, {
            headers: { 'Authorization': `Bearer ${savedToken}` },
            signal: controller.signal
          });

          if (!res.ok) {
            if (res.status === 401 || res.status === 403) {
              handleLogout();
              throw new Error('Session invalid');
            }
            throw new Error('Failed to load init stats');
          }

          const data = await res.json();
          clearTimeout(timeoutId);

          // Update setup status complete
          const currentPath = window.location.pathname;
          if (!data.setupStatus.setupComplete) {
            if (currentPath !== '/setup') {
              window.location.href = '/setup';
              return;
            }
          } else if (currentPath === '/setup') {
            window.location.href = '/';
            return;
          }

          // Update logged-in user profile details & permissions
          setToken(savedToken);
          setIsAdmin(true);
          setIsOwner(!!data.user.isOwner);
          setPermissions(data.user.permissions);

          // Update sidebar badges from dashboard stats if available
          if (data.dashboardStats) {
            if (data.dashboardStats.unrepliedMessages !== undefined) {
              setUnrepliedCount(data.dashboardStats.unrepliedMessages);
            }
            if (data.dashboardStats.unverifiedCustomersCount !== undefined) {
              setUnverifiedCount(data.dashboardStats.unverifiedCustomersCount);
            }
          }
          setLoading(false);
        } else {
          // Fallback to standard check if user is not authenticated yet
          const res = await fetch(`${BACKEND_URL}/admin/setup/status`, { signal: controller.signal });
          if (!res.ok) {
            setBackendDown(true);
            setLoading(false);
            return;
          }
          const data = await res.json();
          clearTimeout(timeoutId);

          const currentPath = window.location.pathname;
          if (!data.setupComplete) {
            if (currentPath !== '/setup') {
              window.location.href = '/setup';
              return;
            }
          } else if (currentPath === '/setup') {
            window.location.href = '/';
            return;
          }
          setLoading(false);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name !== 'AbortError') {
          console.warn('[Admin] Init failed:', err.message);
        }
        setBackendDown(true);
        setLoading(false);
      }
    };

    initApp();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);


    try {
      const res = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (!data.user?.isAdmin) {
        setIsAdmin(false);
        setLoginError('Access denied. Admin privileges required.');
        return;
      }

      localStorage.setItem('admin_token', data.accessToken);
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      
      setToken(data.accessToken);
      setIsAdmin(true);
      setIsOwner(!!data.user?.isOwner);

      // Fetch profile and resolved permissions immediately
      const profileRes = await fetch(`${BACKEND_URL}/admin/me`, {
        headers: { 'Authorization': `Bearer ${data.accessToken}` }
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        setPermissions(profile.permissions);
        setIsOwner(!!profile.isOwner);
      }

      // Redirect to home dashboard
      window.location.href = '/';
    } catch (err: any) {
      setLoginError(err.message || 'Invalid email or password');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setIsAdmin(null);
    window.location.href = '/';
  };

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (loading) {
    return (
      <html lang="en">
        <body style={{ background: '#0a0a0a', color: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'monospace' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '13px', letterSpacing: '2px', color: '#C9A84C', marginBottom: '12px' }}>RAJSHREE JEWELS</div>
            <div style={{ fontSize: '11px', color: '#666', letterSpacing: '1px', animation: 'pulse 1.5s ease-in-out infinite' }}>CONNECTING TO API...</div>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
          </div>
        </body>
      </html>
    );
  }

  // If on `/setup` page, let it render directly (no login wall)
  if (currentPath === '/setup') {
    return (
      <html lang="en">
        <body style={{ background: '#0a0a0a', margin: 0, padding: 0 }}>
          {children}
        </body>
      </html>
    );
  }

  // Render Login Form if not logged in
  if (!token || !isAdmin) {
    return (
      <html lang="en">
        <body style={{ background: '#0a0a0a', margin: 0, padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'IBM Plex Mono, monospace', color: '#e0e0e0' }}>
            <div style={{ width: '400px', padding: '30px', background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1 style={{ color: '#C9A84C', fontSize: '20px', letterSpacing: '2px', fontWeight: 'bold', margin: '0 0 5px 0' }}>RAJSHREE JEWELS</h1>
                <p style={{ fontSize: '10px', color: '#666', marginTop: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Operations Center</p>
              </div>

              {backendDown && (
                <div style={{ padding: '10px 12px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.4)', color: '#f97316', fontSize: '11px', borderRadius: '2px', marginBottom: '20px', textAlign: 'center', letterSpacing: '0.5px' }}>
                  ⚠ API SERVER OFFLINE — START BACKEND ON PORT 4000
                </div>
              )}

              {isAdmin === false && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px', borderRadius: '2px', marginBottom: '20px', textAlign: 'center' }}>
                  ACCESS DENIED: ACCOUNT IS NOT ADMIN
                </div>
              )}

              {loginError && (
                <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px', borderRadius: '2px', marginBottom: '20px', textAlign: 'center' }}>
                  {loginError.toUpperCase()}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Email or Username</label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                  />
                </div>
 
                <div style={{ marginBottom: '30px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: '#666', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '10px 40px 10px 14px', background: '#0a0a0a', border: '1px solid #222', color: '#fff', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(v => !v)}
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      {showAdminPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn btn-gold"
                  style={{ width: '100%', padding: '12px' }}
                >
                  {loginLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '8px', color: '#b7b7b7', fontFamily: 'monospace', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Built by Haste Industries
                </span>
              </div>
            </div>

          </div>
        </body>
      </html>
    );
  }

  // Define dynamic permission evaluations
  const canViewAnalytics = isOwner || permissions?.['analytics.view'] === true;
  const canViewOrders = isOwner || permissions?.['orders.view'] === true;
  const canViewProducts = isOwner || permissions?.['listing.edit'] === true || permissions?.['listing.create'] === true;
  const canManageOffers = isOwner || permissions?.['finance.manage_coupons'] === true || permissions?.['finance.manage_sales'] === true;
  const canManageCollections = isOwner || permissions?.['listing.manage_collections'] === true;
  const canManageSettings = isOwner || permissions?.['settings.store'] === true;
  const canViewCustomers = isOwner || permissions?.['customers.view'] === true;

  return (
    <html lang="en">
      <body>
        <div className="admin-layout">
          {/* Left Sidebar Navigation */}
          <aside className="sidebar">
            <div className="sidebar-header" style={{ textAlign: 'center', padding: '20px 15px' }}>
              <img className="sidebar-logo rounded-lg" src="/logo.png" alt="Rajshree Jewels Logo" style={{ height: '48px', width: 'auto', margin: '0 auto 10px auto', display: 'block', borderRadius: '8px' }} />
              <h1 className="sidebar-title" style={{ fontSize: '15px', margin: 0 }}>RAJSHREE JEWELS</h1>
              <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }} className="sidebar-logo">
                {isOwner ? 'OWNER PANEL' : 'ADMIN PANEL'}
              </div>
            </div>

            <nav style={{ flexGrow: 1 }}>
              <ul className="sidebar-menu">
                {canViewAnalytics && (
                  <li className={`sidebar-item ${currentPath === '/' ? 'active' : ''}`}>
                    <a href="/">
                      <span>Overview</span>
                    </a>
                  </li>
                )}
                
                {canViewOrders && (
                  <li className={`sidebar-item ${currentPath.startsWith('/orders') ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href="/orders" style={{ flexGrow: 1 }}>
                      <span>Orders</span>
                    </a>
                    {unrepliedCount > 0 && (
                      <span style={{ background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', marginRight: '15px' }}>
                        {unrepliedCount}
                      </span>
                    )}
                  </li>
                )}
                
                {canViewCustomers && (
                  <li className={`sidebar-item ${currentPath.startsWith('/customers') ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <a href="/customers" style={{ flexGrow: 1 }}>
                      <span>Customers</span>
                    </a>
                    {unverifiedCount > 0 && (
                      <span style={{ background: '#f97316', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', marginRight: '15px' }}>
                        {unverifiedCount}
                      </span>
                    )}
                  </li>
                )}
                
                {canViewProducts && (
                  <li className={`sidebar-item ${currentPath.startsWith('/products') ? 'active' : ''}`}>
                    <a href="/products">
                      <span>Products</span>
                    </a>
                  </li>
                )}

                {canManageOffers && (
                  <li className={`sidebar-item ${currentPath.startsWith('/offers') ? 'active' : ''}`}>
                    <a href="/offers">
                      <span>Offers & Sales</span>
                    </a>
                  </li>
                )}

                {canManageCollections && (
                  <li className={`sidebar-item ${currentPath.startsWith('/collections') ? 'active' : ''}`}>
                    <a href="/collections">
                      <span>Collections</span>
                    </a>
                  </li>
                )}

                {canViewAnalytics && (
                  <li className={`sidebar-item ${currentPath.startsWith('/analytics') ? 'active' : ''}`}>
                    <a href="/analytics">
                      <span>Analytics</span>
                    </a>
                  </li>
                )}

                {isOwner && (
                  <>
                    <li className={`sidebar-item ${currentPath.startsWith('/users') ? 'active' : ''}`}>
                      <a href="/users">
                        <span>Team Management</span>
                      </a>
                    </li>
                    <li className={`sidebar-item ${currentPath.startsWith('/roles') ? 'active' : ''}`}>
                      <a href="/roles">
                        <span>Roles & Matrix</span>
                      </a>
                    </li>
                  </>
                )}
                
                {canManageSettings && (
                  <li className={`sidebar-item ${currentPath.startsWith('/settings') ? 'active' : ''}`}>
                    <a href="/settings">
                      <span>Settings</span>
                    </a>
                  </li>
                )}
              </ul>
            </nav>

            <div className="sidebar-footer">
              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ width: '100%', borderColor: '#333' }}
              >
                <span>Logout</span>
              </button>
              {/* Bottom of sidebar — Haste Industries credit */}
              <div 
                className="sidebar-logo"
                style={{ 
                  padding: '12px 16px',
                  borderTop: '1px solid #1a1a1a',
                  marginTop: 'auto',
                  overflow: 'hidden',
                }}
              >
                <p style={{ 
                  fontSize: '9px', 
                  color: '#b7b7b7', 
                  fontFamily: 'monospace',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                  lineHeight: '1.6',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0,
                }}>
                  Built by Haste Industries
                </p>
              </div>
            </div>
          </aside>

          {/* Main Content Pane */}
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
