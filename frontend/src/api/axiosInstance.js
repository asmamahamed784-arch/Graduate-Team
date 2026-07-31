// src/api/axiosInstance.js
import axios from 'axios';
import { getToken, logout } from '../auth/jwtUtils';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/',
  timeout: 12000,
});

const STATUS_NAMES = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Validation Error',
  429: 'Too Many Requests',
  500: 'Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

const resolveErrorInfo = (error) => {
  const status = error.response?.status;
  const data = error.response?.data;
  const serverMessage = String(data?.message || data?.error || '').trim();
  const errorName = String(data?.name || data?.code || data?.errorCode || '').trim();

  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return {
        name: 'Request Timeout',
        message: 'The request took too long. Try again.',
        toastId: 'nqs-api-timeout',
      };
    }
    return {
      name: 'Connection Failed',
      message: 'API is offline. Start the backend, then refresh.',
      toastId: 'nqs-api-offline',
    };
  }

  if (status === 502 || status === 503 || status === 504) {
    return {
      name: STATUS_NAMES[status] || `HTTP ${status}`,
      message: serverMessage || 'The API gateway could not reach the server.',
      toastId: `nqs-api-${status}`,
    };
  }

  return {
    name: errorName || STATUS_NAMES[status] || (status ? `HTTP ${status}` : 'Request Error'),
    message: serverMessage || error.message || 'Something went wrong.',
    toastId: `nqs-api-${status || 'x'}-${(serverMessage || error.message || 'err').slice(0, 48)}`,
  };
};

const showApiErrorToast = (info) => {
  toast(`${info.name}: ${info.message}`, {
    toastId: info.toastId,
    className: 'nqs-toast-error',
    autoClose: 4200,
    closeOnClick: true,
  });
};

// Attach JWT from localStorage to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/api/auth/login');
    const status = error.response?.status;

    if (status === 401 && !isLoginRequest && getToken()) {
      logout(); // clear token and force logout
    }

    const shouldShowGlobalToast = !isLoginRequest && ![401, 403].includes(status);
    if (shouldShowGlobalToast) {
      showApiErrorToast(resolveErrorInfo(error));
    }

    return Promise.reject(error);
  }
);

export default api;
