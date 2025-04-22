// src/controllers/taxiController.js (or your path)

const Taxi = require("../models/Taxi");
const Route = require("../models/Route");
const User = require("../models/User");
const { getIo } = require("../config/socket"); // Import shared Socket.IO instance

// --- Helper function to format Taxi Data for Emission ---
// (Consistent formatting for API responses and socket events)
const formatTaxiDataForEmit = (taxi) => {
    if (!taxi) return null;

    // Determine next stop safely
    let nextStopName = "End of the route";
    // Ensure routeId and stops are populated or handled gracefully
    if (taxi.routeId && typeof taxi.routeId === 'object' && Array.isArray(taxi.routeId.stops)) {
        const currentStopIndex = taxi.routeId.stops.findIndex(stop => stop.name === taxi.currentStop);
        if (currentStopIndex !== -1 && currentStopIndex < taxi.routeId.stops.length - 1) {
            nextStopName = taxi.routeId.stops[currentStopIndex + 1].name;
        }
    } else {
         // Handle cases where routeId might not be fully populated in some contexts
         // console.warn(`Route details missing/not populated for taxi ${taxi._id} in formatTaxiDataForEmit`);
    }

    // Ensure driverId is populated or handle gracefully
    const driverName = (taxi.driverId && typeof taxi.driverId === 'object')
        ? (taxi.driverId.name || taxi.driverId.username)
        : 'N/A';
    const driverId = (taxi.driverId && typeof taxi.driverId === 'object')
        ? taxi.driverId._id
        : (taxi.driverId || null); // Use driverId directly if not populated

     // Ensure routeId is populated or handle gracefully
     const routeName = (taxi.routeId && typeof taxi.routeId === 'object')
        ? taxi.routeId.routeName
        : 'N/A';
     const routeId = (taxi.routeId && typeof taxi.routeId === 'object')
        ? taxi.routeId._id
        : (taxi.routeId || null); // Use routeId directly if not populated
     const stops = (taxi.routeId && typeof taxi.routeId === 'object' && Array.isArray(taxi.routeId.stops))
        ? taxi.routeId.stops
        : []; // Default to empty array if not populated


    return {
        _id: taxi._id,
        numberPlate: taxi.numberPlate,
        status: taxi.status,
        currentStop: taxi.currentStop,
        currentLoad: taxi.currentLoad,
        capacity: taxi.capacity, // Use capacity from schema
        routeName: routeName,
        driverName: driverName,
        driverId: driverId,
        routeId: routeId,
        stops: stops, // Include stops if populated, empty array otherwise
        nextStop: nextStopName,
        updatedAt: taxi.updatedAt
    };
};


// --- Add Taxi ---
// (No socket emission needed here usually)
exports.addTaxi = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user || !user.role.includes("driver")) {
            return res.status(403).json({ message: "Only drivers can add a taxi." });
        }

        const { numberPlate, routeName, capacity, currentStop, allowReturnPickups } = req.body;

        if (!numberPlate || !routeName || !capacity || !currentStop) {
            return res.status(400).json({ message: "All fields are required." });
        }

        if (isNaN(capacity) || capacity <= 0) {
            return res.status(400).json({ message: "Capacity must be a positive number." });
        }

        const existingTaxi = await Taxi.findOne({ numberPlate });
        if (existingTaxi) {
            return res.status(400).json({ message: "Taxi with this number plate already exists." });
        }

        const route = await Route.findOne({ routeName });
        if (!route) {
            return res.status(404).json({ message: "Route not found." });
        }

        const stopExists = route.stops.some(stop => stop.name === currentStop);
        if (!stopExists) {
            return res.status(400).json({ message: `Stop '${currentStop}' not found on route '${routeName}'.` });
        }

        const newTaxi = new Taxi({
            numberPlate,
            routeId: route._id,
            driverId: userId,
            capacity,
            currentStop,
            status: "available",
            currentLoad: 0,
            allowReturnPickups: allowReturnPickups === true // Ensures it's saved as a boolean
        });

        await newTaxi.save();
        await newTaxi.populate('routeId', 'routeName stops');
        await newTaxi.populate('driverId', 'name username');

        res.status(201).json({
            message: "Taxi added successfully.",
            taxi: formatTaxiDataForEmit(newTaxi)
        });
    } catch (error) {
        console.error("Error adding taxi:", error);
        res.status(500).json({ message: "Error adding taxi", error: error.message });
    }
};


