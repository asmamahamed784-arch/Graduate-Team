import { DocumentService } from '../services/documentService.js';

// @desc    Citizen upload document for booking verification
// @route   POST /api/documents
// @access  Private
export const uploadDocument = async (req, res) => {
  try {
    const { name, fileUrl, ticketId } = req.body;
    const doc = await DocumentService.uploadDocument({ 
      name, 
      fileUrl, 
      ticketId, 
      userId: req.user.id 
    });
    return res.status(201).json({ success: true, data: doc });
  } catch (error) {
    if (error.message === 'Document name and file URL are required') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user uploaded documents
// @route   GET /api/documents
// @access  Private
export const listDocuments = async (req, res) => {
  try {
    const data = await DocumentService.listDocuments(req.user.id);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
