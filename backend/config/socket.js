// src/config/socket.js

const socketIo = require('socket.io');
const ChatSession = require('../models/ChatSession'); // Adjust path as needed
const Message = require('../models/Message'); // Adjust path as needed
const User = require('../models/User'); // Adjust path as needed
const Taxi = require('../models/Taxi'); // *** Import Taxi model ***
const Route = require('../models/Route'); // Import Route model for formatting data

let io;

// Store connected users (both passengers and drivers)
// Map: userId -> socketId
const connectedUsers = new Map();

// --- Store taxi subscriptions for live updates ---
// Map: socketId -> Set<taxiId>
const taxiSubscriptions = new Map(); // Specific map for taxi status feature

// =====================================================
// ======== SOCKET.IO RATE LIMITING LOGIC ==============
// =====================================================

// --- State Storage (In-Memory) ---
// For multiple server instances, replace these Maps with a Redis client or similar
const connectionAttempts = new Map(); // Map: IP -> { count: number, firstAttemptTime: Date }
const eventCounts = new Map(); // Map: socket.id -> { [eventName]: { count: number, firstEventTime: Date } }

// --- Configuration ---
const CONNECTION_WINDOW_MS = 60 * 1000; // 1 minute window for connection attempts
const MAX_CONNECTION_ATTEMPTS = 15; // Increased slightly as login takes time. Adjust as needed. Max attempts per minute per IP

const EVENT_WINDOW_MS = 1000; // 1 second window for events
const MAX_EVENTS_PER_SECOND = 15; // Max 15 messages/events of a specific type per second per socket. Adjust as needed.

// --- Cleanup Timer ---
// Periodically clean up old entries from connectionAttempts to prevent memory growth
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, { count, firstAttemptTime }] of connectionAttempts.entries()) {
        // Remove entries well past the window (e.g., twice the window duration)
        if (now - firstAttemptTime > CONNECTION_WINDOW_MS * 2) {
            connectionAttempts.delete(ip);
            // console.log(`Cleaned up expired connection attempts for IP: ${ip}`); // Optional: log cleanup
        }
    }
}, CONNECTION_WINDOW_MS); // Run cleanup check roughly every window period

// Stop the interval when the process exits
process.on('exit', () => {
    clearInterval(cleanupInterval);
    console.log('Socket rate limiter cleanup interval stopped.');
});

/**
 * Checks if a new connection attempt from this socket's IP is allowed based on rate limits.
 * @param {Socket} socket The Socket.IO socket object.
 * @returns {boolean} True if allowed, false if rate limited.
 */
function checkConnectionAttempt(socket) {
    const clientIp = socket.request.socket.remoteAddress;
    const now = Date.now();

    if (connectionAttempts.has(clientIp)) {
        const { count, firstAttemptTime } = connectionAttempts.get(clientIp);

        if (now - firstAttemptTime > CONNECTION_WINDOW_MS) {
            // Window expired for this IP, reset count
            connectionAttempts.set(clientIp, { count: 1, firstAttemptTime: now });
            return true; // Allowed
        } else {
            // Within window for this IP, check count
            if (count >= MAX_CONNECTION_ATTEMPTS) {
                console.warn(`Rate limiting connection from IP: ${clientIp} - Too many attempts (${count})`);
                // Increment count even if denied to track persistent attempts
                connectionAttempts.set(clientIp, { count: count + 1, firstAttemptTime: firstAttemptTime });
                return false; // Rate limited
            } else {
                // Within window and count below max, increment count and allow
                connectionAttempts.set(clientIp, { count: count + 1, firstAttemptTime: firstAttemptTime });
                return true; // Allowed
            }
        }
    } else {
        // First attempt from this IP in the current window
        connectionAttempts.set(clientIp, { count: 1, firstAttemptTime: now });
        return true; // Allowed
    }
}

/**
 * Checks if an event from this socket is allowed based on rate limits per event type.
 * @param {Socket} socket The Socket.IO socket object.
 * @param {string} eventName The name of the event being sent.
 * @returns {boolean} True if allowed, false if rate limited.
 */
