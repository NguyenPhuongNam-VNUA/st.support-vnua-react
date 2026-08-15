import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/',
  headers: { Accept: 'application/json' },
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      const isLoginRequest = error.config?.url?.includes('/api/auth/login');
      if (!isLoginRequest && window.location.pathname.startsWith('/admin')) {
        window.location.assign('/login?reason=unauthorized');
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
