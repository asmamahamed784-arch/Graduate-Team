// src/services/centerService.js
import { apiClient } from '../api/apiClient';

export const centerService = {
  /**
   * Fetches active NQS service branches
   */
  getCentersList: async () => {
    const res = await apiClient.get('/api/centers/list');
    return res.data;
  },

  /**
   * Registers a new service center
   */
  createCenter: async (centerData) => {
    const res = await apiClient.post('/api/centers/create', centerData);
    return res.data;
  },

  /**
   * Modifies dynamic details of a service center
   */
  updateCenter: async (id, centerData) => {
    const res = await apiClient.put(`/api/centers/update/${id}`, centerData);
    return res.data;
  },

  /**
   * Deletes a service center branch from active directories
   */
  deleteCenter: async (id) => {
    const res = await apiClient.delete(`/api/centers/delete/${id}`);
    return res.data;
  }
};

export default centerService;
