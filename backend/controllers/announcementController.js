import Announcement from '../models/Announcement.js';

// @desc    Get active announcements
// @route   GET /api/announcements
// @access  Public
export const listAnnouncements = async (req, res) => {
  try {
    const list = await Announcement.find({ isActive: true }).populate('center', 'name');
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
    const { title, content, category, centerId, expiresAt } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      category: category || 'General',
      center: centerId || null,
      expiresAt: expiresAt || null
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
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    await Announcement.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Announcement removed.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
