import api from '../api/axiosInstance';

export const fetchServices = async () => {
  const res = await api.get('/api/services');
  return res.data.data || [];
};

export const fetchCenters = async () => {
  const res = await api.get('/api/centers');
  return res.data.data || [];
};

export const submitBooking = async (payload) => {
  const res = await api.post('/api/bookings', {
    serviceId: payload.service?._id || payload.service?.id || payload.serviceId,
    centerId: payload.center?._id || payload.center?.id || payload.centerId,
    date: payload.date ? new Date(payload.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    timeSlot: payload.timeSlot
  });
  return { success: res.data.success, booking: res.data.data };
};

export const fetchQueueStatus = async (reference) => {
  const res = await api.get(`/api/queue/track/${reference}`);
  return res.data.data;
};
