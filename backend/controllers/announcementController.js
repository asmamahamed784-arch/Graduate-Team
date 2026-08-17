import { AnnouncementService } from '../services/announcementService.js';

// @desc    Get active announcements
// @route   GET /api/announcements
// @access  Public
export const listAnnouncements = async (req, res) => {
  try {
    const list = await AnnouncementService.listAnnouncements();
    return res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private/Admin
export const createAnnouncement = async (req, res) => {
  try {
    const announcement = await AnnouncementService.createAnnouncement(req.body, req.user?.id);
    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
export const updateAnnouncement = async (req, res) => {
  try {
    const updated = await AnnouncementService.updateAnnouncement(req.params.id, req.body);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private/Admin
export const deleteAnnouncement = async (req, res) => {
  try {
    await AnnouncementService.deleteAnnouncement(req.params.id);
    return res.json({ success: true, message: 'Announcement removed.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

