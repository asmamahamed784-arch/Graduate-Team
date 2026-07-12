import api from '../api/axiosInstance';

export const userService = {
  updateProfile: async (userData) => {
    const res = await api.put('/api/auth/profile', userData);
    return res.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await api.put('/api/auth/password', { currentPassword, newPassword });
    return res.data;
  },

  deleteAccount: async () => {
    const res = await api.delete('/api/auth/profile');
    return res.data;
  }
};

export default userService;
