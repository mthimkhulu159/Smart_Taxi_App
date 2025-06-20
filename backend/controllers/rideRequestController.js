const RideRequest = require("../models/RideRequest");
const Route = require("../models/Route");
const Taxi = require("../models/Taxi");
const User = require("../models/User");
const { getIo, getUserSocketId } = require("../config/socket"); // Import getUserSocketId

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

    const newRideRequest = new RideRequest({
      passenger,
      route: route._id,
      requestType: "ride",
      startingStop,
      destinationStop,
    });

    await newRideRequest.save();

    const taxisOnRoute = await Taxi.find({
      routeId: route._id,
      status: "on trip",
    });

    const eligibleTaxis = taxisOnRoute.filter((taxi) => {
      const taxiStop = route.stops.find((s) => s.name === taxi.currentStop);
      if (!taxiStop) return false;

      if (taxi.direction === "forward") {
        return taxiStop.order < startStopObj.order;
      } else if (taxi.direction === "return") {
        return taxiStop.order > startStopObj.order;
      }

      return false;
    });

    const io = getIo();
    eligibleTaxis.forEach((taxi) => {
      const driverSocketId = getUserSocketId(taxi.driverId.toString());
      if (driverSocketId) {
        io.to(driverSocketId).emit("newRideRequest", {
          requestId: newRideRequest._id,
          startingStop,
          destinationStop,
          route: route.name,
        });
      }
    });

    return res.status(201).json({ rideRequest: newRideRequest, route, eligibleTaxis });
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

    const newPickupRequest = new RideRequest({
      passenger,
      route: route._id,
      requestType: "pickup",
      startingStop,
      destinationStop: "",
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
          route: route.name,
        });
      }
    });

    return res.status(201).json({ rideRequest: newPickupRequest, route, eligibleTaxis });
  } catch (err) {
    console.error("Error in createPickupRequest:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { requestId } = req.params;

    const rideRequest = await RideRequest.findById(requestId).populate("route");
    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found." });
    }

    if (rideRequest.status !== "pending") {
      return res.status(400).json({ error: "Request is no longer pending." });
    }

    const taxi = await Taxi.findOne({ driverId });
    if (!taxi) {
      return res.status(404).json({ error: "Taxi for this driver not found." });
    }

    if (String(taxi.routeId) !== String(rideRequest.route._id)) {
      return res.status(400).json({ error: "Taxi is not on the correct route." });
    }

    const startStop = rideRequest.route.stops.find(s => s.name === rideRequest.startingStop);
    const currentStop = rideRequest.route.stops.find(s => s.name === taxi.currentStop);

    if (!startStop || !currentStop) {
      return res.status(400).json({ error: "Invalid stop information." });
    }

    if (rideRequest.requestType === "ride") {
      if (taxi.status !== "on trip") {
        return res.status(400).json({ error: "Taxi is not available for ride requests." });
      }

      if (taxi.direction === "forward") {
        if (currentStop.order >= startStop.order) {
          return res.status(400).json({ error: "Taxi has already passed the passenger's stop (forward)." });
        }
      } else if (taxi.direction === "return") {
        if (currentStop.order <= startStop.order) {
          return res.status(400).json({ error: "Taxi has already passed the passenger's stop (return)." });
        }
      } else {
        return res.status(400).json({ error: "Taxi direction not specified." });
      }

    } else if (rideRequest.requestType === "pickup") {
      if (taxi.status !== "roaming") {
        return res.status(400).json({ error: "Taxi is not available for pickup requests." });
      }
      // Direction doesn't matter for pickup
    } else {
      return res.status(400).json({ error: "Unsupported request type." });
    }

    rideRequest.status = "accepted";
    rideRequest.taxi = taxi._id;
    await rideRequest.save();

    const io = getIo();
    const passengerSocketId = getUserSocketId(rideRequest.passenger.toString());
    if (passengerSocketId) {
      io.to(passengerSocketId).emit("requestAccepted", {
        requestId: rideRequest._id,
        driverId,
        taxi: taxi._id,
        message: "Your ride request has been accepted!",
      });
    }

    return res.status(200).json({ message: "Request accepted.", rideRequest });

  } catch (err) {
    console.error("Error in acceptRequest:", err);
    return res.status(500).json({ error: "Server error." });
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

    if (!taxi.routeId) {
      console.error("Taxi found but routeId is undefined for taxi:", taxi);
      return res.status(400).json({ error: "Taxi route information is missing." });
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
      return res.status(400).json({ error: "Taxi's current stop is not found in the route stops." });
    }

    const currentOrder = taxiCurrentStopObj.order;

    if (!["available", "on trip"].includes(taxi.status)) {
      return res.status(400).json({ error: "Taxi must be 'available' or 'on trip' to view ride requests." });
    }

    const rideRequests = await RideRequest.find({
      route: route._id,
      status: "pending",
      requestType: "ride",
    });

    const nearbyRequests = rideRequests.filter((request) => {
      if (!request.startingStop || !request.destinationStop) return false;

      const requestStartStop = route.stops.find((s) => s.name === request.startingStop);
      if (!requestStartStop) return false;

      const requestOrder = requestStartStop.order;

      if (taxi.direction === "forward") {
        return requestOrder === currentOrder || requestOrder > currentOrder;
      } else if (taxi.direction === "return") {
        return requestOrder === currentOrder || requestOrder < currentOrder;
      }

      return false;
    });

    return res.status(200).json({ rideRequests: nearbyRequests });

  } catch (err) {
    console.error("Error in getNearbyRequestsForDriver:", err);
    return res.status(500).json({ error: "Server error." });
  }
};



