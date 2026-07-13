// src/api/apiClient.js
// Thin wrapper around the shared axios instance that unwraps the backend's
// { success, data } response envelope. Callers receive { data: <payload> }.
// For access to the full response (status, headers, meta), import
// api from './axiosInstance' directly.
import api from './axiosInstance';

export const apiClient = {
  get: async (url, params) => {
    const response = await api.get(url, { params });
    return { data: response.data.data };
  },

  post: async (url, data) => {
    const response = await api.post(url, data);
    return { data: response.data.data };
  },

  put: async (url, data) => {
    const response = await api.put(url, data);
    return { data: response.data.data };
  },

  delete: async (url) => {
    const response = await api.delete(url);
    return { data: response.data.data };
  }
};
