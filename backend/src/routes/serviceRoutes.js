const express = require('express');
const {
  getServices,
  createService,
  getServiceCenters,
  createServiceCenter
} = require('../controllers/serviceController');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Service routes
router.route('/services')
  .get(getServices)
  .post(protect, authorize('superadmin', 'manager'), createService);

// Service Center routes
router.route('/centers')
  .get(getServiceCenters)
  .post(protect, authorize('superadmin'), createServiceCenter);

module.exports = router;
