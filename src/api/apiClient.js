// src/api/apiClient.js
import api from './axiosInstance';
import { getToken } from '../auth/jwtUtils';

export const apiClient = {
  post: async (url, data) => {
    let targetUrl = url;
    
    // Map frontend endpoints to backend REST API routes
    if (url === '/api/queue/create') {
      const token = getToken();
      let role = 'user';
      if (token) {
        try {
          // Decode payload of JWT token to retrieve the logged-in role
          const payload = JSON.parse(atob(token.split('.')[1] || token));
          role = payload.role === 'user' ? 'citizen' : (payload.role || 'citizen');
        } catch (_e) {
          role = 'citizen';
        }
      }
      targetUrl = role === 'citizen' ? '/api/bookings' : '/api/queue/generate';
    } else if (url === '/api/services/create') {
      targetUrl = '/api/services';
    } else if (url === '/api/centers/create') {
      targetUrl = '/api/centers';
    }

    const response = await api.post(targetUrl, data);
    return { data: response.data.data };
  },

  get: async (url, params) => {
    let targetUrl = url;
    if (url === '/api/services/list') {
      targetUrl = '/api/services';
    } else if (url === '/api/centers/list') {
      targetUrl = '/api/centers';
    } else if (url === '/api/queue/list') {
      targetUrl = '/api/queue/list';
    } else if (url === '/api/logs/list') {
      targetUrl = '/api/audits';
    } else if (url === '/api/notifications/list') {
      targetUrl = '/api/notifications';
    }

    const response = await api.get(targetUrl, { params });
    return { data: response.data.data };
  },

  put: async (url, data) => {
    let targetUrl = url;
    if (url.startsWith('/api/services/update/')) {
      const id = url.split('/').pop();
      targetUrl = `/api/services/${id}`;
    } else if (url.startsWith('/api/centers/update/')) {
      const id = url.split('/').pop();
      targetUrl = `/api/centers/${id}`;
    }

    const response = await api.put(targetUrl, data);
    return { data: response.data.data };
  },

  delete: async (url) => {
    let targetUrl = url;
    if (url.startsWith('/api/services/delete/')) {
      const id = url.split('/').pop();
      targetUrl = `/api/services/${id}`;
    } else if (url.startsWith('/api/centers/delete/')) {
      const id = url.split('/').pop();
      targetUrl = `/api/centers/${id}`;
    }

    const response = await api.delete(targetUrl);
    return { data: response.data.data };
  }
};