// --- Search Taxis ---
// (No socket emissions needed here)
exports.searchTaxis = async (req, res, next) => {
    try {
        const { startLocation, endLocation } = req.query;
        if (!startLocation || !endLocation) {
            return res.status(400).json({ message: "Start/end locations required." });
        }

        const routes = await Route.find({
            stops: {
                $all: [
                    { $elemMatch: { name: startLocation } },
                    { $elemMatch: { name: endLocation } }
                ]
            }
        });

        if (!routes || routes.length === 0) {
            return res.status(404).json({ message: "No routes found." });
        }

        const validRouteIds = [];
        const routeStopOrder = {};
        for (const route of routes) {
            const startIdx = route.stops.findIndex(s => s.name === startLocation);
            const endIdx = route.stops.findIndex(s => s.name === endLocation);
            if (startIdx !== -1 && endIdx !== -1) {
                validRouteIds.push(route._id);
                routeStopOrder[route._id.toString()] = { startIdx, endIdx, stops: route.stops };
            }
        }

        if (validRouteIds.length === 0) {
            return res.status(404).json({ message: "No valid routes with start and end." });
        }

        const availableStatuses = ["waiting", "available", "almost full", "roaming"];
        const taxis = await Taxi.find({
            routeId: { $in: validRouteIds },
            status: { $in: availableStatuses }
        }).populate("routeId", "routeName stops").populate("driverId", "name username");

        if (!taxis || taxis.length === 0) {
            return res.status(404).json({ message: "No available taxis found." });
        }

        const filteredTaxis = taxis.filter((taxi) => {
            if (!taxi.routeId || typeof taxi.routeId !== 'object') {
                console.warn(`Taxi ${taxi._id} missing populated routeId.`);
                return false;
            }

            const routeInfo = routeStopOrder[taxi.routeId._id.toString()];
            if (!routeInfo) return false;

            const stops = routeInfo.stops;
            const taxiCurrentStopIndex = stops.findIndex(stop => stop.name === taxi.currentStop);
            if (taxiCurrentStopIndex === -1) {
                console.warn(`Taxi ${taxi._id} stop '${taxi.currentStop}' invalid.`);
                return false;
            }

            const { startIdx, endIdx } = routeInfo;

            // FORWARD: passenger is going forward and taxi is going forward
            if (startIdx < endIdx && taxi.direction === "forward") {
                return taxiCurrentStopIndex <= startIdx;
            }

            // RETURN: passenger is going backward, taxi is in return mode, and allows return pickups
            if (startIdx > endIdx && taxi.direction === "return" && taxi.allowReturnPickups === true) {
                return taxiCurrentStopIndex >= startIdx;
            }

            return false; // Not valid for this direction
        });

        if (filteredTaxis.length === 0) {
            return res.status(404).json({ message: "No suitable taxis found (already passed?)." });
        }

        const responseTaxis = filteredTaxis.map(formatTaxiDataForEmit);
        res.status(200).json({ taxis: responseTaxis });

    } catch (error) {
        console.error("Error searching taxis:", error);
        next(error);
    }
};

// --- Get Driver Taxis ---
// (No socket emissions needed here)
exports.getDriverTaxis = async (req, res, next) => {
    try {
        const driverId = req.user.id;
        const taxis = await Taxi.find({ driverId })
                                .populate("routeId", "routeName stops")
                                .populate("driverId", "name username");
        if (!taxis || taxis.length === 0) { return res.status(404).json({ message: "No taxis found." }); }
        const responseTaxis = taxis.map(formatTaxiDataForEmit);
        res.status(200).json({ taxis: responseTaxis });
    } catch (error) {
        console.error("Error fetching driver taxis:", error);
        next(error);
    }
};

