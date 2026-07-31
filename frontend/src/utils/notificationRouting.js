import { apiClient } from '../api/apiClient';

const getNotificationText = (notification = {}) => (
  `${notification.title || ''} ${notification.desc || notification.message || ''} ${notification.category || ''} ${notification.type || ''} ${notification.notificationType || ''}`
).toLowerCase();

export const getRequestType = (notification = {}) => String(
  notification.requestType
    || notification.metadata?.requestType
    || notification.relatedRequest?.requestType
    || notification.ticket?.requestType
    || ''
).toLowerCase();

export const extractTicketReference = (notification = {}) => {
  const source = `${notification.referenceNumber || ''} ${notification.ticketRef || ''} ${notification.title || ''} ${notification.desc || notification.message || ''}`;
  const match = source.match(/\b(?:REQ|NQS)-\d+\b/i);
  return match ? match[0].toUpperCase() : '';
};

export const getRelatedTarget = (notification = {}) => {
  const related = notification.relatedRequest;
  return (
    (related && typeof related === 'object' ? related._id || related.id || related.ref : related)
    || notification.relatedEntity
    || notification.referenceNumber
    || notification.requestId
    || notification.ticketId
    || notification.bookingId
    || notification.ticket?._id
    || notification.ticket?.id
    || notification.ticket?.ref
    || notification.metadata?.requestId
    || notification.metadata?.ticketId
    || notification.metadata?.ticketRef
    || notification.ticketRef
    || extractTicketReference(notification)
    || ''
  );
};

const unwrapBookingPayload = (payload = {}) => payload?.data?.ticket || payload?.ticket || payload?.data || payload;

const getTicketCenterId = (ticket = {}) => {
  const center = ticket.center || ticket.centerId;
  if (!center) return '';
  if (typeof center === 'string') return center;
  return center._id || center.id || '';
};

export const isOperatorApprovalNotice = (notification = {}) => {
  const text = getNotificationText(notification);
  return (
    notification.notificationType === 'OPERATOR_APPROVAL_REQUIRED'
    || notification.relatedEntityType === 'User'
    || notification.category === 'Operator Approval'
    || text.includes('operator approval')
    || text.includes('waiting for super admin approval')
  );
};

export const isCitizenCorrectionNotice = (notification = {}) => {
  const text = getNotificationText(notification);
  const statusText = String(
    notification.status
      || notification.requestStatus
      || notification.newStatus
      || notification.metadata?.status
      || notification.metadata?.requestStatus
      || ''
  ).toLowerCase();

  return (
    notification.notificationType === 'CORRECTION_REQUIRED'
    || text.includes('cancel')
    || text.includes('correction')
    || text.includes('resubmit')
    || text.includes('correct your information')
    || statusText.includes('cancel')
    || statusText.includes('correction')
    || statusText.includes('resubmit')
  );
};

const getAdminAppointmentRoute = (notification = {}) => {
  const ticketRef = notification.referenceNumber || notification.ticketRef || extractTicketReference(notification);
  const ticketId = notification.relatedEntity || notification.ticketId || notification.bookingId || getRelatedTarget(notification);
  const requestType = getRequestType(notification);
  const params = new URLSearchParams();
  if (requestType) params.set('requestType', requestType);
  if (ticketRef) params.set('ticket', ticketRef);
  if (ticketId && ticketId !== ticketRef) params.set('ticketId', String(ticketId));
  return `/admin-appointments/center${params.toString() ? `?${params.toString()}` : ''}`;
};

const buildAdminAppointmentRouteFromTicket = (ticket = {}, notification = {}) => {
  const params = new URLSearchParams();
  const requestType = ticket.requestType || getRequestType(notification);
  const ticketRef = ticket.ref || notification.referenceNumber || notification.ticketRef || extractTicketReference(notification);
  const ticketId = ticket._id || ticket.id || notification.relatedEntity || notification.ticketId || notification.bookingId;
  const centerId = getTicketCenterId(ticket);
  const district = ticket.center?.district || ticket.registrationDetails?.centerDistrict || '';

  const centerName = ticket.center?.name
    || ticket.registrationDetails?.selectedCenter
    || ticket.existingRegistration?.centerName
    || '';

  if (requestType) params.set('requestType', requestType);
  if (centerId) params.set('center', String(centerId));
  if (centerName) params.set('centerName', centerName);
  if (district) params.set('district', district);
  if (ticketRef) params.set('ticket', ticketRef);
  if (ticketId && ticketId !== ticketRef) params.set('ticketId', String(ticketId));

  return `/admin-appointments/center${params.toString() ? `?${params.toString()}` : ''}`;
};

