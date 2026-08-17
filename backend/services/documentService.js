import prisma from '../config/prisma.js';

export class DocumentService {
  static async uploadDocument({ name, fileUrl, ticketId, userId }) {
    if (!name || !fileUrl) {
      throw new Error('Document name and file URL are required');
    }

    const doc = await prisma.document.create({
      data: {
        user: userId,
        ticket: ticketId || null,
        name,
        fileUrl,
        status: 'Pending'
      }
    });

    return doc;
  }

  static async listDocuments(userId) {
    const list = await prisma.document.findMany({ 
      where: { user: userId }
    });
    
    const ticketIds = [...new Set(list.map((doc) => doc.ticket).filter(Boolean))];
    
    const tickets = ticketIds.length
      ? await prisma.ticket.findMany({ 
          where: { id: { in: ticketIds } }, 
          select: { id: true, ref: true, status: true } 
        })
      : [];
      
    const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    
    return list.map((doc) => ({ 
      ...doc, 
      ticket: ticketsById.get(doc.ticket) || doc.ticket 
    }));
  }
}
