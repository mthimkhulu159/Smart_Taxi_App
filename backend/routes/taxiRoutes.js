const express = require("express");
const { protect } = require("../middlewares/authMiddleware");
const taxiController = require("../controllers/taxiController");

const router = express.Router();

// Protect all routes with authentication
router.use(protect);

// === Driver Taxi Management ===

// Route to add a taxi
router.post("/addTaxi", taxiController.addTaxi);

// Route to get all taxis assigned to a driver
router.get("/driver-taxi", taxiController.getDriverTaxis);

// === Taxi Monitoring ===

// Route for monitoring taxi updates (for passengers)
router.get("/:taxiId/monitor", taxiController.monitorTaxi);

// === Taxi Updates ===

// Route to delete a taxi
router.delete("/:taxiId/delete", taxiController.deleteTaxi);

// Route to update taxi details (e.g., route, capacity, return pickups)
router.patch("/taxis/:taxiId", taxiController.updateTaxiDetails);

// Route to manually update current stop
router.put("/:taxiId/currentStopManual", taxiController.updateCurrentStopManual);

// Route for updating the taxi's current stop (based on route)
router.put("/:taxiId/currentStop", taxiController.updateCurrentStop);

// Route to update the taxi's load (current passengers)
router.put("/:taxiId/load", taxiController.updateLoad);

// Route to update the taxi's status (available, roaming, etc.)
router.put("/:taxiId/status", taxiController.updateStatus);

// === Taxi Search ===

// Route to search for taxis by start & end location
router.get("/search", taxiController.searchTaxis);

// === Taxi Stops ===

// Route to fetch stops for a taxi
router.get("/:taxiId/stops", taxiController.getStopsForTaxi);

module.exports = router;
