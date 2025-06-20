// src/controllers/taxiController.js (or your path)

// --- Model Imports ---
const Taxi = require("../models/Taxi");
const Route = require("../models/Route");
const User = require("../models/User");
const RideRequest = require("../models/RideRequest"); // Assuming you have this model for deleteTaxi

// --- Configuration Imports ---
const { getIo } = require("../config/socket"); // Import shared Socket.IO instance

// --- Helper function to format Taxi Data for Emission ---
// (Consistent formatting for API responses and socket events)
const formatTaxiDataForEmit = (taxi) => {
    if (!taxi) return null;

    let nextStopName = "End of the route"; // Default value

    // Ensure routeId and stops are populated and valid
    const stops = (taxi.routeId && typeof taxi.routeId === 'object' && Array.isArray(taxi.routeId.stops))
        ? [...taxi.routeId.stops].sort((a, b) => a.order - b.order) // Clone and sort stops by order
        : [];

    // Determine the direction, defaulting to 'forward' if not set
    const direction = taxi.direction || 'forward';

    // Find the index of the current stop within the sorted list
    const currentStopIndex = stops.findIndex(stop => stop.name === taxi.currentStop);

    if (currentStopIndex !== -1 && stops.length > 0) {
        // Calculate next stop based on direction
        if (direction === 'forward') {
            if (currentStopIndex < stops.length - 1) {
                // If moving forward and not at the last stop, the next stop is the next one in the array
                nextStopName = stops[currentStopIndex + 1].name;
            } else {
                // If moving forward and at the last stop, indicate end
                nextStopName = "End of the route";
            }
        } else if (direction === 'return') { // *** CORRECTED: Check for 'return' ***
            if (currentStopIndex > 0) {
                // If moving in return and not at the first stop (index 0), the next stop is the previous one
                nextStopName = stops[currentStopIndex - 1].name;
            } else {
                // If moving in return and at the first stop, indicate end (of the return journey)
                nextStopName = "End of the route"; // Or potentially the first stop name again if it loops
            }
        }
        // If direction is neither 'forward' nor 'return', nextStopName remains "End of the route"
    } else if (stops.length === 0) {
        console.warn(`[formatTaxiDataForEmit] Taxi ${taxi._id} has a route with no stops.`);
        nextStopName = "Route has no stops";
    } else {
        console.warn(`[formatTaxiDataForEmit] Taxi ${taxi._id} current stop '${taxi.currentStop}' not found in its route stops.`);
        nextStopName = "Stop not found";
    }


    // Safely access driver details
    const driverName = (taxi.driverId && typeof taxi.driverId === 'object')
        ? (taxi.driverId.name || taxi.driverId.username || 'Unknown Driver') // Add fallback
        : 'N/A';
    const driverId = (taxi.driverId && typeof taxi.driverId === 'object')
        ? taxi.driverId._id
        : (taxi.driverId || null); // Keep original ID if not populated

    // Safely access route details
    const routeName = (taxi.routeId && typeof taxi.routeId === 'object')
        ? taxi.routeId.routeName
        : 'N/A';
    const routeId = (taxi.routeId && typeof taxi.routeId === 'object')
        ? taxi.routeId._id
        : (taxi.routeId || null); // Keep original ID if not populated

    // Return the formatted data object
    return {
        _id: taxi._id,
        numberPlate: taxi.numberPlate,
        status: taxi.status,
        currentStop: taxi.currentStop,
        currentLoad: taxi.currentLoad,
        capacity: taxi.capacity,
        routeName: routeName,
        driverName: driverName,
        driverId: driverId,
        routeId: routeId,
        stops: stops, // Return the sorted stops array
        nextStop: nextStopName, // The calculated next stop
        direction: direction, // The actual direction used
        allowReturnPickups: taxi.allowReturnPickups, // Include this field
        updatedAt: taxi.updatedAt
    };
};

