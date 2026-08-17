import prisma from '../config/prisma.js';

export class FeedbackService {
  static async submitFeedback({ ticketId, rating, comments, comment, userId }) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const feedback = await prisma.feedback.create({
      data: {
        ticket: ticketId,
        user: userId || null,
        rating,
        comment: comment || comments
      }
    });

    return feedback;
  }

  static async listFeedback() {
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
    
    return feedbackList.map((feedback) => ({
      ...feedback,
      user: usersById.get(feedback.user) || feedback.user,
      ticket: ticketsById.get(feedback.ticket) || feedback.ticket
    }));
  }
}
