import Document from '../models/Document.js';

// @desc    Citizen upload document for booking verification
// @route   POST /api/documents
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    const { name, fileUrl, ticketId } = req.body;

    if (!name || !fileUrl) {
      return res.status(400).json({ success: false, message: 'Document name and file URL are required' });
    }

    const doc = await Document.create({
      user: req.user._id,
      ticket: ticketId || null,
      name,
      fileUrl,
      status: 'Pending'
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
    const list = await Document.find({ user: req.user._id }).populate('ticket', 'ref status');
    return res.json({ success: true, count: list.length, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