exports.getPickupByDriver = async (req, res) => {
  try {
    // 1. Authenticate the driver and get the driver's ID.
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Unauthorized: Driver not authenticated." });
    }

    const driverId = req.user._id;

    // 2. Find the taxi associated with the driver.
    const taxi = await Taxi.findOne({ driverId });

    // 3. Check if the taxi exists and its status is "roaming".
    if (!taxi) {
      return res.status(404).json({ error: "Taxi for this driver not found." });
    }

    if (taxi.status !== 'roaming' && taxi.status !== 'available') {
        // Inform the driver they need to be in 'roaming' status to see pickup requests
        return res.status(400).json({ error: "Your taxi must be in 'roaming' or available status to receive pickup requests." });
    }

    // 4. Get the taxi's current stop.
    const driverCurrentStop = taxi.currentStop;

    // 5. Find pending 'pickup' RideRequest documents at the driver's current stop.
    const pickupRequests = await RideRequest.find({
      requestType: "pickup", // Filter for pickup requests
      status: "pending",     // Filter for pending requests
      startingStop: driverCurrentStop // Filter for requests at the driver's current stop
    })
    .populate('passenger', 'name phone'); // Optionally populate passenger details

    // 6. Return the found "pickup" requests.
    // If no requests are found, pickupRequests will be an empty array, which is a valid response.
    return res.status(200).json({ pickupRequests });

  } catch (err) {
    console.error("Error in getPickupByDriver:", err);
    // Generic server error message for security
    return res.status(500).json({ error: "Server error while fetching pickup requests." });
  }
};


exports.getAcceptedTaxiDetails = async (req, res) => {
  try {
    const passengerId = req.user._id;

    const rideRequest = await RideRequest.findOne({
      passenger: passengerId,
      status: "accepted",
    }).populate("taxi route");

    if (!rideRequest) {
      return res.status(404).json({ error: "Ride request not found or not accepted." });
    }

    if (!rideRequest.taxi) {
      return res.status(404).json({ error: "Taxi details not available for this request." });
    }

    const driver = await User.findOne({ _id: rideRequest.taxi.driverId });

    if (!driver) {
      return res.status(404).json({ error: "Driver details not found." });
    }
    

    const taxiDetails = {
      taxiId: rideRequest.taxi._id,
      numberPlate: rideRequest.taxi.numberPlate,
      driverName: driver.name,
      driverContact: driver.contact,
      route: rideRequest.route.routeName,
      currentStop: rideRequest.taxi.currentStop,
      capacity: rideRequest.taxi.capacity,
      currentLoad: rideRequest.taxi.currentLoad,
      status: rideRequest.taxi.status,
      requestId: rideRequest._id,
    };

    return res.status(200).json({ taxiDetails });
  } catch (err) {
    console.error("Error in getAcceptedTaxiDetails:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

exports.getPendingRideRequests = async (req, res) => {
  try {
    const passengerId = req.user._id;

    // Find all ride requests with status "pending" made by the passenger
    const pendingRequests = await RideRequest.find({
      passenger: passengerId,
      status: "pending",
    }).populate("route");

    if (!pendingRequests.length) {
      return res.status(404).json({ error: "No pending ride requests found for this passenger." });
    }

    // Map the pending requests to include relevant details
    const pendingRequestDetails = pendingRequests.map((request) => ({
      requestId: request._id,
      startingStop: request.startingStop,
      destinationStop: request.destinationStop,
      route: request.route.routeName,  // Include route details if needed
      requestType: request.requestType,  // Include the type of request (ride or pickup)
      status: request.status,  // Status will be 'pending' here
      createdAt: request.createdAt,  // You can display when the request was created
    }));

    return res.status(200).json({ pendingRequests: pendingRequestDetails });
  } catch (err) {
    console.error("Error in getPendingRideRequests:", err);
    return res.status(500).json({ error: "Server error." });
  }
};


exports.getDriverAcceptedPassengerDetails = async (req, res) => {
  try {
    const driverId = req.user._id;

    // Find all accepted ride requests that have an assigned taxi
    const rideRequests = await RideRequest.find({
      status: "accepted",
      taxi: { $exists: true },
    }).populate("passenger taxi route");

    // Filter for ride requests where the taxi's driverId matches the logged-in driver
    const driverRideRequests = rideRequests.filter((request) => {
      return request.taxi && request.taxi.driverId.toString() === driverId.toString();
    });

    if (!driverRideRequests.length) {
      return res.status(404).json({ error: "No accepted ride requests found for this driver." });
    }

    // Map each ride request into a passenger details object.
    const passengerDetailsList = driverRideRequests.map((request) => ({
      requestId: request._id,
      passengerId: request.passenger._id,
      passengerName: request.passenger.name,
      passengerEmail: request.passenger.email,
      passengerPhone: request.passenger.phone,
      startingStop: request.startingStop,
      destinationStop: request.destinationStop,
      status: request.status,
      requestType: request.requestType,
      route: request.route.routeName,
    }));

    return res.status(200).json({ passengerDetails: passengerDetailsList });
  } catch (err) {
    console.error("Error in getDriverAcceptedPassengerDetails:", err);
    return res.status(500).json({ error: "Server error." });
  }
};

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
