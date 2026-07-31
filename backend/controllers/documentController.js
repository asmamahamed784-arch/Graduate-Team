import prisma from '../config/prisma.js';

// @desc    Citizen upload document for booking verification
// @route   POST /api/documents
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    const { name, fileUrl, ticketId } = req.body;

    if (!name || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Document name and file URL are required' });
    }

    const doc = await prisma.document.create({
      data: {
        user: req.user.id,
        ticket: ticketId || null,
        name,
        fileUrl,
        status: 'Pending'
      }
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user uploaded documents
// @route   GET /api/documents
// @access  Private
export const listDocuments = async (req, res) => {
  try {
    const list = await prisma.document.findMany({ 
      where: { user: req.user.id }
    });
    const ticketIds = [...new Set(list.map((doc) => doc.ticket).filter(Boolean))];
    const tickets = ticketIds.length
      ? await prisma.ticket.findMany({ where: { id: { in: ticketIds } }, select: { id: true, ref: true, status: true } })
      : [];
    const ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const data = list.map((doc) => ({ ...doc, ticket: ticketsById.get(doc.ticket) || doc.ticket }));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
