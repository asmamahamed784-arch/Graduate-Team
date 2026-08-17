import { FeedbackService } from '../services/feedbackService.js';

// @desc    Submit citizen feedback
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const { ticketId, rating, comments, comment } = req.body;
    const data = await FeedbackService.submitFeedback({
      ticketId,
      rating,
      comments,
      comment,
      userId: req.user ? req.user.id : null
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.message === 'Ticket not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all feedback comments (Admin view)
// @route   GET /api/feedback
// @access  Private/Admin
export const listFeedback = async (req, res) => {
  try {
    const data = await FeedbackService.listFeedback();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
