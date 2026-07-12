// src/services/serviceManagementService.js
import { apiClient } from '../api/apiClient';

export const serviceManagementService = {
  /**
   * Fetches available digital services list
   */
  getServicesList: async () => {
    const res = await apiClient.get('/api/services/list');
    return res.data;
  },

  /**
   * Registers a new digital service into NQS
   */
  createService: async (serviceData) => {
    const res = await apiClient.post('/api/services/create', serviceData);
    return res.data;
  },

  /**
   * Updates configuration specifications of a digital service
   */
  updateService: async (id, serviceData) => {
    const res = await apiClient.put(`/api/services/update/${id}`, serviceData);
    return res.data;
  },

  /**
   * Deletes a digital service from active NQS catalogs
   */
  deleteService: async (id) => {
    const res = await apiClient.delete(`/api/services/delete/${id}`);
    return res.data;
  }
};

export default serviceManagementService;
