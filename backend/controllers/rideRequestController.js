const RideRequest = require("../models/RideRequest");
const Route = require("../models/Route");
const Taxi = require("../models/Taxi");
const User = require("../models/User");
const { getIo, getUserSocketId } = require("../config/socket"); // Import getUserSocketId

// --- Existing Functions (createRideRequest, createPickupRequest, acceptRequest, etc.) ---
// Keep your existing functions here...

exports.createRideRequest = async (req, res) => {
  try {
    const passenger = req.user._id;
    const { startingStop, destinationStop } = req.body;

    if (!startingStop || !destinationStop) {
      return res.status(400).json({
        error: "Both starting and destination stops are required for a ride request.",
      });
    }

    const route = await Route.findOne({
      "stops.name": { $all: [startingStop, destinationStop] },
    });

    if (!route) {
      return res.status(404).json({ error: "No route found containing both stops." });
    }

    const startStopObj = route.stops.find((s) => s.name === startingStop);
    const destStopObj = route.stops.find((s) => s.name === destinationStop);

    if (!startStopObj || !destStopObj || startStopObj.order >= destStopObj.order) {
      return res.status(400).json({ error: "Invalid stop order for ride request." });
    }

    // Check for existing pending/accepted requests from the same passenger for the same route
    const existingRequest = await RideRequest.findOne({
      passenger,
      route: route._id,
      status: { $in: ["pending", "accepted"] }
    });

    if (existingRequest) {
      return res.status(400).json({ error: "You already have an active ride request on this route." });
    }


    const newRideRequest = new RideRequest({
      passenger,
      route: route._id,
      requestType: "ride",
      startingStop,
      destinationStop,
    });

    await newRideRequest.save();

    // --- Find eligible taxis (same as before) ---
    const taxisOnRoute = await Taxi.find({ routeId: route._id, status: "on trip" });
    const eligibleTaxis = taxisOnRoute.filter((taxi) => {
       if (!taxi.currentStop) return false; // Skip taxis with no current stop defined
       const taxiStop = route.stops.find((s) => s.name === taxi.currentStop);
       // Ensure taxi is actually on the route and before the passenger's start stop
       return taxiStop && taxiStop.order < startStopObj.order;
    });


    // **Emit notification to connected drivers**
    const io = getIo();

    eligibleTaxis.forEach((taxi) => {
      const driverSocketId = getUserSocketId(taxi.driverId.toString());
      if (driverSocketId) {
        io.to(driverSocketId).emit("newRideRequest", {
          requestId: newRideRequest._id,
          startingStop,
          destinationStop,
          route: route.name, // Use route name for display
          passengerName: req.user.name, // Send passenger name
        });
      }
    });

    return res.status(201).json({ rideRequest: newRideRequest, route, eligibleTaxis }); // Consider not sending eligibleTaxis list to passenger
  } catch (err) {
    console.error("Error in createRideRequest:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.createPickupRequest = async (req, res) => {
  try {
    const passenger = req.user._id;
    const { startingStop } = req.body;

    if (!startingStop) {
      return res.status(400).json({ error: "Starting stop is required for pickup requests." });
    }

    const route = await Route.findOne({ "stops.name": startingStop });

    if (!route) {
      return res.status(404).json({ error: "No route found containing the starting stop." });
    }

     // Check for existing pending/accepted requests from the same passenger for the same route
     const existingRequest = await RideRequest.findOne({
      passenger,
      route: route._id,
      status: { $in: ["pending", "accepted"] }
    });

    if (existingRequest) {
      return res.status(400).json({ error: "You already have an active pickup or ride request on this route." });
    }

    const newPickupRequest = new RideRequest({
      passenger,
      route: route._id,
      requestType: "pickup",
      startingStop,
      destinationStop: "", // No destination for pickup initially
    });

    await newPickupRequest.save();

    const eligibleTaxis = await Taxi.find({ routeId: route._id, status: "roaming" });

    // **Emit notification to roaming drivers**
    const io = getIo();

    eligibleTaxis.forEach((taxi) => {
      const driverSocketId = getUserSocketId(taxi.driverId.toString());
      if (driverSocketId) {
        io.to(driverSocketId).emit("newPickupRequest", {
          requestId: newPickupRequest._id,
          startingStop,
          route: route.name, // Use route name
          passengerName: req.user.name, // Send passenger name
        });
      }
    });

    return res.status(201).json({ rideRequest: newPickupRequest, route, eligibleTaxis }); // Consider not sending eligibleTaxis list to passenger
  } catch (err) {
    console.error("Error in createPickupRequest:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { requestId } = req.params;

    const rideRequest = await RideRequest.findById(requestId).populate("route").populate("passenger"); // Populate passenger too
    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found." });
    }

    if (rideRequest.status !== "pending") {
      return res.status(400).json({ error: "Request is no longer pending." });
    }

    const taxi = await Taxi.findOne({ driverId: driverId });
    if (!taxi) {
      return res.status(404).json({ error: "Taxi for this driver not found." });
    }

    // Check if taxi is already assigned to another accepted request
    const existingAcceptedRequest = await RideRequest.findOne({
        taxi: taxi._id,
        status: 'accepted',
        _id: { $ne: requestId } // Exclude the current request being accepted
    });

    if (existingAcceptedRequest) {
        return res.status(400).json({ error: "Taxi is already assigned to another accepted request." });
    }


    if (String(taxi.routeId) !== String(rideRequest.route._id)) {
      return res.status(400).json({ error: "Taxi is not on the correct route." });
    }

    // --- Request Type Specific Validation ---
    if (rideRequest.requestType === "ride") {
      if (taxi.status !== "on trip") {
        return res.status(400).json({ error: "Taxi must be 'on trip' to accept ride requests." });
      }
       if (!taxi.currentStop) {
         return res.status(400).json({ error: "Taxi's current location (stop) is unknown." });
       }

      const taxiStop = rideRequest.route.stops.find((s) => s.name === taxi.currentStop);
      const passengerStop = rideRequest.route.stops.find((s) => s.name === rideRequest.startingStop);

      if (!taxiStop || !passengerStop) {
        console.error("Error finding stops: ", { taxiStopName: taxi.currentStop, passengerStopName: rideRequest.startingStop, routeStops: rideRequest.route.stops });
        return res.status(400).json({ error: "Invalid route stops data for comparison." });
      }

      if (taxiStop.order >= passengerStop.order) {
        return res.status(400).json({ error: "Taxi has already passed the passenger's starting stop." });
      }
    } else if (rideRequest.requestType === "pickup") {
      if (taxi.status !== "roaming") {
        return res.status(400).json({ error: "Taxi must be 'roaming' to accept pickup requests." });
      }
      // Pickup request accepted, taxi starts its trip
      taxi.status = "on trip";
      taxi.currentStop = rideRequest.startingStop; // Taxi is now heading to/at the pickup stop
      await taxi.save();
    } else {
      return res.status(400).json({ error: "Unsupported request type." });
    }

    // --- Update Ride Request ---
    rideRequest.status = "accepted";
    rideRequest.taxi = taxi._id;
    await rideRequest.save();

    // --- Emit notification to the passenger ---
    const io = getIo();
    const passengerSocketId = getUserSocketId(rideRequest.passenger._id.toString());
    if (passengerSocketId) {
      // Populate driver details for the notification
      const driver = await User.findById(driverId); // Fetch driver details

      io.to(passengerSocketId).emit("requestAccepted", {
        requestId: rideRequest._id,
        driverId: driverId,
        driverName: driver ? driver.name : "N/A", // Include driver name
        taxiId: taxi._id,
        taxiNumberPlate: taxi.numberPlate, // Include taxi plate
        message: `Your ${rideRequest.requestType} request has been accepted by ${driver ? driver.name : 'driver'}!`,
      });
    } else {
         console.log(`Passenger ${rideRequest.passenger.name} (${rideRequest.passenger._id}) is not connected.`);
        // Optionally store notification in DB if user offline handling is needed
    }


    return res.status(200).json({ message: "Request accepted.", rideRequest });
  } catch (err) {
    console.error("Error in acceptRequest:", err);
    // Check if it's a duplicate key error (e.g., trying to accept already accepted) - though status check should prevent this
    if (err.code === 11000) {
        return res.status(400).json({ error: "Failed to accept request, possibly already assigned." });
    }
    return res.status(500).json({ error: "Server error while accepting request." });
  }
};

exports.getNearbyRequestsForDriver = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Unauthorized: Driver not authenticated." });
    }

    const driverId = req.user._id;

    const taxi = await Taxi.findOne({ driverId });
    if (!taxi) {
      return res.status(404).json({ error: "Taxi for this driver not found." });
    }

    // If taxi is roaming, it can see pickup requests on its route
    if (taxi.status === 'roaming') {
        if (!taxi.routeId) {
            // Roaming taxi not assigned to a route yet cannot see requests
             return res.status(200).json({ rideRequests: [], pickupRequests: [] });
        }
         const pickupRequests = await RideRequest.find({
            route: taxi.routeId,
            status: "pending",
            requestType: "pickup"
        }).populate('passenger', 'name'); // Populate passenger name

         const formattedPickupRequests = pickupRequests.map(req => ({
            requestId: req._id,
            passengerName: req.passenger ? req.passenger.name : 'Unknown',
            startingStop: req.startingStop,
            requestType: req.requestType,
            createdAt: req.createdAt
        }));

        // Roaming taxis don't see 'ride' requests
        return res.status(200).json({ rideRequests: [], pickupRequests: formattedPickupRequests });
    }

    // If taxi is 'on trip', find route and current stop
    if (taxi.status === 'on trip') {
        if (!taxi.routeId) {
            console.error("Taxi found but routeId is undefined for 'on trip' taxi:", taxi);
            return res.status(400).json({ error: "Taxi route information is missing." });
        }
        if (!taxi.currentStop) {
             console.error("Taxi is 'on trip' but currentStop is undefined for taxi:", taxi);
            return res.status(400).json({ error: "Taxi location (stop) is unknown." });
        }

        const route = await Route.findById(taxi.routeId);
        if (!route) {
            return res.status(404).json({ error: "Route not found for the taxi." });
        }

        if (!route.stops || !Array.isArray(route.stops) || route.stops.length === 0) {
            return res.status(400).json({ error: "Route stops are not defined." });
        }

        const taxiCurrentStopObj = route.stops.find((s) => s.name === taxi.currentStop);
        if (!taxiCurrentStopObj) {
            console.error(`Taxi's current stop '${taxi.currentStop}' not found in route '${route.name}' stops.`);
            return res.status(400).json({ error: "Taxi's current stop is invalid for this route." });
        }
        const currentOrder = taxiCurrentStopObj.order;

        // Find pending 'ride' requests on the *same route*
        const rideRequests = await RideRequest.find({
            route: route._id,
            status: "pending",
            requestType: "ride" // Only find 'ride' requests
        }).populate('passenger', 'name'); // Populate passenger name

        // Filter ride requests: starting stop must be *after* the taxi's current stop
        const nearbyRideRequests = rideRequests.filter((request) => {
            if (!request.startingStop) return false; // Ignore requests without a starting stop defined

            const requestStartStop = route.stops.find((s) => s.name === request.startingStop);

            // Request is valid if its start stop exists on the route AND its order is greater than the taxi's current stop order
            return requestStartStop && requestStartStop.order > currentOrder;
        });

         const formattedRideRequests = nearbyRideRequests.map(req => ({
            requestId: req._id,
            passengerName: req.passenger ? req.passenger.name : 'Unknown',
            startingStop: req.startingStop,
            destinationStop: req.destinationStop,
            requestType: req.requestType,
            createdAt: req.createdAt
        }));

        // 'On trip' taxis don't see 'pickup' requests
        return res.status(200).json({ rideRequests: formattedRideRequests, pickupRequests: [] });
    }

     // If taxi has other status (e.g., 'off duty', 'maintenance')
    return res.status(200).json({ rideRequests: [], pickupRequests: [] }); // No requests visible

  } catch (err) {
    console.error("Error in getNearbyRequestsForDriver:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.getAcceptedTaxiDetails = async (req, res) => {
  try {
    const passengerId = req.user._id;

    // Find the request that is accepted for this passenger
    const rideRequest = await RideRequest.findOne({
      passenger: passengerId,
      status: "accepted", // Only interested in accepted requests
      taxi: { $exists: true } // Ensure a taxi is assigned
    }).populate({ // Populate taxi details
        path: 'taxi',
        populate: { // Nested populate for the driver details within taxi
            path: 'driverId',
            select: 'name contact' // Select specific driver fields (use 'contact' if that's the field name in User model)
        }
    }).populate('route', 'name'); // Populate route name


    if (!rideRequest) {
       // Check if there's a pending request to give a different message
       const pendingRequest = await RideRequest.findOne({ passenger: passengerId, status: "pending"});
       if(pendingRequest) {
           return res.status(200).json({ message: "Your request is pending.", taxiDetails: null }); // Or 202 Accepted status
       }
      return res.status(404).json({ error: "No accepted ride request found.", taxiDetails: null });
    }

    if (!rideRequest.taxi) {
         // This case should ideally not happen if status is 'accepted' based on acceptRequest logic
         console.error("Accepted request found but taxi details are missing:", rideRequest);
      return res.status(404).json({ error: "Taxi details not available for this accepted request." });
    }

     if (!rideRequest.taxi.driverId) {
       console.error("Driver details missing on populated taxi object:", rideRequest.taxi);
      return res.status(404).json({ error: "Driver details not found for the assigned taxi." });
    }


    const taxiDetails = {
      taxiId: rideRequest.taxi._id,
      numberPlate: rideRequest.taxi.numberPlate,
      // Access populated driver details directly
      driverName: rideRequest.taxi.driverId.name,
      driverContact: rideRequest.taxi.driverId.contact, // Ensure 'contact' is the correct field name in your User model
      route: rideRequest.route ? rideRequest.route.name : "N/A", // Use populated route name
      currentStop: rideRequest.taxi.currentStop,
      capacity: rideRequest.taxi.capacity,
      currentLoad: rideRequest.taxi.currentLoad,
      status: rideRequest.taxi.status, // Taxi's current status (e.g., 'on trip')
      requestId: rideRequest._id,
      requestType: rideRequest.requestType,
      startingStop: rideRequest.startingStop,
      destinationStop: rideRequest.destinationStop,
    };

    return res.status(200).json({ taxiDetails });
  } catch (err) {
    console.error("Error in getAcceptedTaxiDetails:", err);
    return res.status(500).json({ error: "Server error retrieving taxi details." });
  }
};


exports.getDriverAcceptedPassengerDetails = async (req, res) => {
  try {
    const driverId = req.user._id;

     // Find the taxi associated with the driver
     const taxi = await Taxi.findOne({ driverId: driverId });
      if (!taxi) {
        return res.status(404).json({ error: "Taxi for this driver not found." });
      }

    // Find all accepted ride requests assigned *specifically to this driver's taxi*
    const rideRequests = await RideRequest.find({
      taxi: taxi._id, // Find requests assigned to this taxi
      status: "accepted" // Only get accepted ones
    }).populate("passenger", "name email phone") // Populate specific passenger fields
      .populate("route", "name"); // Populate route name

    if (!rideRequests.length) {
      return res.status(200).json({ passengerDetails: [] }); // Return empty array, not an error
    }

    // Map each ride request into a passenger details object.
    const passengerDetailsList = rideRequests.map((request) => {
        // Basic check if passenger object exists after population
       if (!request.passenger) {
           console.warn(`Request ${request._id} is missing passenger details despite population.`);
           return null; // Skip this request or handle appropriately
       }
        return {
            requestId: request._id,
            passengerId: request.passenger._id,
            passengerName: request.passenger.name,
            passengerEmail: request.passenger.email, // Ensure 'email' field exists
            passengerPhone: request.passenger.phone, // Ensure 'phone' field exists
            startingStop: request.startingStop,
            destinationStop: request.destinationStop,
            requestType: request.requestType,
            status: request.status, // Should always be 'accepted' here
            route: request.route ? request.route.name : "N/A", // Use populated route name
        }
    }).filter(details => details !== null); // Filter out any null entries if passenger population failed


    return res.status(200).json({ passengerDetails: passengerDetailsList });
  } catch (err) {
    console.error("Error in getDriverAcceptedPassengerDetails:", err);
    return res.status(500).json({ error: "Server error." });
  }
};


// --- NEW FUNCTIONS ---

/**
 * @desc Cancel a ride/pickup request (Passenger action)
 * @route DELETE /api/riderequests/:requestId/cancel/passenger
 * @access Private (Passenger)
 */
exports.cancelRequestPassenger = async (req, res) => {
  try {
    const passengerId = req.user._id;
    const { requestId } = req.params;

    const rideRequest = await RideRequest.findById(requestId).populate('taxi'); // Populate taxi to notify driver if accepted

    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found." });
    }

    // Ensure the user cancelling is the passenger who made the request
    if (rideRequest.passenger.toString() !== passengerId.toString()) {
      return res.status(403).json({ error: "You are not authorized to cancel this request." });
    }

    // Allow cancellation if pending or accepted
    if (rideRequest.status !== "pending" && rideRequest.status !== "accepted") {
      return res.status(400).json({ error: `Cannot cancel a request with status '${rideRequest.status}'.` });
    }

    const wasAccepted = rideRequest.status === "accepted";
    const assignedTaxi = rideRequest.taxi; // Get taxi details *before* deleting

    // Passenger cancels -> Delete the request
    await RideRequest.findByIdAndDelete(requestId);

    // **Emit notification to the driver if it was accepted**
    if (wasAccepted && assignedTaxi) {
      const taxiDetails = await Taxi.findById(assignedTaxi); // Fetch full taxi doc if needed
      if(taxiDetails && taxiDetails.driverId) {
        const driverSocketId = getUserSocketId(taxiDetails.driverId.toString());
        const io = getIo();
        if (driverSocketId) {
          io.to(driverSocketId).emit("passengerCancelled", {
            requestId: requestId,
            message: `Passenger cancelled the request starting at ${rideRequest.startingStop}.`,
          });
        }
      }
    }

    return res.status(200).json({ message: "Ride request successfully cancelled." });

  } catch (err) {
    console.error("Error in cancelRequestPassenger:", err);
    return res.status(500).json({ error: "Server error while cancelling request." });
  }
};


