const express = require("express");
const passport = require("passport");
const authController = require('../controllers/authController');
const { check } = require("express-validator")

const router = express.Router();

// Google Login Route
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google Callback Route
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req, res) => {
    res.json({
      message: "Login successful",
      user: req.user.user,
      token: req.user.token,
    });
  }
);

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);


// Forgot password
router.post(
  "/forgot-password",
  [check("email", "Please enter a valid email.").isEmail()],
  authController.forgotPassword
);

// Verify token
router.post(
  "/verify-token",
  [check("email", "Please enter a valid email.").isEmail(), check("token", "Token is required.").notEmpty()],
  authController.verifyToken
);

// Reset password
router.post(
  "/reset-password",
  [
    check("email", "Please enter a valid email.").isEmail(),
    check("token", "Token is required.").notEmpty(),
    check("newPassword", "Password should be at least 6 characters.").isLength({ min: 6 }),
    check("confirmPassword", "Password confirmation is required.").exists(),
  ],
  authController.resetPassword
);

module.exports = router;
