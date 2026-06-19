/*
 * AdminMiddleware.js - Backoffice access gatekeeper
 * Purpose: Ensures only users with admin role permissions can request admin inventory/orders APIs.
 */

/**
 * Checks req.user configuration to verify admin status
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied! Administrator privileges required' });
  }
};

module.exports = { admin };