// --- Update Taxi Status ---
// (Handles DB update and broadcasts change)
exports.updateStatus = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { status } = req.body;
        const driverId = req.user.id;
        const validStatuses = ["waiting", "available", "roaming", "almost full", "full", "on trip", "not available"];
        if (!validStatuses.includes(status)) { return res.status(400).json({ message: "Invalid status." }); }

        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId });
        if (!taxi) {
             const taxiExists = await Taxi.findById(taxiId);
             return taxiExists ? res.status(403).json({ message: "Unauthorized." }) : res.status(404).json({ message: "Taxi not found." });
        }

        taxi.status = status;
        await taxi.save();
        await taxi.populate('routeId', 'routeName stops'); // Re-populate after save
        await taxi.populate('driverId', 'name username');

        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: "Status updated.", taxi: updatedTaxiData });

        // Broadcast update to subscribed clients
        try {
            const io = getIo();
            const roomName = `taxi_${taxi._id}`;
            io.to(roomName).emit("taxiUpdate", updatedTaxiData);
            console.log(`[API] Emitted taxiUpdate to room ${roomName} (status change)`);
        } catch (socketError) { console.error("Socket emission error:", socketError); }

    } catch (error) {
        console.error("Error updating taxi status:", error);
        next(error);
    }
};

// --- Update Taxi Current Stop (Automatic next stop) ---
// (Handles DB update and broadcasts change)
exports.updateCurrentStop = async (req, res, next) => {
     try {
        const { taxiId } = req.params;
        const driverId = req.user.id;

        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
                               .populate('routeId', 'routeName stops'); // Populate route needed
                               // Driver info less critical here, can skip populate('driverId') if not needed immediately

        if (!taxi) {
             const taxiExists = await Taxi.findById(taxiId);
             return taxiExists ? res.status(403).json({ message: "Unauthorized." }) : res.status(404).json({ message: "Taxi not found." });
        }
        if (!taxi.routeId || !taxi.routeId.stops || taxi.routeId.stops.length === 0) {
            return res.status(400).json({ message: "Invalid route data." });
        }

        const stops = taxi.routeId.stops;
        const currentStopIndex = stops.findIndex(stop => stop.name === taxi.currentStop);
        if (currentStopIndex === -1) {
            console.error(`Taxi ${taxiId} stop '${taxi.currentStop}' mismatch.`);
            return res.status(400).json({ message: "Current stop mismatch." });
        }
        if (currentStopIndex >= stops.length - 1) {
            return res.status(400).json({ message: "Already at last stop." });
        }

        const nextStop = stops[currentStopIndex + 1];
        taxi.currentStop = nextStop.name;
        // Maybe auto-update status? e.g., taxi.status = 'roaming';
        await taxi.save();
        await taxi.populate('driverId', 'name username'); // Populate driver for response/emit

        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: "Location updated.", taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
            const roomName = `taxi_${taxi._id}`;
            io.to(roomName).emit("taxiUpdate", updatedTaxiData);
            console.log(`[API] Emitted taxiUpdate to room ${roomName} (stop change)`);
        } catch (socketError) { console.error("Socket emission error:", socketError); }

    } catch (error) {
        console.error("Error updating next stop:", error);
        next(error);
    }
};

// --- Update Taxi Load ---
// (Handles DB update and broadcasts change)
exports.updateLoad = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { currentLoad } = req.body;
        const driverId = req.user.id;

        if (currentLoad === undefined || isNaN(currentLoad) || currentLoad < 0) {
            return res.status(400).json({ message: "Invalid load value." });
        }
        const parsedLoad = parseInt(currentLoad, 10);

        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId });
        if (!taxi) {
             const taxiExists = await Taxi.findById(taxiId);
             return taxiExists ? res.status(403).json({ message: "Unauthorized." }) : res.status(404).json({ message: "Taxi not found." });
        }
        if (parsedLoad > taxi.capacity) {
            return res.status(400).json({ message: `Load (${parsedLoad}) exceeds capacity (${taxi.capacity}).` });
        }

        taxi.currentLoad = parsedLoad;

        // Auto-update status based on load
        const oldStatus = taxi.status;
        if (taxi.currentLoad >= taxi.capacity) taxi.status = 'full';
        else if (taxi.currentLoad >= taxi.capacity * 0.8) { if(taxi.status !== 'full') taxi.status = 'almost full'; }
        else if (taxi.currentLoad > 0) { if (taxi.status === 'available' || taxi.status === 'waiting') taxi.status = 'roaming'; }
        else { if (taxi.status !== 'not available') taxi.status = 'available'; }
        const statusChanged = oldStatus !== taxi.status;

        await taxi.save();
        await taxi.populate('routeId', 'routeName stops');
        await taxi.populate('driverId', 'name username');

        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: `Load updated${statusChanged ? ' (status also updated)' : ''}.`, taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
            const roomName = `taxi_${taxi._id}`;
            io.to(roomName).emit("taxiUpdate", updatedTaxiData);
            console.log(`[API] Emitted taxiUpdate to room ${roomName} (load/status change)`);
        } catch (socketError) { console.error("Socket emission error:", socketError); }

    } catch (error) {
        console.error("Error updating taxi load:", error);
        next(error);
    }
};

