import axios from 'axios';
import { message } from 'antd';

const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL,
  withCredentials: true,
  // Axios only sends X-XSRF-TOKEN on same-origin by default. Prod SPA and API are different hosts.
  withXSRFToken: true,
  xsrfCookieName: 'Bells-XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

let csrfPromise: Promise<void> | null = null;

function ensureCsrfCookie() {
  if (!csrfPromise) {
    csrfPromise = api
      .get('/api/sanctum/csrf-cookie')
      .then(() => undefined)
      .catch((err) => {
        csrfPromise = null;
        throw err;
      });
  }
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    await ensureCsrfCookie();
  }
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
    if (err.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/payments/callback')) {
      sessionStorage.removeItem('bells_token');
      const message = code === 'session_timeout' ? '?timeout=1' : '';
      window.location.href = `/login${message}`;
    }
    return Promise.reject(err);
  },
);

export default api;
