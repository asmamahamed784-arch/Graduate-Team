import { apiClient } from '../api/apiClient';

export const dashboardService = {
  getDashboardStats: async () => {
    const res = await apiClient.get('/api/reports/stats');
    return res.data;
  }
};

export default dashboardService;