// --- Update Taxi Current Stop (Manual Selection) ---
// (Handles DB update and broadcasts change)
exports.updateCurrentStopManual = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { currentStop } = req.body;
        const driverId = req.user.id;

        if (!currentStop) { return res.status(400).json({ message: "Stop name required." }); }

        // Populate route here to validate the stop against it
        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
                               .populate('routeId', 'stops'); // Only need stops from route
        if (!taxi) {
             const taxiExists = await Taxi.findById(taxiId);
             return taxiExists ? res.status(403).json({ message: "Unauthorized." }) : res.status(404).json({ message: "Taxi not found." });
        }
        if (!taxi.routeId || !taxi.routeId.stops) { return res.status(400).json({ message: "Invalid route data." }); }

        const validStop = taxi.routeId.stops.find(stop => stop.name === currentStop);
        if (!validStop) { return res.status(400).json({ message: `Stop '${currentStop}' invalid for this route.` }); }

        taxi.currentStop = currentStop;
        await taxi.save();
        // Re-populate fully for emit/response
        await taxi.populate('routeId', 'routeName stops');
        await taxi.populate('driverId', 'name username');

        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: "Location updated manually.", taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
            const roomName = `taxi_${taxi._id}`;
            io.to(roomName).emit("taxiUpdate", updatedTaxiData);
            console.log(`[API] Emitted taxiUpdate to room ${roomName} (manual stop change)`);
        } catch (socketError) { console.error("Socket emission error:", socketError); }

    } catch (error) {
        console.error("Error updating stop manually:", error);
        next(error);
    }
};


exports.updateDirectionManual = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        const { direction } = req.body;
        const driverId = req.user.id;

        if (!direction || !["forward", "return"].includes(direction)) {
            return res.status(400).json({ message: "Direction must be either 'forward' or 'return'." });
        }

        const taxi = await Taxi.findOne({ _id: taxiId, driverId: driverId })
                               .populate('routeId', 'routeName stops');
        if (!taxi) {
            const taxiExists = await Taxi.findById(taxiId);
            return taxiExists
                ? res.status(403).json({ message: "Unauthorized." })
                : res.status(404).json({ message: "Taxi not found." });
        }

        taxi.direction = direction;
        await taxi.save();

        await taxi.populate('driverId', 'name username');

        const updatedTaxiData = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: "Direction updated successfully.", taxi: updatedTaxiData });

        // Broadcast update
        try {
            const io = getIo();
            const roomName = `taxi_${taxi._id}`;
            io.to(roomName).emit("taxiUpdate", updatedTaxiData);
            console.log(`[API] Emitted taxiUpdate to room ${roomName} (manual direction change)`);
        } catch (socketError) {
            console.error("Socket emission error:", socketError);
        }

    } catch (error) {
        console.error("Error updating taxi direction manually:", error);
        next(error);
    }
};


// --- Get Stops For Taxi ---
// (No socket emissions needed)
exports.getStopsForTaxi = async (req, res, next) => {
    try {
      const { taxiId } = req.params;
      // Fetch taxi with its route stops and direction
      const taxi = await Taxi.findById(taxiId)
        .populate("routeId", "stops direction"); // note: direction is on taxi, but we'll read it below
  
      if (!taxi) {
        return res.status(404).json({ message: "Taxi not found." });
      }
      if (!taxi.routeId || !taxi.routeId.stops) {
        return res.status(404).json({ message: "Route/stops not found." });
      }
  
      // Clone & sort stops ascending by order
      const stops = [...taxi.routeId.stops].sort((a, b) => a.order - b.order);
  
      // If taxi is on return leg, reverse the stops
      const orderedStops = taxi.direction === "return" ? stops.reverse() : stops;
  
      res.status(200).json({ 
        direction: taxi.direction,
        stops: orderedStops 
      });
    } catch (error) {
      console.error("Error fetching stops for taxi:", error);
      next(error);
    }
  };
  

