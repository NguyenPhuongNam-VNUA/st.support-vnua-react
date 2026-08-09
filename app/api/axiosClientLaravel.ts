import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_LARAVEL_API_BASE_URL 
  || process.env.VITE_LARAVEL_API_BASE_URL 
  || 'http://127.0.0.1:8000/api';

const axiosClientLaravel = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Add a request interceptor
axiosClientLaravel.interceptors.request.use(function (config) {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    return config;
  }, function (error) {
    return Promise.reject(error);
  });

// Add a response interceptor
axiosClientLaravel.interceptors.response.use(function (response) {
    return response.data;
  }, function (error) {
    if (error.response && error.response.status === 401) {
        console.warn('Lỗi 401 (Unauthorized)');
    }
    // Xử lý khi Backend Laravel chưa chạy (Network Error) để không làm vỡ UI Admin Local
    if (!error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error')) {
        console.warn('Backend Laravel chưa kết nối (Network Error) - Tự động dùng dữ liệu mẫu cho UI Admin');
        return Promise.resolve({ data: [], isMock: true });
    }
    return Promise.reject(error);
  });

export default axiosClientLaravel;