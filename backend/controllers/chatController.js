const RideRequest = require('../models/RideRequest');
const Taxi = require('../models/Taxi');
const ChatSession = require('../models/ChatSession');
const Message = require('../models/Message');
const { getIo, getUserSocketId } = require('../config/socket');

exports.passengerInitiateChatSession = async (req, res) => {
    const passengerId = req.user._id;
    const { requestId } = req.body; // Expecting requestId from the client

    try {
        const rideRequest = await RideRequest.findById(requestId).populate('taxi');

        if (!rideRequest) {
            return res.status(404).json({ message: 'Ride request not found.' });
        }

        if (rideRequest.passenger.toString() !== passengerId.toString()) {
            return res.status(403).json({ message: 'You are not authorized to initiate chat for this request.' });
        }

        if (!rideRequest.taxi) {
            return res.status(404).json({ message: 'Assigned taxi not found.' });
        }

        const driverId = rideRequest.taxi.driverId;

        // Check if a ChatSession already exists for this ride request
        let chatSession = await ChatSession.findOne({ rideRequest: rideRequest._id });

        if (chatSession) {
            // Chat already exists, return its ID
            return res.status(200).json({
                message: 'Chat session already exists.',
                chatSessionId: chatSession._id
            });
        }

        // Create a new ChatSession
        chatSession = new ChatSession({
            rideRequest: rideRequest._id,
            passenger: passengerId,
            driver: driverId,
        });
        await chatSession.save();

        // Optional: Notify driver via socket if they are connected
        const driverSocketId = getUserSocketId(driverId);
        if (driverSocketId) {
            getIo().to(driverSocketId).emit('newChatSession', {
                chatSessionId: chatSession._id,
                rideRequestId: rideRequest._id,
                passengerName: req.user.name
            });
        }

        return res.status(201).json({
            message: 'Chat session initiated successfully.',
            chatSessionId: chatSession._id
        });

    } catch (error) {
        console.error('Error initiating chat session:', error);
        return res.status(500).json({ message: 'Server error initiating chat.' });
    }
};

exports.driverInitiateChatSession = async (req, res) => {
    const driverId = req.user._id;

    try {
        // Find the ride request linked to the driver's taxi
        const rideRequest = await RideRequest.findOne({
            _id: req.body.requestId, // Expect the requestId to be passed from the driver
            status: "accepted",  // Ride request must be accepted
            taxi: { $exists: true },  // Taxi must be assigned
        }).populate("passenger taxi");

        if (!rideRequest) {
            return res.status(404).json({
                message: "No accepted ride request found for this taxi to initiate chat.",
            });
        }

        // Ensure that the taxi's driverId matches the logged-in driver.
        if (rideRequest.taxi.driverId.toString() !== driverId.toString()) {
            return res.status(403).json({
                message: "You are not authorized to initiate chat for this request.",
            });
        }

        // Check if a chat session already exists for this ride request.
        let chatSession = await ChatSession.findOne({ rideRequest: rideRequest._id });
        if (chatSession) {
            return res.status(200).json({
                message: "Chat session already exists.",
                chatSessionId: chatSession._id,
            });
        }

        // Create a new chat session.
        chatSession = new ChatSession({
            rideRequest: rideRequest._id,
            passenger: rideRequest.passenger._id,
            driver: driverId,
        });
        await chatSession.save();

        // Notify the passenger via socket if connected.
        const passengerSocketId = getUserSocketId(rideRequest.passenger._id);
        if (passengerSocketId) {
            getIo().to(passengerSocketId).emit("newChatSession", {
                chatSessionId: chatSession._id,
                rideRequestId: rideRequest._id,
                driverName: req.user.name,
            });
        }

        return res.status(201).json({
            message: "Chat session initiated successfully.",
            chatSessionId: chatSession._id,
        });
    } catch (error) {
        console.error("Error initiating chat session:", error);
        return res.status(500).json({ message: "Server error initiating chat." });
    }
};


exports.getChatMessages = async (req, res) => {
    const { chatSessionId } = req.params;
    const userId = req.user._id;

    try {
        const chatSession = await ChatSession.findById(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }

        const isParticipant = chatSession.passenger.equals(userId) || chatSession.driver.equals(userId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied. You are not part of this chat.' });
        }

        const messages = await Message.find({ chatSession: chatSessionId })
            .sort({ createdAt: 1 })
            .populate('sender', 'name email');

        return res.status(200).json(messages);

    } catch (error) {
        console.error('Error fetching chat messages:', error);
        return res.status(500).json({ message: 'Server error fetching messages.' });
    }
};

exports.sendMessage = async (req, res) => {
    const { chatSessionId } = req.params;
    const { content } = req.body;
    const senderId = req.user._id;

    try {
        const chatSession = await ChatSession.findById(chatSessionId);
        if (!chatSession) {
            return res.status(404).json({ message: 'Chat session not found.' });
        }

        const isParticipant = chatSession.passenger.equals(senderId) || chatSession.driver.equals(senderId);
        if (!isParticipant) {
            return res.status(403).json({ message: 'Access denied. You are not part of this chat.' });
        }

        const newMessage = new Message({
            chatSession: chatSessionId,
            sender: senderId,
            content: content,
        });

        await newMessage.save();

        const passengerSocketId = getUserSocketId(chatSession.passenger);
        const driverSocketId = getUserSocketId(chatSession.driver);

        if (passengerSocketId) {
            getIo().to(passengerSocketId).emit('newMessage', {
                message: newMessage,
                chatSessionId: chatSessionId,
            });
        }

        if (driverSocketId && !senderId.equals(chatSession.driver)) {
            getIo().to(driverSocketId).emit('newMessage', {
                message: newMessage,
                chatSessionId: chatSessionId,
            });
        }

        return res.status(201).json({ message: 'Message sent successfully.', message: newMessage });

    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ message: 'Server error sending message.' });
    }
};