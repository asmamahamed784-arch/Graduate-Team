import { FiClipboard, FiEdit3, FiRefreshCw, FiFileText } from 'react-icons/fi';

export const NEW_ID_SERVICE_NAME = 'National ID Registration';
export const UPDATE_INFO_SERVICE_NAME = 'Update National ID Information';
export const LOST_ID_SERVICE_NAME = 'Replace Lost National ID';

export const getServiceId = (service = {}) => service._id || service.id || '';

export const normalizeServiceName = (value = '') => String(value).trim().toLowerCase();

export const isNewIdService = (service = {}) => normalizeServiceName(service.name) === normalizeServiceName(NEW_ID_SERVICE_NAME);

export const isUpdateInfoService = (service = {}) => normalizeServiceName(service.name) === normalizeServiceName(UPDATE_INFO_SERVICE_NAME);

export const isLostIdService = (service = {}) => normalizeServiceName(service.name) === normalizeServiceName(LOST_ID_SERVICE_NAME);

export const isCoreService = (service = {}) => isNewIdService(service) || isUpdateInfoService(service) || isLostIdService(service);

export const getServicePath = (service = {}) => {
  if (isNewIdService(service)) return '/dashboard/user/new-id-registration';
  if (isUpdateInfoService(service)) return '/dashboard/user/update-information';
  if (isLostIdService(service)) return '/dashboard/user/replace-lost-id';
  const id = getServiceId(service);
  return id ? `/dashboard/user/services/${id}/book` : '/dashboard/user/services';
};

export const getServiceLabel = (service = {}) => {
  if (isNewIdService(service)) return 'Book Appointment';
  if (isUpdateInfoService(service)) return 'Update Information';
  if (isLostIdService(service)) return 'Replace Lost ID';
  return service.name || 'Service Request';
};

export const getServiceIcon = (service = {}) => {
  if (isUpdateInfoService(service)) return FiEdit3;
  if (isLostIdService(service)) return FiRefreshCw;
  if (isNewIdService(service)) return FiClipboard;
  return FiFileText;
};
