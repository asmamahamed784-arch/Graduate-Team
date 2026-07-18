const Log = require('../models/Log');

exports.auditLog = (action) => {
  return async (req, res, next) => {
    // Intercept response to log after it's finished
    res.on('finish', async () => {
      try {
        if (req.user) { // Only log if authenticated
          await Log.create({
            action: action,
            performedBy: {
              userId: req.user._id,
              userType: req.userType
            },
            target: {
              targetId: req.params.id || null, // Assuming an ID in params is the target
              targetModel: 'Unknown' // Ideally mapped based on route
            },
            details: {
              method: req.method,
              url: req.originalUrl,
              status: res.statusCode,
              body: req.method === 'POST' || req.method === 'PUT' ? req.body : null
            },
            ipAddress: req.ip
          });
        }
      } catch (error) {
        console.error('Audit Log Error:', error.message);
      }
    });
    next();
  };
};
