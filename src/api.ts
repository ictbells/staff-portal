import axios from 'axios';
import { message } from 'antd';

export function apiUrl(path: string, fallback = ''): string {
  const base = String(import.meta.env.VITE_API_URL || fallback).replace(/\/+$/, '');
  const suffix = String(path).replace(/^\/+/, '');
  return base ? `${base}/${suffix}` : `/${suffix}`;
}

const baseURL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * Staff auth is Bearer tokens in sessionStorage (same as the student portal).
 * Keep withCredentials off so a full cookie jar on a shared parent domain
 * (other apps, old cookie-session payloads) cannot abort login or API calls
 * with "cookie storage full" / HTTP 431. Staff do not need CSRF cookies.
 */
const api = axios.create({
  baseURL,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('bells_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.status === 202 && res.data?.status === 'pending_approval') {
      message.info(res.data.message || 'Sent for office approval.');
    }
    return res;
  },
  (err) => {
    const code = err.response?.data?.code;
    if (err.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/forgot-password') && !window.location.pathname.includes('/reset-password') && !window.location.pathname.includes('/payments/callback')) {
      sessionStorage.removeItem('bells_token');
      const message =
        code === 'session_timeout' ? '?timeout=1' : code === 'session_expired' ? '?expired=1' : '';
      window.location.href = `/login${message}`;
    }
    return Promise.reject(err);
  },
);

export function isPendingApproval(res: { status?: number; data?: { status?: string } } | undefined): boolean {
  return Boolean(res && (res.status === 202 || res.data?.status === 'pending_approval'));
}

export default api;
