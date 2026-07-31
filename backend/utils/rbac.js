import prisma from '../config/prisma.js';

export const normalizeRole = (role) => {
  const value = String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (value === 'user') return 'citizen';
  if (['user_management', 'user_management_role', 'user_manager'].includes(value)) return 'user_manager';
  return value;
};

export const STAFF_CENTER_ROLES = ['operator', 'super_operator', 'center_manager'];
export const ADMIN_ROLES = ['admin', 'super_admin'];
export const USER_MANAGEMENT_ROLES = ['admin', 'super_admin', 'user_manager'];

export const isStaffCenterRole = (role) => STAFF_CENTER_ROLES.includes(normalizeRole(role));
export const isAdminRole = (role) => ADMIN_ROLES.includes(normalizeRole(role));
export const isUserManagementRole = (role) => USER_MANAGEMENT_ROLES.includes(normalizeRole(role));

export const normalizeAccountStatus = (status = '') => {
  const value = String(status || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (['active', 'approved'].includes(value)) return 'active';
  if (['inactive', 'deactivated', 'disabled'].includes(value)) return 'inactive';
  if (['pending', 'pending_approval', 'pendingapproval'].includes(value)) return 'pending_approval';
  if (['rejected', 'reject'].includes(value)) return 'rejected';
  return value || 'active';
};

export const isActiveAccountStatus = (status) => normalizeAccountStatus(status) === 'active';

export const normalizeUserRole = async (user) => {
  if (!user) return user;
  if (user.role === 'user') {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'citizen' }
    });
    return updatedUser;
  }
  return user;
};

export const getRecordId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return value.id || value._id || value.value || null;
  }
  return value;
};

export const getAssignedCenterId = (user) => {
  const centerId = getRecordId(user?.center)
    || getRecordId(user?.assignedCenter)
    || user?.centerId
    || user?.assignedCenterId
    || getRecordId(user?.accountProfile?.center);
  return centerId ? centerId.toString() : null;
};

export const getAssignedDistrict = (user) => {
  if (!user) return '';
  return user.assignedDistrict
    || user.center?.district
    || user.accountProfile?.assignedDistrict
    || user.accountProfile?.district
    || '';
};

export const isTicketOwner = (user, ticket) => {
  if (!user || !ticket?.citizen) return false;
  const citizenId = getRecordId(ticket.citizen);
  return Boolean(citizenId && user.id && citizenId.toString() === user.id.toString());
};

export const isAssignedCenterTicket = (user, ticket) => {
  const assignedCenterId = getAssignedCenterId(user);
  if (!assignedCenterId || !ticket?.center) return false;
  const ticketCenterId = getRecordId(ticket.center);
  return Boolean(ticketCenterId && assignedCenterId === ticketCenterId.toString());
};

export const canAccessTicket = (user, ticket) => {
  const role = normalizeRole(user?.role);
  if (isAdminRole(role)) return true;
  if (role === 'citizen') return isTicketOwner(user, ticket);
  if (isStaffCenterRole(role)) return isAssignedCenterTicket(user, ticket);
  return false;
};
