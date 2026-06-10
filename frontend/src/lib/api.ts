const API_BASE_URL = typeof window !== 'undefined'
  ? '/api/v1'
  : (process.env.BACKEND_URL || 'http://backend:4000') + '/api/v1';

async function getSessionAccessToken(): Promise<string | undefined> {
  if (typeof window !== 'undefined') {
    try {
      const { getSession } = await import('next-auth/react');
      const session = await getSession();
      return session?.accessToken;
    } catch (_) {
      return undefined;
    }
  }

  try {
    const { auth } = await import('./auth');
    const session = await auth();
    return session?.accessToken;
  } catch (_) {
    return undefined;
  }
}

function toHeaderObject(headers: Headers): Record<string, string> {
  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  return headersObj;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const storedToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : undefined;
  const sessionToken = await getSessionAccessToken();
  const token = sessionToken || storedToken;

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, {
    ...options,
    headers: toHeaderObject(headers),
  });

  if (response.status === 401 && typeof window !== 'undefined') {
    const refreshedToken = await getSessionAccessToken();
    if (refreshedToken && refreshedToken !== token) {
      localStorage.setItem('access_token', refreshedToken);
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      response = await fetch(url, {
        ...options,
        headers: toHeaderObject(headers),
      });
    } else {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        const refreshRes = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const { accessToken: newAccessToken } = await refreshRes.json();
          localStorage.setItem('access_token', newAccessToken);
          headers.set('Authorization', `Bearer ${newAccessToken}`);
          response = await fetch(url, {
            ...options,
            headers: toHeaderObject(headers),
          });
        }
      }
    }
  }

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (_) {}
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export async function apiClient(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<Response> {
  const token = accessToken || await getSessionAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status !== 401) {
    return res;
  }

  const refreshedToken = await getSessionAccessToken();
  if (refreshedToken && refreshedToken !== token) {
    return fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${refreshedToken}` },
    });
  }

  const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
  if (refreshToken) {
    const refreshRes = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshRes.ok) {
      const { accessToken: newAccessToken } = await refreshRes.json();
      localStorage.setItem('access_token', newAccessToken);
      return fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newAccessToken}` },
      });
    }
  }

  return res;
}
