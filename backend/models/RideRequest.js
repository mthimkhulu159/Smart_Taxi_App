const mongoose = require("mongoose");

const rideRequestSchema = new mongoose.Schema(
  {
    // The user who is making the request.
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Reference to the route, which holds the stops (with orders) and route details.
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    // Type of request: "ride" for a stop-order based ride request, or "pickup" for on-demand pickup.
    requestType: {
      type: String,
      enum: ["ride", "pickup"],
      required: true,
    },
    // The name of the stop where the passenger is waiting.
    // You can use this value to look up the stop order in the referenced route.
    startingStop: {
      type: String,
      required: true,
      trim: true,
    },
    // The destination stop name (optional based on your app's flow).
    destinationStop: {
      type: String,
      trim: true,
    },
    // Current status of the request.
    status: {
      type: String,
      enum: ["pending", "acacepted", "cancelled", "completed"],
      default: "pending",
    },
    // The taxi assigned to this request (if any).
    taxi: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Taxi",
    },
    // Timestamps such as createdAt and updatedAt will be added automatically.
  },
  { timestamps: true }
);

const RideRequest = mongoose.model("RideRequest", rideRequestSchema);
module.exports = RideRequest;
