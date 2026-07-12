import Feedback from '../models/Feedback.js';
import Ticket from '../models/Ticket.js';

// @desc    Submit citizen feedback
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const { ticketId, rating, comments, comment } = req.body;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const feedback = await Feedback.create({
      ticket: ticketId,
      user: req.user ? req.user._id : null,
      rating,
      comment: comment || comments
    });

    return res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all feedback comments (Admin view)
// @route   GET /api/feedback
// @access  Private/Admin
export const listFeedback = async (req, res) => {
  try {
    const feedbackList = await Feedback.find({})
      .populate('user', 'name email')
      .populate({
        path: 'ticket',
        populate: { path: 'service center' }
      })
      .sort({ submittedAt: -1 });

    return res.json({ success: true, count: feedbackList.length, data: feedbackList });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
