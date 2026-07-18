const express = require('express');
const {
  generateTicket,
  getQueueStatus,
  updateTicketStatus
} = require('../controllers/queueController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/generate', generateTicket); // Might be public for walk-in kiosks
router.get('/:serviceCenterId', getQueueStatus); // Public for display boards
router.put('/:id/status', protect, authorize('superadmin', 'manager', 'staff'), updateTicketStatus);

module.exports = router;