/**
 * @desc Cancel an *accepted* ride/pickup request (Driver action)
 * @route PATCH /api/riderequests/:requestId/cancel/driver
 * @access Private (Driver)
 */
exports.cancelRequestDriver = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { requestId } = req.params;

    const rideRequest = await RideRequest.findById(requestId).populate('taxi route passenger'); // Populate necessary fields

    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found." });
    }

    // Must be accepted to be cancelled by driver this way
    if (rideRequest.status !== "accepted") {
      return res.status(400).json({ error: "Only accepted requests can be cancelled by the driver." });
    }

    if (!rideRequest.taxi) {
       console.error(`Request ${requestId} is accepted but has no taxi assigned.`);
       return res.status(500).json({ error: "Internal error: Accepted request has no taxi assigned." });
    }

     // Ensure the driver cancelling is the one assigned to the request's taxi
     const assignedDriverId = rideRequest.taxi.driverId;
     if (!assignedDriverId || assignedDriverId.toString() !== driverId.toString()) {
       return res.status(403).json({ error: "You are not authorized to cancel this request." });
     }


    const wasPickupRequest = rideRequest.requestType === "pickup";

    // Driver cancels -> Revert status to pending, remove taxi assignment
    rideRequest.status = "pending";
    rideRequest.taxi = null; // Remove taxi assignment
    await rideRequest.save();

    // **If it was a pickup request, revert the taxi's status back to 'roaming'**
    if (wasPickupRequest) {
      const taxi = await Taxi.findOne({ driverId: driverId });
      if (taxi && taxi.status === "on trip") { // Ensure it's the correct taxi and status
        taxi.status = "roaming";
        // Optionally reset currentStop if needed, depending on your logic
        // taxi.currentStop = null; // Or some default stop
        await taxi.save();
      } else if (taxi) {
           console.warn(`Taxi ${taxi._id} status was ${taxi.status} when cancelling pickup request ${requestId}. Expected 'on trip'.`)
      } else {
          console.error(`Taxi not found for driver ${driverId} when cancelling pickup request ${requestId}.`);
      }
    }

    // --- Notifications ---
    const io = getIo();

    // 1. Notify the passenger that the driver cancelled
    const passengerSocketId = getUserSocketId(rideRequest.passenger._id.toString());
    if (passengerSocketId) {
      io.to(passengerSocketId).emit("driverCancelled", {
        requestId: rideRequest._id,
        message: "The driver cancelled your request. We are looking for another driver.",
      });
    }

    // 2. Re-notify eligible drivers that the request is available again
    const route = rideRequest.route; // Already populated
    if (route) {
      if (rideRequest.requestType === 'ride') {
          // Find eligible 'on trip' taxis before the starting stop
          const taxisOnRoute = await Taxi.find({ routeId: route._id, status: "on trip" });
          const startStopObj = route.stops.find((s) => s.name === rideRequest.startingStop);

          if(startStopObj){
              const eligibleTaxis = taxisOnRoute.filter((taxi) => {
                  if (!taxi.currentStop) return false;
                  const taxiStop = route.stops.find((s) => s.name === taxi.currentStop);
                  return taxiStop && taxiStop.order < startStopObj.order;
              });

              eligibleTaxis.forEach((taxi) => {
                  // Avoid notifying the driver who just cancelled if they somehow become eligible again immediately
                  if(taxi.driverId.toString() === driverId.toString()) return;

                  const otherDriverSocketId = getUserSocketId(taxi.driverId.toString());
                  if (otherDriverSocketId) {
                  io.to(otherDriverSocketId).emit("newRideRequest", { // Re-emit as a NEW request
                      requestId: rideRequest._id,
                      startingStop: rideRequest.startingStop,
                      destinationStop: rideRequest.destinationStop,
                      route: route.name,
                      passengerName: rideRequest.passenger.name, // Send passenger name
                  });
                  }
              });
          } else {
              console.error(`Start stop ${rideRequest.startingStop} not found on route ${route._id} when re-notifying drivers.`);
          }

      } else if (rideRequest.requestType === 'pickup') {
          // Find eligible 'roaming' taxis on the route
           const eligibleTaxis = await Taxi.find({ routeId: route._id, status: "roaming" });
            eligibleTaxis.forEach((taxi) => {
                 // Avoid notifying the driver who just cancelled
                 if(taxi.driverId.toString() === driverId.toString()) return;

                const otherDriverSocketId = getUserSocketId(taxi.driverId.toString());
                if (otherDriverSocketId) {
                io.to(otherDriverSocketId).emit("newPickupRequest", { // Re-emit as a NEW request
                    requestId: rideRequest._id,
                    startingStop: rideRequest.startingStop,
                    route: route.name,
                    passengerName: rideRequest.passenger.name, // Send passenger name
                });
                }
            });
      }
    } else {
        console.error(`Route not found for request ${rideRequest._id} when trying to re-notify drivers after cancellation.`);
    }


    return res.status(200).json({ message: "Request cancelled and made pending again.", rideRequest });

  } catch (err) {
    console.error("Error in cancelRequestDriver:", err);
    return res.status(500).json({ error: "Server error while cancelling request." });
  }
};