import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_PYTHON_API_BASE_URL 
  || process.env.VITE_PYTHON_API_BASE_URL 
  || 'http://127.0.0.1:8001/api';

const axiosClientPython = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Add a request interceptor
axiosClientPython.interceptors.request.use(function (config) {
    return config;
  }, function (error) {
    return Promise.reject(error);
  });

// Add a response interceptor
axiosClientPython.interceptors.response.use(function (response) {
    return response.data;
  }, function (error) {
    return Promise.reject(error);
  });

export default axiosClientPython;