const citizenServicePath = (requestType = '', target = '') => {
  const query = target ? `?resubmit=${encodeURIComponent(String(target))}` : '';
  if (requestType.includes('lost') || requestType.includes('replace')) {
    return `/dashboard/user/replace-lost-id${query}`;
  }
  if (requestType.includes('update')) {
    return `/dashboard/user/update-information${query}`;
  }
  if (target) {
    return `/dashboard/user/new-id-registration${query}`;
  }
  return '/dashboard/user/appointments';
};

const roleHomeRoute = (role = '') => {
  if (role === 'admin' || role === 'super_admin') return '/admin-appointments';
  if (role === 'operator' || role === 'super_operator' || role === 'center_manager') return '/dashboard/operator';
  if (role === 'citizen' || role === 'user') return '/dashboard/user/appointments';
  return '/notifications';
};

export const buildNotificationRoute = (notification = {}, user = {}) => {
  const directRoute = notification.actionUrl || notification.link || notification.url || notification.href;
  const role = String(user?.role || '').toLowerCase();
  const text = getNotificationText(notification);
  const requestType = getRequestType(notification);
  const target = getRelatedTarget(notification);
  const isAppointmentNotice = text.includes('appointment')
    || text.includes('ticket')
    || text.includes('request')
    || notification.category === 'Appointments'
    || notification.relatedEntityType === 'Ticket'
    || Boolean(target);
  const isCorrectionNotice = isCitizenCorrectionNotice(notification);
  const isAdminRole = role === 'admin' || role === 'super_admin';

  if (isAdminRole && isOperatorApprovalNotice(notification)) {
    const params = new URLSearchParams();
    params.set('status', 'pending_approval');
    if (notification.relatedEntity) params.set('operator', notification.relatedEntity);
    return `/operator-management?${params.toString()}`;
  }

  if (directRoute && !/^https?:\/\//i.test(String(directRoute))) {
    return directRoute;
  }

  if ((role === 'citizen' || role === 'user') && isCorrectionNotice) {
    return citizenServicePath(requestType, target);
  }

  if (isAdminRole) {
    return target || notification.referenceNumber || notification.relatedEntity
      ? getAdminAppointmentRoute(notification)
      : '/admin-appointments';
  }

  if (role === 'operator' || role === 'super_operator' || role === 'center_manager') {
    const params = new URLSearchParams();
    const ticketRef = notification.referenceNumber || extractTicketReference(notification);
    const ticketTarget = ticketRef || target;
    if (ticketTarget) params.set('ticket', String(ticketTarget));
    if (requestType) params.set('requestType', requestType);
    return `/dashboard/operator${params.toString() ? `?${params.toString()}` : ''}`;
  }

  if (role === 'citizen' || role === 'user') {
    if (isAppointmentNotice) {
      const params = new URLSearchParams();
      const ticketRef = notification.referenceNumber || extractTicketReference(notification);
      if (ticketRef) params.set('ticket', ticketRef);
      if (target && target !== ticketRef) params.set('ticketId', String(target));
      return `/dashboard/user/appointments${params.toString() ? `?${params.toString()}` : ''}`;
    }
  }

  return roleHomeRoute(role);
};

export const resolveNotificationRoute = async (notification = {}, user = {}) => {
  const role = String(user?.role || '').toLowerCase();
  const target = getRelatedTarget(notification);
  const hasRequestType = Boolean(getRequestType(notification));
  const isAdminRole = role === 'admin' || role === 'super_admin';

  if (isAdminRole && isOperatorApprovalNotice(notification)) {
    return buildNotificationRoute(notification, user);
  }

  if (isAdminRole && (target || notification.referenceNumber || notification.relatedEntity)) {
    const lookup = notification.referenceNumber || extractTicketReference(notification) || target;
    try {
      const res = await apiClient.get(`/api/bookings/${lookup}`);
      const ticket = unwrapBookingPayload(res.data) || {};
      if (ticket.ref || ticket.id || ticket._id) {
        return buildAdminAppointmentRouteFromTicket(ticket, notification);
      }
    } catch {
      // Fall back to the information already stored in the notification.
    }
  }

  if ((role === 'citizen' || role === 'user') && target && (isCitizenCorrectionNotice(notification) || !hasRequestType)) {
    try {
      const res = await apiClient.get(`/api/bookings/${target}`);
      const ticket = unwrapBookingPayload(res.data) || {};
      const enrichedNotification = {
        ...notification,
        requestType: ticket.requestType || notification.requestType,
        metadata: {
          ...(notification.metadata || {}),
          requestType: ticket.requestType,
          ticketRef: ticket.ref || target
        },
        ticketRef: ticket.ref || target,
        relatedRequest: ticket._id || ticket.id || target,
        relatedEntity: ticket._id || ticket.id || notification.relatedEntity || target
      };
      return buildNotificationRoute(enrichedNotification, user);
    } catch {
      // Fall back to the information already stored in the notification.
    }
  }

  return buildNotificationRoute(notification, user);
};
