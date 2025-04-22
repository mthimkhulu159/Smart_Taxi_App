const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require("crypto")
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values while ensuring uniqueness when set
    },
    role: {
      type: [String],
      default: ['passenger'],
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values while ensuring uniqueness when set
    },
    password: {
      type: String,
      select: false,
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    roleUpgradeRequested: { type: Boolean, default: false },
    isDeletionRequested: {
      type: Boolean,
      default: false,
    },
    deletionRequestedAt: {
      type: Date,
    }
  },
  { timestamps: true }
);

// Hash password before saving if it exists
userSchema.pre('save', async function (next) {
  if (this.password && this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (password) {
  if (!this.password) return false; // Prevent password comparison for Google users
  return await bcrypt.compare(password, this.password);
};


// Generate password reset token
userSchema.methods.generateResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpires = Date.now() + 3600000; // Token valid for 1 hour
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