// --- Add Taxi ---
// Creates a new taxi associated with the logged-in driver.
// (No socket emission needed here usually, maybe emit to an admin room?)
exports.addTaxi = async (req, res, next) => {
    try {
        const userId = req.user.id; // Assumes middleware adds user object to req

        // Verify user exists and has the 'driver' role
        const user = await User.findById(userId);
        if (!user || !user.role.includes("driver")) {
            return res.status(403).json({ message: "Forbidden: Only drivers can add a taxi." });
        }

        // Destructure and validate request body
        const { numberPlate, routeName, capacity, currentStop, allowReturnPickups } = req.body;
        if (!numberPlate || !routeName || !capacity || !currentStop) {
            return res.status(400).json({ message: "Bad Request: numberPlate, routeName, capacity, and currentStop are required." });
        }
        if (isNaN(capacity) || Number(capacity) <= 0) {
            return res.status(400).json({ message: "Bad Request: Capacity must be a positive number." });
        }

        // Check if a taxi with the same number plate already exists
        const existingTaxi = await Taxi.findOne({ numberPlate });
        if (existingTaxi) {
            return res.status(409).json({ message: `Conflict: Taxi with number plate '${numberPlate}' already exists.` });
        }

        // Find the specified route
        const route = await Route.findOne({ routeName });
        if (!route) {
            return res.status(404).json({ message: `Not Found: Route '${routeName}' not found.` });
        }

        // Validate that the provided currentStop exists on the found route
        const stopExists = route.stops.some(stop => stop.name === currentStop);
        if (!stopExists) {
            return res.status(400).json({ message: `Bad Request: Stop '${currentStop}' does not exist on route '${routeName}'.` });
        }

        // Create the new Taxi document
        const newTaxi = new Taxi({
            numberPlate: numberPlate.trim(), // Trim whitespace
            routeId: route._id,
            driverId: userId,
            capacity: Number(capacity),
            currentStop: currentStop,
            status: "available", // Initial status
            currentLoad: 0,      // Initial load
            direction: "forward", // Initial direction
            allowReturnPickups: allowReturnPickups === true // Ensure boolean storage
        });

        // Save the new taxi
        await newTaxi.save();

        // Populate related fields for the response
        await newTaxi.populate('routeId', 'routeName stops');
        await newTaxi.populate('driverId', 'name username'); // Populate fields you need

        // Respond with success message and formatted taxi data
        res.status(201).json({
            message: "Taxi added successfully.",
            taxi: formatTaxiDataForEmit(newTaxi) // Use the consistent formatter
        });

    } catch (error) {
        console.error("Error adding taxi:", error);
        // Pass error to the global error handler (if configured)
        // or send a generic server error response
        res.status(500).json({ message: "Internal Server Error adding taxi", error: error.message });
        // next(error); // Use if you have an error handling middleware
    }
};


// --- Search Taxis ---
// Finds available taxis that operate on routes covering the specified start and end locations
// and are heading in the correct direction to pick up the passenger.
exports.searchTaxis = async (req, res, next) => {
    try {
        const { startLocation, endLocation } = req.query;
        console.log(`[DEBUG] Search Request: startLocation=${startLocation}, endLocation=${endLocation}`);

        // Validate input
        if (!startLocation || !endLocation) {
            return res.status(400).json({ message: "Bad Request: Both startLocation and endLocation query parameters are required." });
        }
        if (startLocation === endLocation) {
            return res.status(400).json({ message: "Bad Request: Start and end locations cannot be the same." });
        }

        // 1. Find routes that contain BOTH the start and end locations
        const routes = await Route.find({
            'stops.name': { $all: [startLocation, endLocation] }
        }).lean();

        console.log("[DEBUG] Found Routes:", routes.length > 0 ? routes.map(r => r._id) : "None");
        if (!routes || routes.length === 0) {
            return res.status(404).json({ message: `Not Found: No routes found covering both '${startLocation}' and '${endLocation}'.` });
        }

        // 2. Determine the direction of travel for the passenger on each valid route
        const validRouteDetails = routes.map(route => {
            const stops = route.stops.sort((a, b) => a.order - b.order);
            const startIdx = stops.findIndex(s => s.name === startLocation);
            const endIdx = stops.findIndex(s => s.name === endLocation);

            if (startIdx === -1 || endIdx === -1) {
                return null;
            }

            const passengerDirection = startIdx < endIdx ? 'forward' : 'return';

            return {
                routeId: route._id,
                passengerDirection: passengerDirection,
                startIdx: startIdx,
                stops: stops
            };
        }).filter(details => details !== null);

        console.log("[DEBUG] Valid Route Details:", validRouteDetails.length > 0 ? validRouteDetails.map(d => ({ routeId: d.routeId.toString(), passengerDirection: d.passengerDirection })) : "None");

        if (validRouteDetails.length === 0) {
            return res.status(404).json({ message: "Not Found: Could not determine valid travel direction on found routes." });
        }

        const validRouteIds = validRouteDetails.map(r => r.routeId);
        console.log("[DEBUG] Valid Route IDs for Aggregation:", validRouteIds.map(id => id.toString()));

        // 3. Find taxis on these valid routes that are potentially available using Aggregation Framework
        const availableStatuses = ["waiting", "available", "almost full", "roaming", "on trip"];
        console.log("[DEBUG] Available Statuses for Taxi Filter:", availableStatuses);

        const candidateTaxis = await Taxi.aggregate([
            {
                $match: {
                    routeId: { $in: validRouteIds },
                    status: { $in: availableStatuses },
                    $expr: { $lt: ["$currentLoad", "$capacity"] }
                }
            },
            {
                $lookup: {
                    from: 'routes',
                    localField: 'routeId',
                    foreignField: '_id',
                    as: 'routeInfo' // Renamed to avoid overwriting routeId
                }
            },
            {
                $unwind: '$routeInfo'
            },
            {
                $lookup: {
                    from: 'users', // CORRECTED: Use 'users' collection for the User model
                    localField: 'driverId',
                    foreignField: '_id',
                    as: 'driverInfo' // Renamed to avoid overwriting driverId
                }
            },
            {
                $unwind: '$driverInfo'
            },
            {
                $project: { 
                    _id: 1,
                    numberPlate: 1, status: 1, currentLoad: 1, capacity: 1,
                    direction: 1, currentStop: 1, allowReturnPickups: 1, updatedAt: 1,
                    // Reconstruct fields clearly
                    route: { _id: '$routeInfo._id', routeName: '$routeInfo.routeName', stops: '$routeInfo.stops' },
                    driver: { _id: '$driverInfo._id', name: '$driverInfo.name', email: '$driverInfo.email' }, // CORRECTED: Use fields from User model
                    // Keep original IDs for reference if needed
                    routeId: '$routeInfo._id',
                    driverId: '$driverInfo._id'
                }
            }
        ]);

        console.log("[DEBUG] Candidate Taxis after Aggregation:", candidateTaxis.length > 0 ? candidateTaxis.map(t => t._id) : "None");

        if (!candidateTaxis || candidateTaxis.length === 0) {
            return res.status(404).json({ message: "Not Found: No taxis currently available on suitable routes with space." });
        }

        // 4. Filter candidate taxis based on direction and location
        const suitableTaxis = candidateTaxis.filter((taxi) => {
            console.log(`[DEBUG FILTER] Processing taxi ID: ${taxi._id}, currentStop: ${taxi.currentStop}, direction: ${taxi.direction}`);
            
            if (!taxi.route || !Array.isArray(taxi.route.stops)) {
                console.warn(`[DEBUG FILTER] Skipping taxi ${taxi._id} due to missing or invalid route/stops.`);
                return false;
            }
            
            const routeInfo = validRouteDetails.find(r => r.routeId.toString() === taxi.routeId.toString());
            if (!routeInfo) {
                console.warn(`[DEBUG FILTER] Skipping taxi ${taxi._id} as its route details were not found in validRouteDetails.`);
                return false;
            }

            const { passengerDirection, startIdx, stops } = routeInfo;
            const taxiDirection = taxi.direction || 'forward'; 
            
            const taxiCurrentStopIndex = stops.findIndex(stop => stop.name === taxi.currentStop);
            
            if (taxiCurrentStopIndex === -1) {
                console.warn(`[DEBUG FILTER] Skipping taxi ${taxi._id} because its current stop '${taxi.currentStop}' is not found in the sorted route stops.`);
                return false;
            }

            let isSuitable = false;
            if (passengerDirection === "forward") {
                isSuitable = taxiDirection === "forward" && taxiCurrentStopIndex <= startIdx;
            } else if (passengerDirection === "return") {
                isSuitable = taxiDirection === "return" && taxi.allowReturnPickups === true && taxiCurrentStopIndex >= startIdx;
            }

            return isSuitable;
        });

        console.log("[DEBUG] Suitable Taxis after JavaScript Filter:", suitableTaxis.length > 0 ? suitableTaxis.map(t => t._id) : "None");

        if (suitableTaxis.length === 0) {
            // This more specific message will now be hit if the JS filter is the reason for no results
            return res.status(404).json({ message: "Not Found: No taxis found heading in the right direction or allowing pickups for your trip." });
        }

        const responseTaxis = suitableTaxis.map(formatTaxiDataForEmit);
        res.status(200).json({ taxis: responseTaxis });

    } catch (error) {
        console.error("Error searching taxis:", error);
        res.status(500).json({ message: "Internal Server Error searching taxis", error: error.message });
    }
};



