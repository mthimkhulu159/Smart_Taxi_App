const mongoose = require("mongoose");

const taxiSchema = new mongoose.Schema(
  {
    taxiId: {
      type: String,
      required: true,
      unique: true,
    },
    numberPlate: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentLoad: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: function (value) {
          return value <= this.capacity;
        },
        message: "Current load cannot exceed capacity.",
      },
    },
    status: {
      type: String,
      enum: ["waiting", "available", "roaming","almost full", "full", "on trip", "not available"],
      default: "not available",
    },
    location: {
      type: String,
      required: true, // Represents the taxi station
      trim: true,
    },
  },
  { timestamps: true }
);

const Taxi = mongoose.model("Taxi", taxiSchema);
module.exports = Taxi;
