const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const rideRequestController = require("../controllers/rideRequestController");

router.use(protect)
// Create a new ride or pickup request (passenger endpoint)
router.post("/pickup", rideRequestController.createPickupRequest);

router.post("/ride", rideRequestController.createRideRequest);

router.get("/driver/ride-requests", rideRequestController.getNearbyRequestsForDriver);
router.get("/driver/pickup-requests", rideRequestController.getPickupByDriver);
router.get("/acceptedTaxiDetails", rideRequestController.getAcceptedTaxiDetails);
router.get("/acceptedPassengerDetails", rideRequestController.getDriverAcceptedPassengerDetails);

router.patch("/accept/:requestId", rideRequestController.acceptRequest)


/**
 * @route   DELETE /api/riderequests/:requestId/cancel/passenger
 * @desc    Allows a passenger to cancel their own ride or pickup request.
 * @access  Private (Passenger)
 * @param   {String} requestId - The ID of the ride request to cancel.
 */
router.delete(
    '/:requestId/cancel/passenger', // Route path with request ID parameter
    rideRequestController.cancelRequestPassenger // Controller function to handle the logic
);

/**
 * @route   PATCH /api/riderequests/:requestId/cancel/driver
 * @desc    Allows a driver to cancel a request they have already accepted.
 * This reverts the request status to 'pending'.
 * @access  Private (Driver)
 * @param   {String} requestId - The ID of the ride request to cancel.
 */
router.patch(
    '/:requestId/cancel/driver',   // Route path with request ID parameter
    rideRequestController.cancelRequestDriver // Controller function to handle the logic
);
module.exports = router;