// --- Monitor Taxi Endpoint (Get initial state) ---
// (No socket emissions needed)
exports.monitorTaxi = async (req, res, next) => {
    try {
        const { taxiId } = req.params;
        // Fetch full details for initial display
        const taxi = await Taxi.findById(taxiId)
                               .populate('routeId', 'routeName stops')
                               .populate('driverId', 'name username');
        if (!taxi) { return res.status(404).json({ message: "Taxi not found." }); }
        const taxiInfo = formatTaxiDataForEmit(taxi);
        res.status(200).json({ message: "Taxi info fetched.", taxiInfo: taxiInfo });
    } catch (error) {
        console.error("Error fetching taxi info:", error);
        next(error);
    }
};

exports.deleteTaxi = async (req, res) => {
    try {
      const { taxiId } = req.params;
  
      // Delete taxi
      const taxi = await Taxi.findByIdAndDelete(taxiId);
      if (!taxi) {
        return res.status(404).json({ error: "Taxi not found." });
      }
  
      // Log and update ride requests if they exist
      try {
        const relatedRequests = await RideRequest.find({ taxi: taxiId });
  
        console.log(`Found ${relatedRequests.length} ride request(s) linked to this taxi.`);
  
        if (relatedRequests.length > 0) {
          await RideRequest.updateMany(
            { taxi: taxiId },
            { $unset: { taxi: "" }, $set: { status: "pending" } }
          );
          console.log("Associated ride requests updated.");
        }
      } catch (rideErr) {
        console.error("Error updating related ride requests:", rideErr);
        // Do not fail the whole process because of this — optionally notify the admin here
      }
  
      return res.status(200).json({ message: "Taxi deleted successfully." });
  
    } catch (err) {
      console.error("Error in deleteTaxi:", err);
      return res.status(500).json({ error: "Server error." });
    }
 };

exports.updateTaxiDetails = async (req, res, next) => {
  try {
    const driverId = req.user.id;
    const { taxiId } = req.params;
    const { routeName, capacity, allowReturnPickups } = req.body;

    // Find the taxi and ensure the authenticated driver owns it
    const taxi = await Taxi.findOne({ _id: taxiId, driverId });
    if (!taxi) {
      const exists = await Taxi.findById(taxiId);
      return exists
        ? res.status(403).json({ error: "Unauthorized: You do not own this taxi." })
        : res.status(404).json({ error: "Taxi not found." });
    }

    // If updating routeName, look up the Route and assign its _id
    if (routeName) {
      const route = await Route.findOne({ routeName });
      if (!route) {
        return res.status(404).json({ error: `Route '${routeName}' not found.` });
      }
      taxi.routeId = route._id;
    }

    // If updating capacity, validate it’s a positive integer
    if (capacity !== undefined) {
      if (isNaN(capacity) || capacity < 1) {
        return res.status(400).json({ error: "Capacity must be a positive number." });
      }
      taxi.capacity = capacity;
      // Also ensure currentLoad does not exceed new capacity
      if (taxi.currentLoad > capacity) {
        taxi.currentLoad = capacity;
      }
    }

    // If updating allowReturnPickups, coerce to boolean
    if (allowReturnPickups !== undefined) {
      taxi.allowReturnPickups = Boolean(allowReturnPickups);
    }

    await taxi.save();

    // Populate for consistent response shape
    await taxi.populate("routeId", "routeName stops");
    await taxi.populate("driverId", "name username");

    res.status(200).json({
      message: "Taxi details updated successfully.",
      taxi: taxi,  // or formatTaxiDataForEmit(taxi)
    });

  } catch (err) {
    console.error("Error updating taxi details:", err);
    next(err);
  }
};

  