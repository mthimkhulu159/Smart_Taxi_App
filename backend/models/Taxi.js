const mongoose = require("mongoose");


const taxiSchema = new mongoose.Schema(
  {
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
      enum: ["waiting", "available", "roaming", "almost full", "full", "on trip", "not available"],
      default: "not available",
    },
    currentStop: {
      type: String, // Stores current stop
      required: true,
      trim: true,
    },
    direction: {
      type: String,
      enum: ['forward', 'return'],
      default: 'forward'
    },
    allowReturnPickups: {
      type: Boolean,
      default: false
    },    
  },
  { timestamps: true }
);

const Taxi = mongoose.model("Taxi", taxiSchema);
module.exports = Taxi;
