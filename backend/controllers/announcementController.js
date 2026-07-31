import prisma from '../config/prisma.js';

// @desc    Get active announcements
// @route   GET /api/announcements
// @access  Public
export const listAnnouncements = async (req, res) => {
  try {
    const list = await prisma.announcement.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private/Admin
export const createAnnouncement = async (req, res) => {
  try {
    const { title, content, message, expiresAt } = req.body;

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message: message || content || '',
        createdBy: req.user.id,
        expiresAt: expiresAt || null
      }
    });

    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
export const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id }
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const updated = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title ?? announcement.title,
        message: req.body.message ?? req.body.content ?? announcement.message,
        expiresAt: req.body.expiresAt ?? announcement.expiresAt
      }
    });
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private/Admin
export const deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await prisma.announcement.findUnique({
      where: { id: req.params.id }
    });
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await prisma.announcement.delete({
      where: { id: req.params.id }
    });
    return res.json({ success: true, message: 'Announcement removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
