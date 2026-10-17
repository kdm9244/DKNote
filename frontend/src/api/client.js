import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('accessToken');
      const publicPaths = ['/login', '/signup', '/oauth2/redirect'];
      if (!publicPaths.includes(window.location.pathname)) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export const oauth2AuthorizationUrl = `${API_BASE_URL}/oauth2/authorization/google`;
export function startGoogleLogin() {
  const development = ['localhost','127.0.0.1'].includes(window.location.hostname) && window.location.port === '5173';
  if (development) document.cookie = `dknote_oauth_return_origin=${encodeURIComponent(window.location.origin)}; Path=/; Max-Age=300; SameSite=Lax`;
  window.location.assign(development && oauth2AuthorizationUrl.startsWith('/') ? `http://${window.location.hostname}:8080${oauth2AuthorizationUrl}` : oauth2AuthorizationUrl);
}

/**
 * 현재 로그인한 계정의 고유 식별자(userId 또는 email) 추출 (미로그인 시 anonymous)
 */
export function getCurrentUserId() {
  try {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return 'anonymous';
    const base64Url = token.split('.')[1];
    if (!base64Url) return 'anonymous';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || payload.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

export default api;
