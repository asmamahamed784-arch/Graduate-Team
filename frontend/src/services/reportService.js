import api from '../api/axiosInstance';

export const reportService = {
  getAnalyticsReports: async () => {
    const [statsRes, analyticsRes] = await Promise.all([
      api.get('/api/reports/stats'),
      api.get('/api/reports/analytics')
    ]);

    return {
      summaryStats: statsRes.data.data,
      charts: analyticsRes.data.data
    };
  }
};

export default reportService;
