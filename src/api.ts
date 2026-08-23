import axios from 'axios';

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
  (res) => res,
  (err) => {
    const code = err.response?.data?.code;
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      sessionStorage.removeItem('bells_token');
      const message = code === 'session_timeout' ? '?timeout=1' : '';
      window.location.href = `/login${message}`;
    }
    return Promise.reject(err);
  },
);

export default api;