function checkEventRate(socket, eventName) {
    // We might want to rate limit specific events, not ALL events equally.
    // This example applies the same limit to any event name passed.
    // You could add logic here to have different limits for different eventName values (e.g., stricter for sendMessage).

    const now = Date.now();
    const socketId = socket.id;

    if (!eventCounts.has(socketId)) {
        eventCounts.set(socketId, {});
    }
    const socketEvents = eventCounts.get(socketId);

    if (!socketEvents[eventName] || now - socketEvents[eventName].firstEventTime > EVENT_WINDOW_MS) {
        // Reset count for this event for this socket (new window or first event)
        socketEvents[eventName] = { count: 1, firstEventTime: now };
        return true; // Allowed
    } else {
        // Within window, check count
        if (socketEvents[eventName].count >= MAX_EVENTS_PER_SECOND) {
            console.warn(`Rate limiting event '${eventName}' from socket ${socketId} - Too many events (${socketEvents[eventName].count})`);
            // Increment count even if denied to track persistent attempts
            socketEvents[eventName].count++;
            return false; // Rate limited
        } else {
            // Within window and count below max, increment and allow
            socketEvents[eventName].count++;
            return true; // Allowed
        }
    }
}

/**
 * Cleans up state in the rate limiter when a socket disconnects. Call this in your disconnect handler.
 * @param {string} socketId The ID of the disconnected socket.
 */
function cleanupDisconnectedSocket(socketId) {
    eventCounts.delete(socketId);
    // console.log(`Cleaned up event counts for socket: ${socketId}`); // Optional: log cleanup

    // Note: connectionAttempts are cleaned up by the setInterval timer based on IP and time
}

// =====================================================
// ====== END SOCKET.IO RATE LIMITING LOGIC ============
// =====================================================


// --- Helper function to get room name for a taxi ---
function getTaxiRoomName(taxiId) {
    return `taxi_${String(taxiId)}`; // Specific room name for taxi status
}

// --- Helper function to format Taxi Data for Emission ---
const formatTaxiDataForBroadcast = async (taxiId) => {
    try {
        // Fetch fresh data with populated fields
        const taxi = await Taxi.findById(taxiId)
            .populate('routeId', 'routeName stops')
            .populate('driverId', 'name username'); // Or the fields you need

        if (!taxi) return null;

        // Determine next stop safely
        let nextStopName = "End of the route";
        if (taxi.routeId && Array.isArray(taxi.routeId.stops)) {
            const currentStopIndex = taxi.routeId.stops.findIndex(stop => stop.name === taxi.currentStop);
            if (currentStopIndex !== -1 && currentStopIndex < taxi.routeId.stops.length - 1) {
                nextStopName = taxi.routeId.stops[currentStopIndex + 1].name;
            }
        }

        return {
            _id: taxi._id,
            numberPlate: taxi.numberPlate,
            status: taxi.status,
            currentStop: taxi.currentStop,
            currentLoad: taxi.currentLoad,
            capacity: taxi.capacity, // Use capacity field from schema
            routeName: taxi.routeId ? taxi.routeId.routeName : 'N/A',
            driverName: taxi.driverId ? (taxi.driverId.name || taxi.driverId.username) : 'N/A',
            driverId: taxi.driverId ? taxi.driverId._id : null,
            routeId: taxi.routeId ? taxi.routeId._id : null,
            // Stops might be too large for frequent updates, consider if needed
            // stops: taxi.routeId ? taxi.routeId.stops : [], // Removed this for potentially large data
            nextStop: nextStopName,
            updatedAt: taxi.updatedAt
        };
    } catch (error) {
        console.error(`Error formatting taxi data for broadcast (ID: ${taxiId}):`, error);
        return null; // Return null on error
    }
};


