// src/config/socket.js (or your path)

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
            // stops: taxi.routeId ? taxi.routeId.stops : [],
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
    });

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);
        // Initialize subscription set for taxi status feature
        taxiSubscriptions.set(socket.id, new Set()); // Standard JS Set

        // =====================================================
        // === EXISTING AUTHENTICATION & CHAT FUNCTIONALITY ===
        // =====================================================
        // --- This section remains UNCHANGED ---

        // --- User Authentication/Registration ---
        socket.on('authenticate', (userId) => {
            if (userId) {
                console.log(`Authenticating user ${userId} with socket ${socket.id}`);
                // Existing cleanup logic...
                connectedUsers.forEach((sId, uId) => {
                     if (uId === userId && sId !== socket.id) {
                        console.log(`Removing old socket entry for user ${userId}`);
                        const oldSocket = io.sockets.sockets.get(sId);
                        // if(oldSocket) { oldSocket.disconnect(true); } // Optional disconnect
                     } else if (sId === socket.id && uId !== userId) {
                        console.log(`Removing old user mapping for socket ${socket.id}`);
                        connectedUsers.delete(uId);
                     }
                });
                connectedUsers.set(userId.toString(), socket.id);
                socket.userId = userId.toString(); // Attach userId to socket instance
                console.log('Connected users:', connectedUsers);
            }
        });

        // --- Chat Room Management ---
        socket.on('joinChatRoom', (chatSessionId) => {
            const chatRoomName = `chat_${chatSessionId}`; // Chat-specific room
            console.log(`Socket ${socket.id} joining CHAT room: ${chatRoomName}`);
            socket.join(chatRoomName);
        });

        socket.on('leaveChatRoom', (chatSessionId) => {
            const chatRoomName = `chat_${chatSessionId}`; // Chat-specific room
            console.log(`Socket ${socket.id} leaving CHAT room: ${chatRoomName}`);
            socket.leave(chatRoomName);
        });

        // --- Sending/Receiving Messages ---
        socket.on('sendMessage', async (data) => {
            const { chatSessionId, content } = data;
            const senderId = socket.userId;
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
        // --- This section is ADDED and operates independently ---

        /**
         * Event from DRIVER to update their taxi status.
         */
        socket.on('driver:updateTaxiInfo', async (data) => {
            const driverUserId = socket.userId;
            if (!driverUserId) { socket.emit('taxiError', { message: 'Auth required.' }); return; }

            const { taxiId, status, currentStop, currentLoad } = data;
            if (!taxiId || !status || currentStop === undefined || currentLoad === undefined) {
                 socket.emit('taxiError', { message: 'Missing fields.' }); return;
            }

            try {
                const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverUserId });
                if (!taxi) { socket.emit('taxiError', { message: 'Taxi not found/unauthorized.' }); return; }

                 const formattedData = await formatTaxiDataForBroadcast(taxiId);
                 if (!formattedData) return;

                 formattedData.status = status;
                 formattedData.currentStop = currentStop;
                 formattedData.currentLoad = currentLoad;
                  let nextStopName = "End of the route";
                  // Check if formattedData.stops exists before using findIndex (depends on formatTaxiDataForBroadcast populating it)
                  // If stops aren't populated/needed in broadcast, remove this block or adjust formatTaxiDataForBroadcast
                  if (formattedData.routeId && taxi.routeId && Array.isArray(taxi.routeId.stops)) { // Use original taxi object for stops if not populated
                      const currentStopIndex = taxi.routeId.stops.findIndex(stop => stop.name === currentStop);
                      if (currentStopIndex !== -1 && currentStopIndex < taxi.routeId.stops.length - 1) {
                          nextStopName = taxi.routeId.stops[currentStopIndex + 1].name;
                      }
                  }
                  formattedData.nextStop = nextStopName;

                const taxiRoomName = getTaxiRoomName(taxiId);
                console.log(`Relaying 'taxiUpdate' to TAXI room ${taxiRoomName}`);
                io.to(taxiRoomName).emit('taxiUpdate', formattedData);

            } catch (error) { console.error(`Error processing driver:updateTaxiInfo for ${taxiId}:`, error); socket.emit('taxiError', { message: 'Server error.' }); }
        });

        /**
         * Event from PASSENGER to subscribe to taxi updates.
         */
        socket.on('passenger:subscribeToTaxiUpdates', (data) => {
            const passengerUserId = socket.userId;
            const taxiId = data?.taxiId;

            if (!taxiId) {
                console.error(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) tried to subscribe without taxiId.`);
                socket.emit('taxiError', { message: 'Taxi ID required.' });
                return;
            }

            const taxiRoomName = getTaxiRoomName(taxiId);
            console.log(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) subscribing to TAXI room: ${taxiRoomName}`);
            socket.join(taxiRoomName);

            // Track subscription
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions) {
                subscriptions.add(String(taxiId));
            } else {
                // *** FIX APPLIED HERE: Removed <string> ***
                const newSet = new Set(); // Standard JavaScript Set
                newSet.add(String(taxiId));
                taxiSubscriptions.set(socket.id, newSet);
            }

            // Optional: Emit current state on subscribe
            formatTaxiDataForBroadcast(taxiId).then(currentData => {
                if (currentData && io.sockets.sockets.get(socket.id)) {
                   socket.emit('taxiUpdate', currentData);
                }
            }).catch(err => console.error("Error sending initial state on subscribe:", err));
        });

        /**
         * Event from PASSENGER to unsubscribe from taxi updates.
         */
        socket.on('passenger:unsubscribeFromTaxiUpdates', (data) => {
            const passengerUserId = socket.userId;
            const taxiId = data?.taxiId;

             if (!taxiId) {
                console.error(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) tried to unsubscribe without taxiId.`);
                socket.emit('taxiError', { message: 'Taxi ID required.' });
                return;
            }

            const taxiRoomName = getTaxiRoomName(taxiId);
            console.log(`Socket ${socket.id} (User: ${passengerUserId || 'N/A'}) unsubscribing from TAXI room: ${taxiRoomName}`);
            socket.leave(taxiRoomName);

            // Untrack subscription
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions) {
                subscriptions.delete(String(taxiId));
            }
        });


        // =====================================================
        // ======== DISCONNECT HANDLING (UPDATED) =============
        // =====================================================
        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);

            // --- Existing user mapping cleanup (Unchanged) ---
            if (socket.userId) {
                if (connectedUsers.get(socket.userId) === socket.id) {
                    connectedUsers.delete(socket.userId);
                    console.log(`User ${socket.userId} mapping removed.`);
                } else { console.log(`Socket ${socket.id} disconnected, user ${socket.userId} might be elsewhere.`); }
            }

            // --- Clean up taxi subscriptions (Added) ---
            const subscriptions = taxiSubscriptions.get(socket.id);
            if (subscriptions && subscriptions.size > 0) {
                // Using standard concatenation as fixed before
                console.log('Cleaning up ' + subscriptions.size + ' taxi subscriptions for socket ' + socket.id);
            }
            taxiSubscriptions.delete(socket.id); // Remove tracking entry

            console.log('Connected users after disconnect:', connectedUsers);
        });
    }); // End io.on('connection', ...)

    return io;
}

// --- Existing Exported Functions (Unchanged) ---

function getIo() {
    if (!io) { throw new Error("Socket.io not initialized!"); }
    return io;
}

function getUserSocketId(userId) {
    return connectedUsers.get(userId.toString());
}

// --- Module Exports (Unchanged) ---
module.exports = {
    initializeSocket,
    getIo,
    getUserSocketId,
};