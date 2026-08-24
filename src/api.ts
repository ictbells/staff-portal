import axios from 'axios';
import { message } from 'antd';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
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
    if (err.response?.status === 401 && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/payments/callback')) {
      sessionStorage.removeItem('bells_token');
      const message = code === 'session_timeout' ? '?timeout=1' : '';
      window.location.href = `/login${message}`;
    }
    return Promise.reject(err);
  },
);

export default api;
