import prisma from '../config/prisma.js';

// @desc    Submit citizen feedback
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const { ticketId, rating, comments, comment } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const feedback = await prisma.feedback.create({
      data: {
        ticket: ticketId,
        user: req.user ? req.user.id : null,
        rating,
        comment: comment || comments
      }
    });

    return res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all feedback comments (Admin view)
// @route   GET /api/feedback
// @access  Private/Admin
export const listFeedback = async (req, res) => {
  try {
    const feedbackList = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' }
    });
    const userIds = [...new Set(feedbackList.map((feedback) => feedback.user).filter(Boolean))];
    const ticketIds = [...new Set(feedbackList.map((feedback) => feedback.ticket).filter(Boolean))];
    const [users, tickets] = await Promise.all([
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [],
      ticketIds.length ? prisma.ticket.findMany({ where: { id: { in: ticketIds } } }) : []
    ]);
    const serviceIds = [...new Set(tickets.map((ticket) => ticket.service).filter(Boolean))];
    const centerIds = [...new Set(tickets.map((ticket) => ticket.center).filter(Boolean))];
    const [services, centers] = await Promise.all([
      serviceIds.length ? prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } }) : [],
      centerIds.length ? prisma.center.findMany({ where: { id: { in: centerIds } }, select: { id: true, name: true, district: true } }) : []
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const servicesById = new Map(services.map((service) => [service.id, service]));
    const centersById = new Map(centers.map((center) => [center.id, center]));
    const ticketsById = new Map(tickets.map((ticket) => [ticket.id, {
      ...ticket,
      service: servicesById.get(ticket.service) || ticket.service,
      center: centersById.get(ticket.center) || ticket.center
    }]));
    const data = feedbackList.map((feedback) => ({
      ...feedback,
      user: usersById.get(feedback.user) || feedback.user,
      ticket: ticketsById.get(feedback.ticket) || feedback.ticket
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
