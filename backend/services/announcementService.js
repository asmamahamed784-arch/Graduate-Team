import prisma from '../config/prisma.js';

export class AnnouncementService {
  /**
   * Get active announcements
   */
  static async listAnnouncements() {
    const list = await prisma.announcement.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return list;
  }

  /**
   * Create new announcement
   */
  static async createAnnouncement(data, userId) {
    const { title, content, message, expiresAt } = data;

    const announcement = await prisma.announcement.create({
      data: {
        title,
        message: message || content || '',
        createdBy: userId,
        expiresAt: expiresAt || null
      }
    });

    return announcement;
  }

  /**
   * Update announcement by ID
   */
  static async updateAnnouncement(id, data) {
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    });

    if (!announcement) {
      const error = new Error('Announcement not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title: data.title ?? announcement.title,
        message: data.message ?? data.content ?? announcement.message,
        expiresAt: data.expiresAt ?? announcement.expiresAt
      }
    });

    return updated;
  }

  /**
   * Delete announcement by ID
   */
  static async deleteAnnouncement(id) {
    const announcement = await prisma.announcement.findUnique({
      where: { id }
    });

    if (!announcement) {
      const error = new Error('Announcement not found');
      error.statusCode = 404;
      throw error;
    }

    await prisma.announcement.delete({
      where: { id }
    });

    return true;
  }
}
