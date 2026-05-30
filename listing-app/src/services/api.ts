import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// In Expo, EXPO_PUBLIC_API_URL is the standard way to declare environment variables
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: BASE_URL });

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('admin_token');
      router.replace('/login');
    }
    return Promise.reject(error);
  }
);

export const listingApi = {
  create: (formData: FormData) => api.post('/api/v1/listing/new', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  status: (jobId: string) => api.get(`/api/v1/listing/status/${jobId}`),
  publish: (productId: string, edits?: { displayName?: string; description?: string }) =>
    api.post(`/api/v1/listing/publish/${productId}`, edits),
  reEnhance: (productId: string) => api.put(`/api/v1/listing/re-enhance/${productId}`),
};

export const productApi = {
  recent: () => api.get('/api/v1/admin/products?limit=5&sort=newest'),
};

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/v1/auth/login', { email, password }),
};

export default api;
