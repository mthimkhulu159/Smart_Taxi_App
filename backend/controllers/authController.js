const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer")

const sendEmail = async (email, resetToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // You can configure other providers
    auth: {
      user: process.env.EMAIL_USER, // Add your email address
      pass: process.env.EMAIL_PASS, // Add your email password or app password
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset Request",
    text: `Use the following code to reset your password: ${resetToken}`,
  };

  return transporter.sendMail(mailOptions);
};

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role = 'passenger' } = req.body; // Default role is 'passenger'

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'Email already in use' });

    const newUser = await User.create({ name, email, password, role });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
      token: generateToken(newUser._id, newUser.email, newUser.role, newName.name), // Include the role in the token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// Login User
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role, // Include role in response
      },
      token: generateToken(user._id, user.email, user.role, user.name), // Include role in the token
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "User not found." });
  }

  const resetToken = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits token
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = Date.now() + 3600000; // Token valid for 1 hour

  await user.save();

  try {
    await sendEmail(email, resetToken);
    return res.status(200).json({ message: "Password reset token sent to your email." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error sending email." });
  }
}

exports.verifyToken = async (req, res) => {
  const { email, token } = req.body;

  const user = await User.findOne({ email });

  if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }

  // Token is valid
  res.status(200).json({ message: "Token is valid. Proceed to reset password." });
};


exports.resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;

  const user = await User.findOne({ email });

  if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired token." });
  }


  // Update password
  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.status(200).json({ message: "Password successfully reset." });
};

