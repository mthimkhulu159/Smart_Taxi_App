// server.js
const express = require('express');
const app = express();
const http = require('http');
const dotenv = require('dotenv').config();

// Middleware & Config
const helmetMiddleware = require('./middlewares/helmetMiddleware');
const { initializeSocket } = require('./config/socket');
const corsMiddleware = require('./middlewares/corsMiddleware');
const forceHttpsMiddleware = require('./middlewares/forceHttpsMiddleware');
const errorHandler = require("./middlewares/errorHandlerMiddleware");
const { apiLimiter, loginLimiter } = require('./middlewares/rateLimiterMiddleware');
const gracefulShutdown = require('./middlewares/dbDisconnectMiddleware');
const { connectDB } = require('./config/db');
const passport = require("./config/passport");

// Routes
const userRoutes = require('./routes/userRoutes');
const authRoutes = require("./routes/authRoutes");
const taxiRoutes = require('./routes/taxiRoutes');
const taxirouteRoutes = require("./routes/taxirouteRoutes");
const rideRequestRoutes = require('./routes/rideRequestRoutes');
const chatRoutes = require('./routes/chatRoutes');
const chatGroupRoutes = require('./routes/taxiDriverGroupRoutes');


// --- Process Handlers for Robustness ---
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown(true)
   .then(() => process.exit(1))
   .catch(() => process.exit(1));
});

process.on("unhandledRejection", (reason, promise) => {
 console.error("Unhandled Rejection at:", promise, "reason:", reason);
});


// --- Express App Configuration ---

// Set trust proxy based on environment
// True if running in production behind a trusted proxy that sets X-Forwarded-For.
app.set('trust proxy', 1);


// --- Middleware Setup ---
app.use(express.json()); // Parse JSON request bodies

// Apply core security and CORS middleware
app.use(helmetMiddleware());
app.use(corsMiddleware);

// Force HTTPS in production environments
if (process.env.NODE_ENV === 'production') {
 app.use(forceHttpsMiddleware);
}


// --- Authentication Middleware ---
app.use(passport.initialize());


// --- Create HTTP Server & Initialize Socket.IO ---
const server = http.createServer(app); // Create HTTP server
initializeSocket(server); // Initialize Socket.IO on the HTTP server


// --- Database Connection ---
connectDB(); // Connect to MongoDB


// --- HTTP Rate Limiting and Route Mounting ---
// Apply login limiter specifically to auth routes
app.use("/auth", loginLimiter, authRoutes);

// Apply general API limiter to routes starting with /api.
// Routes mounted after this will be rate limited by apiLimiter.
app.use("/api/", apiLimiter);

// Mount your other API routes
app.use('/api/users', userRoutes);
app.use('/api/taxis', taxiRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chatGroups', chatGroupRoutes);
app.use("/api/admin/routes", taxirouteRoutes);
app.use("/api/routes", taxirouteRoutes); // Check if this is duplicated or intended for different access

app.use('/api/rideRequest', rideRequestRoutes);


// --- Final Error Handling Middleware ---
// Must be the last middleware applied
app.use(errorHandler);


// --- Server Startup ---
const port = process.env.PORT || 5000;
server.listen(port, () => {
 console.log(`Server is running on port ${port}`);
});


// --- Module Export ---
module.exports = server;