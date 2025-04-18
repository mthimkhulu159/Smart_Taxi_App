const winston = require('winston');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');

// Function to mask sensitive data
const maskSensitiveData = (message) => {
  return message.replace(/user_\w+/g, '[USER_ID]')
                .replace(/socket_\w+/g, '[SOCKET_ID]');
};

// Define custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message }) => {
    const maskedMessage = maskSensitiveData(message);
    return `[${timestamp}] ${level.toUpperCase()}: ${maskedMessage}`;
  })
);

// Determine log level based on environment
const logLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

// Logger instance
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), logFormat),
    }),
    
    // Daily rotated log file for production or development
    new DailyRotateFile({
      filename: path.join(__dirname, 'logs', process.env.NODE_ENV === 'production' ? 'app-%DATE%.log' : 'app-dev-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      level: 'info',
      format: winston.format.json(),
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(__dirname, 'logs', 'error.log'),
      level: 'error',
      format: winston.format.json(),
    }),
  ],
});

// Handle uncaught exceptions & rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join(__dirname, 'logs', 'exceptions.log') })
);

logger.rejections.handle(
  new winston.transports.File({ filename: path.join(__dirname, 'logs', 'rejections.log') })
);

module.exports = logger;
