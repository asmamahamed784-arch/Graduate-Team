import { FiClipboard, FiEdit3, FiRefreshCw, FiFileText } from 'react-icons/fi';

export const NEW_ID_SERVICE_NAME = 'National ID Registration';
export const UPDATE_INFO_SERVICE_NAME = 'Update National ID Information';
export const LOST_ID_SERVICE_NAME = 'Replace Lost National ID';

export const getServiceId = (service = {}) => service._id || service.id || '';

export const normalizeServiceName = (value = '') => String(value).trim().toLowerCase();

const serviceText = (service = {}) => [
  service.name,
  service.title,
  service.slug,
  service.code,
  service.requestType,
  service.type
].filter(Boolean).join(' ').toLowerCase();

export const isNewIdService = (service = {}) => {
  const name = normalizeServiceName(service.name);
  const text = serviceText(service);
  return name === normalizeServiceName(NEW_ID_SERVICE_NAME) ||
    text.includes('new national id') ||
    text.includes('national id registration') ||
    text.includes('new_national_id') ||
    text.includes('new-id-registration');
};

export const isCompletedTicketStatus = (ticket = {}) => {
  const status = normalizeServiceName(ticket.status);
  const requestStatus = normalizeServiceName(ticket.requestStatus);
  return status === 'completed' || requestStatus === 'completed';
};

export const isNewIdBooking = (ticket = {}) => {
  const requestType = String(ticket.requestType || ticket.type || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const serviceName = ticket.service?.name || ticket.serviceName || ticket.service || '';
  return ['new_national_id', 'new_id_registration', 'new_registration', 'national_id_registration'].includes(requestType) ||
    isNewIdService({
      name: serviceName,
      title: ticket.title,
      requestType,
      type: requestType
    });
};

export const isCompletedNewIdBooking = (ticket = {}) => isNewIdBooking(ticket) && isCompletedTicketStatus(ticket);

export const isUpdateInfoService = (service = {}) => {
  const name = normalizeServiceName(service.name);
  const text = serviceText(service);
  return name === normalizeServiceName(UPDATE_INFO_SERVICE_NAME) ||
    text.includes('update national id') ||
    text.includes('update information') ||
    text.includes('update_information');
};

export const isLostIdService = (service = {}) => {
  const name = normalizeServiceName(service.name);
  const text = serviceText(service);
  return name === normalizeServiceName(LOST_ID_SERVICE_NAME) ||
    text.includes('replace lost') ||
    text.includes('lost id') ||
    text.includes('lost national id') ||
    text.includes('lost_replacement') ||
    text.includes('replace_lost_id');
};

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
