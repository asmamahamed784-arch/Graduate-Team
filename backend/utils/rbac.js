export const normalizeRole = (role) => (role === 'user' ? 'citizen' : role);

export const normalizeUserRole = async (user) => {
  if (!user) return user;
  if (user.role === 'user') {
    user.role = 'citizen';
    await user.save();
  }
  return user;
};

export const getAssignedCenterId = (user) => {
  if (!user?.center) return null;
  return (user.center._id || user.center).toString();
};

export const isTicketOwner = (user, ticket) => {
  if (!user || !ticket?.citizen) return false;
  const citizenId = ticket.citizen._id || ticket.citizen;
  return citizenId.toString() === user._id.toString();
};

export const isAssignedCenterTicket = (user, ticket) => {
  const assignedCenterId = getAssignedCenterId(user);
  if (!assignedCenterId || !ticket?.center) return false;
  const ticketCenterId = (ticket.center._id || ticket.center).toString();
  return assignedCenterId === ticketCenterId;
};

export const canAccessTicket = (user, ticket) => {
  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;
  if (role === 'citizen') return isTicketOwner(user, ticket);
  if (role === 'operator' || role === 'super_operator') return isAssignedCenterTicket(user, ticket);
  return false;
};
