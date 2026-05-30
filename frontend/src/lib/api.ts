const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/v1'                                          // Browser: relative -> goes through Nginx
  : (process.env.BACKEND_URL || 'http://backend:4000') + '/api/v1';  // SSR: Docker service name

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Retrieve auth token from localStorage or NextAuth session
  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token');
    if (!token) {
      try {
        const { getSession } = require('next-auth/react');
        const session = await getSession();
        token = session?.accessToken;
        if (token) {
          localStorage.setItem('access_token', token);
        }
      } catch (_) {}
    }
  } else {
    // SSR: retrieve NextAuth session server-side
    try {
      const { auth } = require('./auth');
      const session = await auth();
      token = session?.accessToken;
    } catch (_) {}
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  let response = await fetch(url, {
    ...options,
    headers: headersObj,
  });

  // Handle 401: Silent Refresh
  if (response.status === 401 && typeof window !== 'undefined') {
    try {
      const refreshRes = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (refreshRes.ok) {
        const { accessToken: newAccessToken } = await refreshRes.json();
        localStorage.setItem('access_token', newAccessToken);
        headers.set('Authorization', `Bearer ${newAccessToken}`);
        
        const newHeadersObj: Record<string, string> = {};
        headers.forEach((value, key) => {
          newHeadersObj[key] = value;
        });

        // Retry original request with new token
        response = await fetch(url, {
          ...options,
          headers: newHeadersObj,
        });
      } else {
        // Refresh failed -> clear stale token and redirect to login
        localStorage.removeItem('access_token');
        window.location.href = '/auth/login';
        throw new Error('Session expired');
      }
    } catch (err: any) {
      console.error('❌ Silent token refresh failed:', err);
    }
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