function initializeSocket(server) {
    if (io) return io;

    io = socketIo(server, {
        cors: {
            origin: '*', // Adjust this for PRODUCTION security
        },
        // Add ping/pong settings to help detect dead connections faster
        // Adjust values based on desired responsiveness vs potential overhead
        pingTimeout: 15000, // How long to wait for a pong before considering the connection failed
        pingInterval: 5000 // How often to send a ping
    });

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // --- Apply Socket.IO Connection Rate Limit ---
        // Check if this IP is attempting to connect too frequently
        if (!checkConnectionAttempt(socket)) {
            console.log(`Disconnecting rate-limited socket: ${socket.id} from IP: ${socket.request.socket.remoteAddress}`);
            socket.disconnect(true); // Disconnect immediately if rate limited
            return; // Stop processing this connection
        }
        console.log(`Connection attempt allowed for socket: ${socket.id} from IP: ${socket.request.socket.remoteAddress}`); // Log successful attempt check


        // Initialize subscription set for taxi status feature
        taxiSubscriptions.set(socket.id, new Set()); // Standard JS Set

        // =====================================================
        // === EXISTING AUTHENTICATION & CHAT FUNCTIONALITY ===
        // =====================================================

        // --- User Authentication/Registration ---
        socket.on('authenticate', (userId) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'authenticate')) {
                console.warn(`Rate limited 'authenticate' event from socket ${socket.id}`);
                return; // Stop processing this event
            }
            if (userId) {
                console.log(`Authenticating user ${userId} with socket ${socket.id}`);
                // Existing cleanup logic...
                connectedUsers.forEach((sId, uId) => {
                    if (uId === userId && sId !== socket.id) {
                        console.log(`Removing old socket entry for user ${userId} (old socket: ${sId})`);
                        const oldSocket = io.sockets.sockets.get(sId);
                        // Optional: Disconnect the old socket explicitly if needed
                        // if(oldSocket && oldSocket.connected) {
                        //     oldSocket.disconnect(true); // Cleanly disconnect the old one
                        //     console.log(`Disconnected old socket ${sId} for user ${userId}`);
                        // }
                    } else if (sId === socket.id && uId !== userId) {
                        // This case is less likely with current logic but good for robustness
                        console.log(`Removing old user mapping ${uId} for current socket ${socket.id}`);
                        connectedUsers.delete(uId);
                    }
                });
                connectedUsers.set(userId.toString(), socket.id);
                socket.userId = userId.toString(); // Attach userId to socket instance
                console.log('Connected users:', connectedUsers);
            } else {
                // If authentication fails or userId is missing in event data
                console.warn(`Authentication failed for socket ${socket.id}: Missing or invalid userId.`);
                // Optionally disconnect or emit an error
                // socket.emit('authError', { message: 'Authentication failed or missing user ID.' });
                // socket.disconnect(true);
            }
        });

        // --- Chat Room Management ---
        socket.on('joinChatRoom', (chatSessionId) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'joinChatRoom')) {
                console.warn(`Rate limited 'joinChatRoom' event from socket ${socket.id}`);
                return; // Stop processing this event
            }
            const chatRoomName = `chat_${chatSessionId}`; // Chat-specific room
            console.log(`Socket ${socket.id} joining CHAT room: ${chatRoomName}`);
            socket.join(chatRoomName);
        });

        socket.on('leaveChatRoom', (chatSessionId) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'leaveChatRoom')) {
                console.warn(`Rate limited 'leaveChatRoom' event from socket ${socket.id}`);
                return; // Stop processing this event
            }
            const chatRoomName = `chat_${chatSessionId}`; // Chat-specific room
            console.log(`Socket ${socket.id} leaving CHAT room: ${chatRoomName}`);
            socket.leave(chatRoomName);
        });

        // --- Sending/Receiving Messages ---
        socket.on('sendMessage', async (data) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'sendMessage')) {
                console.warn(`Rate limited 'sendMessage' event from socket ${socket.id}`);
                return; // Stop processing this event
            }
            const { chatSessionId, content } = data;
            const senderId = socket.userId; // Assume userId is attached during 'authenticate'
            if (!senderId) { socket.emit('chatError', { message: 'Auth required.' }); return; }
            if (!chatSessionId || !content) { socket.emit('chatError', { message: 'Missing fields.' }); return; }
            try {
                const chatSession = await ChatSession.findById(chatSessionId);
                if (!chatSession) { socket.emit('chatError', { message: 'Chat not found.' }); return; }
                const isParticipant = chatSession.passenger.toString() === senderId || chatSession.driver.toString() === senderId;
                if (!isParticipant) { socket.emit('chatError', { message: 'Not participant.' }); return; }
                const message = new Message({ chatSession: chatSessionId, sender: senderId, content: content });
                await message.save();
                chatSession.lastMessageAt = message.createdAt;
                await chatSession.save();
                const savedMessage = await Message.findById(message._id).populate('sender', 'name email');
                if (savedMessage) {
                    const chatRoomName = `chat_${chatSessionId}`; // Chat-specific room
                    console.log(`Emitting receiveMessage to CHAT room ${chatRoomName}`);
                    io.to(chatRoomName).emit('receiveMessage', savedMessage); // Emit only to chat room
                } else { throw new Error("Failed to retrieve message."); }
            } catch (error) { console.error('Error sending message:', error); socket.emit('chatError', { message: 'Error sending.' }); }
        });

        // =====================================================
        // ===== NEW TAXI LIVE STATUS UPDATE FUNCTIONALITY =====
        // =====================================================

        /**
         * Event from DRIVER to update their taxi status.
         */
        socket.on('driver:updateTaxiInfo', async (data) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'driver:updateTaxiInfo')) {
                console.warn(`Rate limited 'driver:updateTaxiInfo' event from socket ${socket.id}`);
                return; // Stop processing this event
            }

            const driverUserId = socket.userId; // Assume userId is attached during 'authenticate'
            if (!driverUserId) { socket.emit('taxiError', { message: 'Auth required.' }); return; }

            const { taxiId, status, currentStop, currentLoad } = data;
            if (!taxiId || status === undefined || currentStop === undefined || currentLoad === undefined) { // Check status/load specifically if they can be falsy
                socket.emit('taxiError', { message: 'Missing fields.' }); return;
            }

            try {
                const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverUserId }).populate('routeId', 'stops'); // Populate stops only if needed here
                if (!taxi) { socket.emit('taxiError', { message: 'Taxi not found or unauthorized for this driver.' }); return; }

                // Update the taxi object in the database
                taxi.status = status;
                taxi.currentStop = currentStop;
                taxi.currentLoad = currentLoad;
                await taxi.save();


                // Fetch fresh data for broadcasting (might include other fields like routeName, driverName)
                const formattedData = await formatTaxiDataForBroadcast(taxiId);
                if (!formattedData) {
                    console.error(`Failed to format taxi data for broadcast after update (ID: ${taxiId}).`);
                    // Decide if you want to send an error to the driver or just log
                    socket.emit('taxiError', { message: 'Failed to format broadcast data.' });
                    return;
                }

                const taxiRoomName = getTaxiRoomName(taxiId);
                console.log(`Emitting 'taxiUpdate' to TAXI room ${taxiRoomName} (Taxi ID: ${taxiId})`);
                io.to(taxiRoomName).emit('taxiUpdate', formattedData);

            } catch (error) { console.error(`Error processing driver:updateTaxiInfo for ${taxiId}:`, error); socket.emit('taxiError', { message: 'Server error during update.' }); }
        });

        /**
         * Event from PASSENGER to subscribe to taxi updates.
         */
        socket.on('passenger:subscribeToTaxiUpdates', (data) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'passenger:subscribeToTaxiUpdates')) {
                console.warn(`Rate limited 'passenger:subscribeToTaxiUpdates' event from socket ${socket.id}`);
                return; // Stop processing this event
            }

            const passengerUserId = socket.userId; // Assume userId is attached during 'authenticate'
            // Optional: Require authentication for subscription
            // if (!passengerUserId) { socket.emit('taxiError', { message: 'Auth required to subscribe.' }); return; }

            const taxiId = data?.taxiId;

            if (!taxiId) {
                console.error(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) tried to subscribe without taxiId.`);
                socket.emit('taxiError', { message: 'Taxi ID required for subscription.' });
                return;
            }

            const taxiRoomName = getTaxiRoomName(taxiId);
            console.log(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) joining TAXI room: ${taxiRoomName} for taxi ID ${taxiId}`);
            socket.join(taxiRoomName);

            // Track subscription
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions) {
                subscriptions.add(String(taxiId)); // Add taxiId (as string) to the set
            } else {
                const newSet = new Set(); // Standard JavaScript Set
                newSet.add(String(taxiId));
                taxiSubscriptions.set(socket.id, newSet);
            }
            console.log(`Current subscriptions for socket ${socket.id}:`, Array.from(taxiSubscriptions.get(socket.id) || []));


            // Optional: Emit current state on successful subscribe
            formatTaxiDataForBroadcast(taxiId).then(currentData => {
                // Check if the socket is still connected and subscribed to this specific taxi room before emitting
                if (currentData && io.sockets.sockets.get(socket.id) && socket.rooms.has(taxiRoomName)) {
                    console.log(`Emitting initial 'taxiUpdate' to socket ${socket.id} for taxi ${taxiId}`);
                    socket.emit('taxiUpdate', currentData);
                } else if (!currentData) {
                    console.warn(`Failed to send initial taxi data for subscription of taxi ${taxiId} to socket ${socket.id}: data formatting failed.`);
                } else {
                    console.warn(`Did not send initial taxi data for subscription of taxi ${taxiId} to socket ${socket.id}: socket disconnected or left room.`);
                }
            }).catch(err => console.error("Error sending initial state on subscribe:", err));
        });

        /**
         * Event from PASSENGER to unsubscribe from taxi updates.
         */
        socket.on('passenger:unsubscribeFromTaxiUpdates', (data) => {
            // --- Apply Event Rate Limit ---
            if (!checkEventRate(socket, 'passenger:unsubscribeFromTaxiUpdates')) {
                console.warn(`Rate limited 'passenger:unsubscribeFromTaxiUpdates' event from socket ${socket.id}`);
                return; // Stop processing this event
            }
            const passengerUserId = socket.userId;
            const taxiId = data?.taxiId;

            if (!taxiId) {
                console.error(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) tried to unsubscribe without taxiId.`);
                socket.emit('taxiError', { message: 'Taxi ID required for unsubscription.' });
                return;
            }

            const taxiRoomName = getTaxiRoomName(taxiId);
            console.log(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) leaving TAXI room: ${taxiRoomName} for taxi ID ${taxiId}`);
            socket.leave(taxiRoomName);

            // Untrack subscription
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions) {
                subscriptions.delete(String(taxiId)); // Remove taxiId (as string) from the set
                console.log(`Removed subscription for taxi ${taxiId} from socket ${socket.id}`);
            } else {
                console.warn(`Attempted to remove subscription for taxi ${taxiId} from socket ${socket.id}, but no subscriptions tracked for this socket.`);
            }
            console.log(`Current subscriptions for socket ${socket.id}:`, Array.from(taxiSubscriptions.get(socket.id) || []));
        });


        // =====================================================
        // ======== DISCONNECT HANDLING (UPDATED) =============
        // =====================================================
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);

            // --- Existing user mapping cleanup ---
            if (socket.userId) {
                if (connectedUsers.get(socket.userId) === socket.id) {
                    connectedUsers.delete(socket.userId);
                    console.log(`User ${socket.userId} mapping removed.`);
                } else {
                    // This case means the user reconnected quickly elsewhere, and this old socket disconnected
                    console.log(`Socket ${socket.id} disconnected, user ${socket.userId} has a new socket.`);
                }
            } else {
                console.log(`Disconnected socket ${socket.id} was not authenticated.`);
            }


            // --- Clean up socket-specific rate limiting state ---
            cleanupDisconnectedSocket(socket.id);


            // --- Clean up taxi subscriptions tracked for this socket ---
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions && subscriptions.size > 0) {
                console.log(`Cleaning up ${subscriptions.size} taxi subscriptions for socket ${socket.id}`);
            }
            taxiSubscriptions.delete(socket.id); // Remove tracking entry

            console.log('Connected users after disconnect:', connectedUsers.size);
        });
    }); // End io.on('connection', ...)

    return io; // Return the io instance

} // End initializeSocket function

// --- Existing Exported Functions ---

function getIo() {
    if (!io) { throw new Error("Socket.io not initialized! Call initializeSocket(server) first."); }
    return io;
}

function getUserSocketId(userId) {
    return connectedUsers.get(userId.toString());
}

// --- Module Exports ---
module.exports = {
    initializeSocket,
    getIo,
    getUserSocketId,
};