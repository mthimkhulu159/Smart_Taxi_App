const jwt = require('jsonwebtoken');
const config = require('config');

// Middleware to verify JWT and check for specific roles
function authorizeRole(roles = []) {
  return (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, config.get('jwtSecret'));
      req.user = decoded;

      // Check if the user role is in the allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid token', error: error.message });
    }
  };
}

module.exports = authorizeRole;