// --- Get Driver Taxis ---
// Fetches all taxis associated with the currently logged-in driver.
// (No socket emissions needed here)
exports.getDriverTaxis = async (req, res, next) => {
    try {
        const driverId = req.user.id; // Assumes user ID is available from auth middleware

        const taxis = await Taxi.find({ driverId })
            .populate("routeId", "routeName stops") // Populate route details
            .populate("driverId", "name username"); // Populate driver details (optional, could use req.user)

        if (!taxis || taxis.length === 0) {
            // It's not an error if a driver has no taxis yet, return empty list
            return res.status(200).json({ taxis: [] });
            // Or return 404 if you prefer:
            // return res.status(404).json({ message: "Not Found: No taxis found for this driver." });
        }

        // Format the taxis using the consistent helper function
        const responseTaxis = taxis.map(formatTaxiDataForEmit);
        res.status(200).json({ taxis: responseTaxis });

    } catch (error) {
        console.error("Error fetching driver taxis:", error);
        res.status(500).json({ message: "Internal Server Error fetching driver taxis", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};

// --- Update Taxi Status ---
// Allows a driver to update the status of their own taxi.
// (Handles DB update and broadcasts change via Socket.IO)
exports.updateStatus = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { status } = req.body;
        const driverId = req.user.id; // From auth middleware

        // Validate the provided status
        const validStatuses = ["waiting", "available", "roaming", "almost full", "full", "on trip", "not available"];
        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({ message: `Bad Request: Invalid status provided. Must be one of: ${validStatuses.join(', ')}.` });
        }

        // Find the taxi, ensuring it belongs to the logged-in driver
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId });

        // Handle cases where the taxi is not found or doesn't belong to the driver
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId); // Check if it exists at all
            return taxiExists
                ? res.status(403).json({ message: "Forbidden: You are not authorized to update this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Update the status and save
        taxi.status = status;
        await taxi.save();

        // Re-populate necessary fields for the response and socket emission
        await taxi.populate('routeId', 'routeName stops');
        await taxi.populate('driverId', 'name username');

        // Format the updated taxi data
        const updatedTaxiData = formatTaxiDataForEmit(taxi);

        // Send success response
        res.status(200).json({ message: "Taxi status updated successfully.", taxi: updatedTaxiData });

        // Broadcast the update to subscribed clients via Socket.IO
        try {
            const io = getIo(); // Get the shared Socket.IO instance
            if (io) {
                const roomName = `taxi_${taxi._id}`; // Room specific to this taxi
                io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (status change: ${status})`);
            } else {
                 console.warn("[SocketIO] Socket.IO instance not available for emission.");
            }
        } catch (socketError) {
            console.error("[SocketIO] Error emitting 'taxiUpdate':", socketError);
            // Decide if this should affect the HTTP response (usually not)
        }

    } catch (error) {
        console.error("Error updating taxi status:", error);
        res.status(500).json({ message: "Internal Server Error updating taxi status", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};


// --- Update Taxi Current Stop (Move to Next Stop Automatically) ---
// Advances the taxi to the next stop based on its current direction.
// Does NOT allow wrapping around the route automatically.
// (Handles DB update and broadcasts change)
exports.updateCurrentStop = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const driverId = req.user.id; // From auth middleware

        // Find the taxi, ensuring it belongs to the driver, and populate its route
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
            .populate('routeId', 'routeName stops'); // Need stops to calculate next

        // Handle not found / unauthorized
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId);
            return taxiExists
                ? res.status(403).json({ message: "Forbidden: You are not authorized to update this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Validate route data
        if (!taxi.routeId || !Array.isArray(taxi.routeId.stops) || taxi.routeId.stops.length === 0) {
            console.warn(`[updateCurrentStop] Taxi ${taxiId} has invalid route data.`);
            return res.status(400).json({ message: "Bad Request: Taxi has invalid or missing route data." });
        }

        // Sort stops by order to ensure correct indexing
        const stops = [...taxi.routeId.stops].sort((a, b) => a.order - b.order);
        const currentStopIndex = stops.findIndex(stop => stop.name === taxi.currentStop);
        const taxiDirection = taxi.direction || 'forward'; // Default to forward

        if (currentStopIndex === -1) {
            console.error(`[updateCurrentStop] Taxi ${taxiId}'s current stop '${taxi.currentStop}' not found in its route stops.`);
            // Option 1: Return error
             return res.status(400).json({ message: "Bad Request: Taxi's current stop is inconsistent with its route." });
            // Option 2: Try to reset? (More complex)
            // taxi.currentStop = stops[0].name; // Reset to first stop? Risky.
        }

        let nextStopName = null;

        // Determine the next stop based on direction
        if (taxiDirection === 'forward') {
            if (currentStopIndex < stops.length - 1) {
                nextStopName = stops[currentStopIndex + 1].name;
            } else {
                // Already at the last stop going forward
                return res.status(400).json({ message: "Bad Request: Already at the last stop of the route (forward)." });
            }
        } else if (taxiDirection === 'return') {
            if (currentStopIndex > 0) {
                nextStopName = stops[currentStopIndex - 1].name;
            } else {
                // Already at the first stop going backward (end of return trip)
                return res.status(400).json({ message: "Bad Request: Already at the start of the route (return)." });
            }
        } else {
             console.error(`[updateCurrentStop] Taxi ${taxiId} has an invalid direction: '${taxiDirection}'.`);
             return res.status(400).json({ message: "Bad Request: Taxi has an invalid direction state." });
        }

        // Update the current stop
        taxi.currentStop = nextStopName;

        // Optional: Update status automatically when moving?
        // Example: If status was 'waiting', change to 'roaming'
        // if (taxi.status === 'waiting') {
        //     taxi.status = 'roaming';
        // }

        await taxi.save();

        // Re-populate driver info for the response/emit
        await taxi.populate('driverId', 'name username');

        // Format and respond
        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: `Location updated to '${nextStopName}'.`, taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
             if (io) {
                const roomName = `taxi_${taxi._id}`;
                io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (stop change: ${nextStopName})`);
            } else {
                 console.warn("[SocketIO] Socket.IO instance not available for emission.");
            }
        } catch (socketError) {
            console.error("[SocketIO] Error emitting 'taxiUpdate':", socketError);
        }

    } catch (error) {
        console.error("Error updating taxi to next stop:", error);
         res.status(500).json({ message: "Internal Server Error updating taxi location", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};

// --- Update Taxi Load ---
// Allows a driver to update the current passenger count in their taxi.
// Automatically adjusts status based on load vs. capacity.
// (Handles DB update and broadcasts change)
exports.updateLoad = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { currentLoad } = req.body;
        const driverId = req.user.id; // From auth middleware

        // Validate input load value
        if (currentLoad === undefined || currentLoad === null || isNaN(currentLoad) || Number(currentLoad) < 0) {
            return res.status(400).json({ message: "Bad Request: Invalid or missing 'currentLoad' value. Must be a non-negative number." });
        }
        const parsedLoad = parseInt(currentLoad, 10); // Ensure integer

        // Find the taxi, ensuring ownership
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId });
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId);
            return taxiExists
                ? res.status(403).json({ message: "Forbidden: You are not authorized to update this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Validate load against capacity
        if (parsedLoad > taxi.capacity) {
            return res.status(400).json({ message: `Bad Request: Load (${parsedLoad}) cannot exceed capacity (${taxi.capacity}).` });
        }

        // Update the load
        taxi.currentLoad = parsedLoad;

        // --- Auto-update status based on load ---
        const oldStatus = taxi.status;
        let statusChanged = false;

        // Don't override 'not available' or 'on trip' based purely on load
        const canAutoUpdateStatus = !['not available', 'on trip'].includes(oldStatus);

        if (canAutoUpdateStatus) {
            if (taxi.currentLoad >= taxi.capacity) {
                taxi.status = 'full';
            } else if (taxi.currentLoad >= taxi.capacity * 0.8) { // e.g., 80% full
                 // Only change to 'almost full' if not already 'full'
                 if (taxi.status !== 'full') taxi.status = 'almost full';
            } else if (taxi.currentLoad > 0) {
                // If load > 0 and status was 'available' or 'waiting', change to 'roaming'
                 if (['waiting'].includes(taxi.status)) taxi.status = 'available'; // Or 'roaming' if preferred;
                 // If status was 'full' or 'almost full' but load dropped, maybe change back?
                 else if (['full', 'almost full'].includes(taxi.status)) taxi.status = 'available'; // Or 'available' if preferred
            } else { // currentLoad is 0
                // If load is 0, change back to 'available' (unless it was explicitly set to 'waiting')
                 if (taxi.status !== 'waiting') taxi.status = 'available';
            }
            statusChanged = oldStatus !== taxi.status;
        }

        await taxi.save();

        // Populate for response/emit
        await taxi.populate('routeId', 'routeName stops');
        await taxi.populate('driverId', 'name username');

        // Format and respond
        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        const statusMsg = statusChanged ? ` (status automatically updated to '${taxi.status}')` : '';
        res.status(200).json({ message: `Load updated to ${parsedLoad}${statusMsg}.`, taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
             if (io) {
                const roomName = `taxi_${taxi._id}`;
                io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (load change: ${parsedLoad}, status: ${taxi.status})`);
            } else {
                 console.warn("[SocketIO] Socket.IO instance not available for emission.");
            }
        } catch (socketError) {
            console.error("[SocketIO] Error emitting 'taxiUpdate':", socketError);
        }

    } catch (error) {
        console.error("Error updating taxi load:", error);
        res.status(500).json({ message: "Internal Server Error updating taxi load", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};

// --- Update Taxi Current Stop (Manual Selection) ---
// Allows a driver to manually set the current stop of their taxi from the list of valid stops on its route.
// (Handles DB update and broadcasts change)
exports.updateCurrentStopManual = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { currentStop } = req.body; // Expecting the name of the stop
        const driverId = req.user.id; // From auth middleware

        // Validate input
        if (!currentStop || typeof currentStop !== 'string' || currentStop.trim() === '') {
            return res.status(400).json({ message: "Bad Request: 'currentStop' name is required in the request body." });
        }
        const targetStopName = currentStop.trim();

        // Find the taxi, ensure ownership, and populate route stops
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
            .populate('routeId', 'routeName stops'); // Need stops for validation

        // Handle not found / unauthorized
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId);
            return taxiExists
                ? res.status(403).json({ message: "Forbidden: You are not authorized to update this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Validate route data
        if (!taxi.routeId || !Array.isArray(taxi.routeId.stops) || taxi.routeId.stops.length === 0) {
             console.warn(`[updateCurrentStopManual] Taxi ${taxiId} has invalid route data.`);
            return res.status(400).json({ message: "Bad Request: Taxi has invalid or missing route data." });
        }

        // Check if the provided stop name exists on the taxi's route
        const validStop = taxi.routeId.stops.find(stop => stop.name === targetStopName);
        if (!validStop) {
            return res.status(400).json({ message: `Bad Request: Stop '${targetStopName}' is not a valid stop on this taxi's route ('${taxi.routeId.routeName}').` });
        }

        // Update the current stop if it's different
        if (taxi.currentStop !== targetStopName) {
            taxi.currentStop = targetStopName;
            await taxi.save();
        } else {
            // If the stop is the same, no need to save or emit, just inform the user.
            // Populate driver anyway for consistent response format.
            await taxi.populate('driverId', 'name username');
            const currentTaxiData = formatTaxiDataForEmit(taxi);
            return res.status(200).json({ message: `Taxi is already at stop '${targetStopName}'. No update needed.`, taxi: currentTaxiData });
        }


        // Re-populate driver info for the response/emit
        await taxi.populate('driverId', 'name username');

        // Format and respond
        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: `Location manually updated to '${targetStopName}'.`, taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
             if (io) {
                const roomName = `taxi_${taxi._id}`;
                io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (manual stop change: ${targetStopName})`);
            } else {
                 console.warn("[SocketIO] Socket.IO instance not available for emission.");
            }
        } catch (socketError) {
            console.error("[SocketIO] Error emitting 'taxiUpdate':", socketError);
        }

    } catch (error) {
        console.error("Error updating taxi stop manually:", error);
        res.status(500).json({ message: "Internal Server Error updating taxi stop manually", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};


// --- Update Taxi Direction (Manual Selection) ---
// Allows a driver to manually set the direction ('forward' or 'return') of their taxi.
// (Handles DB update and broadcasts change)
exports.updateDirectionManual = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { direction } = req.body;
        const driverId = req.user.id; // From auth middleware

        // Validate input direction
        if (!direction || !["forward", "return"].includes(direction)) {
            return res.status(400).json({ message: "Bad Request: 'direction' is required and must be either 'forward' or 'return'." });
        }

        // Find the taxi, ensuring ownership
        // Populate route minimally, driver info needed for response
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
                               .populate('routeId', 'routeName stops'); // Populate route for formatTaxiDataForEmit

        // Handle not found / unauthorized
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId);
            return taxiExists
                ? res.status(403).json({ message: "Forbidden: You are not authorized to update this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Update the direction if it's different
        if (taxi.direction !== direction) {
            taxi.direction = direction;
            // Optional: Reset currentStop when direction changes?
            // E.g., if changing to 'return', maybe set currentStop to the last stop?
            // Or if changing to 'forward', set to the first stop? Requires careful thought.
            // For now, just update direction.
            await taxi.save();
        } else {
             // If the direction is the same, no need to save or emit.
             await taxi.populate('driverId', 'name username'); // Populate for consistent response
             const currentTaxiData = formatTaxiDataForEmit(taxi);
            return res.status(200).json({ message: `Taxi direction is already '${direction}'. No update needed.`, taxi: currentTaxiData });
        }


        // Populate driver info for the response/emit
        await taxi.populate('driverId', 'name username');

        // Format and respond
        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: `Direction updated successfully to '${direction}'.`, taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
             if (io) {
                const roomName = `taxi_${taxi._id}`;
                io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (manual direction change: ${direction})`);
            } else {
                 console.warn("[SocketIO] Socket.IO instance not available for emission.");
            }
        } catch (socketError) {
            console.error("[SocketIO] Error emitting 'taxiUpdate':", socketError);
        }

    } catch (error) {
        console.error("Error updating taxi direction manually:", error);
        res.status(500).json({ message: "Internal Server Error updating taxi direction", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};


// --- Get Stops For Taxi ---
// Fetches the list of stops for a given taxi's route, ordered according to the taxi's current direction.
// (No socket emissions needed)
exports.getStopsForTaxi = async (req, res, next) => {
    try {
        const { taxiId } = req.params;

        // Fetch the taxi, populating only the necessary route stops
        // No need for driver auth here usually, anyone can see stops for a taxi ID
        const taxi = await Taxi.findById(taxiId)
            .select('direction routeId') // Select only needed fields + routeId for populate
            .populate({
                path: 'routeId',
                select: 'stops' // Select only the stops array from the route
            });

        // Handle taxi not found
        if (!taxi) {
            return res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Handle missing/invalid route or stops data
        if (!taxi.routeId || !Array.isArray(taxi.routeId.stops) || taxi.routeId.stops.length === 0) {
            return res.status(404).json({ message: "Not Found: Route or stops data not found for this taxi." });
        }

        // Get the taxi's current direction, default to 'forward'
        const direction = taxi.direction || 'forward';

        // Clone and sort stops ascending by order (original route order)
        const sortedStops = [...taxi.routeId.stops].sort((a, b) => a.order - b.order);

        // If taxi is on return leg, reverse the sorted stops array for the response
        const orderedStopsForResponse = direction === "return" ? sortedStops.reverse() : sortedStops;

        // Respond with the direction and the appropriately ordered stops
        res.status(200).json({
            direction: direction,
            stops: orderedStopsForResponse // Contains { name, order, lat, lon, etc. }
        });

    } catch (error) {
        console.error("Error fetching stops for taxi:", error);
        res.status(500).json({ message: "Internal Server Error fetching stops", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};


// --- Monitor Taxi Endpoint (Get initial state) ---
// Fetches the current detailed state of a specific taxi. Used for initializing a monitoring view.
// (No socket emissions needed, this is just the initial fetch)
exports.monitorTaxi = async (req, res, next) => {
    try {
        const { taxiId } = req.params;

        // Fetch full details for initial display
        // No driver auth check here typically, monitoring might be public or based on different permissions
        const taxi = await Taxi.findById(taxiId)
            .populate('routeId', 'routeName stops') // Populate route details
            .populate('driverId', 'name username'); // Populate driver details

        // Handle taxi not found
        if (!taxi) {
            return res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Format the data using the consistent helper
        const taxiInfo = formatTaxiDataForEmit(taxi);

        // Respond with the formatted taxi information
        res.status(200).json({ message: "Taxi info fetched successfully.", taxiInfo: taxiInfo });

    } catch (error) {
        console.error("Error fetching taxi info for monitoring:", error);
        res.status(500).json({ message: "Internal Server Error fetching taxi info", error: error.message });
        // next(error); // Optional: pass to error middleware
    }
};

// --- Delete Taxi ---
// Deletes a taxi. Should typically require admin or driver ownership verification.
// Also handles unlinking or cancelling related ride requests.
// (Consider adding role-based authorization middleware before this)
exports.deleteTaxi = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const userId = req.user.id; // Assuming auth middleware provides user ID
        const userRoles = req.user.role; // Assuming auth middleware provides user roles array

        // Find the taxi to check ownership or admin role
        const taxiToDelete = await Taxi.findById(taxiId);

        if (!taxiToDelete) {
            return res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // Authorization Check: Allow if user is an admin OR if the user is the driver who owns the taxi
        const isAdmin = userRoles.includes('admin'); // Check if user has 'admin' role
        const isOwner = taxiToDelete.driverId.equals(userId); // Check if driver ID matches

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: "Forbidden: You are not authorized to delete this taxi." });
        }

        // Proceed with deletion
        const deletedTaxi = await Taxi.findByIdAndDelete(taxiId);

        // Note: findByIdAndDelete returns the deleted document or null if not found
        // We already checked existence, so it should return the document here.
        if (!deletedTaxi) {
             // This case should be rare given the checks above, but handle defensively
             console.error(`[deleteTaxi] Failed to delete taxi ${taxiId} even after finding it.`);
             return res.status(500).json({ message: "Error deleting taxi after verification." });
        }


        // --- Handle Related Ride Requests ---
        // Find ride requests linked to this taxi that might need updating
        // (e.g., unassign taxi, set status back to 'pending' or 'cancelled')
        try {
            // Example: Find active requests assigned to this taxi
            const relatedRequests = await RideRequest.find({
                taxi: taxiId,
                // status: { $in: ['accepted', 'driver-assigned', 'en-route'] } // Example statuses
            });

            console.log(`[deleteTaxi] Found ${relatedRequests.length} ride request(s) linked to deleted taxi ${taxiId}.`);

            if (relatedRequests.length > 0) {
                // Option 1: Unassign taxi and revert status to 'pending'
                 const updateResult = await RideRequest.updateMany(
                     { _id: { $in: relatedRequests.map(r => r._id) } }, // Target the specific requests found
                     { $unset: { taxi: "" }, $set: { status: "pending" } } // Remove taxi field, set status
                 );
                 console.log(`[deleteTaxi] Unassigned taxi and reset status for ${updateResult.modifiedCount} ride request(s).`);

                 // Option 2: Cancel the requests (alternative)
                 // await RideRequest.updateMany(
                 //     { _id: { $in: relatedRequests.map(r => r._id) } },
                 //     { $set: { status: "cancelled", cancellationReason: "Taxi deleted" } }
                 // );
                 // console.log(`[deleteTaxi] Cancelled ${relatedRequests.length} ride request(s).`);

                // Optionally: Notify affected passengers via Socket.IO or other means
                // ... notification logic ...
            }
        } catch (rideErr) {
            console.error(`[deleteTaxi] Error updating related ride requests for deleted taxi ${taxiId}:`, rideErr);
            // Log the error but don't fail the taxi deletion response because of this
            // Maybe add admin notification here
        }
        // --- End Handle Related Ride Requests ---


        // --- Emit Socket Event for Deletion ---
        // Notify relevant clients (e.g., admins, maybe drivers on the same route?) that the taxi was deleted.
        // This is different from 'taxiUpdate' as the taxi no longer exists.
         try {
             const io = getIo();
             if (io) {
                 // Emit to a general room (e.g., 'taxi-list-updates') or specific admin rooms
                 io.emit("taxiDeleted", { taxiId: taxiId }); // Send the ID of the deleted taxi
                 console.log(`[SocketIO] Emitted 'taxiDeleted' for taxi ID ${taxiId}`);

                 // Also leave the specific taxi room if it exists (though clients should handle this on disconnect)
                 // io.socketsLeave(`taxi_${taxiId}`); // Less common to do this server-side on delete
             }
         } catch (socketError) {
             console.error("[SocketIO] Error emitting 'taxiDeleted':", socketError);
         }
         // --- End Emit Socket Event ---


        return res.status(200).json({ message: `Taxi '${deletedTaxi.numberPlate}' deleted successfully.` });

    } catch (err) {
        console.error("Error in deleteTaxi controller:", err);
         res.status(500).json({ message: "Internal Server Error deleting taxi", error: err.message });
        // next(err); // Optional: pass to error middleware
    }
};


// --- Update Taxi Details ---
// Allows a driver to update editable details of their own taxi, like route, capacity, or allowReturnPickups.
// Does NOT update status, load, currentStop, or direction (use dedicated functions for those).
// (Handles DB update and potentially broadcasts change if needed - TBD if necessary)
exports.updateTaxiDetails = async (req, res, next) => {
    try {
        const driverId = req.user.id; // From auth middleware
        const { taxiId } = req.params;
        const { routeName, capacity, allowReturnPickups } = req.body; // Only accept these fields

        let updatePerformed = false; // Flag to track if any changes were made

        // Find the taxi and ensure the authenticated driver owns it
        const taxi = await Taxi.findOne({ _id: taxiId, driverId });
        if (!taxi) {
            const exists = await Taxi.findById(taxiId);
            return exists
                ? res.status(403).json({ message: "Forbidden: You do not own this taxi." })
                : res.status(404).json({ message: `Not Found: Taxi with ID '${taxiId}' not found.` });
        }

        // --- Update Route ---
        if (routeName !== undefined && routeName !== null) {
            // Find the new route by name
            const route = await Route.findOne({ routeName });
            if (!route) {
                return res.status(404).json({ message: `Not Found: Route '${routeName}' not found.` });
            }
            // Check if the route is actually different before updating
            if (!taxi.routeId || !taxi.routeId.equals(route._id)) {
                 // Check if the current stop is valid on the NEW route
                 const stopExistsOnNewRoute = route.stops.some(stop => stop.name === taxi.currentStop);
                 if (!stopExistsOnNewRoute) {
                     // If the current stop isn't on the new route, maybe reset it?
                     // Option A: Error out
                      return res.status(400).json({ message: `Bad Request: Current stop '${taxi.currentStop}' is not valid on the new route '${routeName}'. Please update the stop first or choose a different route.` });
                     // Option B: Reset to first stop of new route (use with caution)
                     // const firstStop = route.stops.sort((a, b) => a.order - b.order)[0];
                     // if (firstStop) {
                     //     taxi.currentStop = firstStop.name;
                     //     console.log(`[updateTaxiDetails] Resetting currentStop to '${firstStop.name}' due to route change.`);
                     // } else {
                     //     return res.status(400).json({ message: `Bad Request: New route '${routeName}' has no stops defined.` });
                     // }
                 }
                taxi.routeId = route._id;
                updatePerformed = true;
                console.log(`[updateTaxiDetails] Taxi ${taxiId} route updated to ${routeName} (${route._id})`);
            }
        }

        // --- Update Capacity ---
        if (capacity !== undefined && capacity !== null) {
            const parsedCapacity = parseInt(capacity, 10);
            if (isNaN(parsedCapacity) || parsedCapacity < 1) {
                return res.status(400).json({ message: "Bad Request: Capacity must be a positive number." });
            }
            if (taxi.capacity !== parsedCapacity) {
                taxi.capacity = parsedCapacity;
                updatePerformed = true;
                console.log(`[updateTaxiDetails] Taxi ${taxiId} capacity updated to ${parsedCapacity}`);
                // Adjust currentLoad if it now exceeds the new capacity
                if (taxi.currentLoad > parsedCapacity) {
                    console.warn(`[updateTaxiDetails] Taxi ${taxiId} current load (${taxi.currentLoad}) exceeds new capacity (${parsedCapacity}). Adjusting load.`);
                    taxi.currentLoad = parsedCapacity;
                    // Consider auto-updating status here as well if load changed
                    // (e.g., call the status update logic from updateLoad)
                }
            }
        }

        // --- Update allowReturnPickups ---
        if (allowReturnPickups !== undefined && allowReturnPickups !== null) {
            const boolAllow = Boolean(allowReturnPickups); // Coerce to boolean
            if (taxi.allowReturnPickups !== boolAllow) {
                taxi.allowReturnPickups = boolAllow;
                updatePerformed = true;
                console.log(`[updateTaxiDetails] Taxi ${taxiId} allowReturnPickups updated to ${boolAllow}`);
            }
        }

        // --- Save and Respond ---
        if (updatePerformed) {
            await taxi.save();
            // Populate for consistent response shape
            await taxi.populate("routeId", "routeName stops");
            await taxi.populate("driverId", "name username");

             // --- Optional: Broadcast Update ---
             // Decide if these detail changes warrant a socket emission.
             // Usually status/location/load changes are more critical for real-time updates.
             // If you DO want to emit, use the same pattern as other update functions:
             try {
                 const io = getIo();
                 if (io) {
                     const roomName = `taxi_${taxi._id}`;
                     const updatedTaxiData = formatTaxiDataForEmit(taxi); // Format the final state
                     io.to(roomName).emit("taxiUpdate", updatedTaxiData);
                     console.log(`[SocketIO] Emitted 'taxiUpdate' to room ${roomName} (details change)`);
                 }
             } catch (socketError) {
                 console.error("[SocketIO] Error emitting 'taxiUpdate' after details change:", socketError);
             }
             // --- End Optional Broadcast ---


            res.status(200).json({
                message: "Taxi details updated successfully.",
                taxi: formatTaxiDataForEmit(taxi), // Use formatter for consistency
            });
        } else {
            // No changes were actually made
             await taxi.populate("routeId", "routeName stops"); // Populate anyway for consistent response
             await taxi.populate("driverId", "name username");
            res.status(200).json({
                message: "No changes detected in provided taxi details.",
                taxi: formatTaxiDataForEmit(taxi),
            });
        }

    } catch (err) {
        console.error("Error updating taxi details:", err);
        res.status(500).json({ message: "Internal Server Error updating taxi details", error: err.message });
        // next(err); // Optional: pass to error middleware
    }
};
