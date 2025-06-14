// backend/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Basic API Rate Limiter
// Limits each IP to 100 requests per 15 minutes for general API calls
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter Login Rate Limiter
// Limits each IP to 5 login attempts per hour
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 5 requests per windowMs
  message: 'Too many login attempts from this IP, please try again after an hour.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  loginLimiter,
  // Add other specific limiters here as needed
};