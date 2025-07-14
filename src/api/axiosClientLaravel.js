import axios from 'axios';

const axiosClientLaravel = axios.create({
    baseURL: import.meta.env.VITE_LARAVEL_API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Add a request interceptor
axiosClientLaravel.interceptors.request.use(function (config) {
    // Do something before request is sent
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  }, function (error) {
    // Do something with request error
    return Promise.reject(error);
  });

// Add a response interceptor
axiosClientLaravel.interceptors.response.use(function (response) {
    // Any status code that lie within the range of 2xx cause this function to trigger
    // Do something with response data
    return response.data;
  }, function (error) {
    // Any status codes that falls outside the range of 2xx cause this function to trigger
    // Do something with response error
    if (error.response && error.response.status === 401) {
        // Handle unauthorized access
        console.warn('Lỗi 401 (Unauthorized)');
        // Optionally redirect to login page or show a message
        // window.location.href = '/login';
    }
    return Promise.reject(error);
  });

  export default axiosClientLaravel;