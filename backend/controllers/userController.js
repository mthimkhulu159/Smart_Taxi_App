const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');


exports.getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isDeletionRequested: user.isDeletionRequested,
        deletionRequestedAt: user.deletionRequestedAt,
      }
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// Update user details (name, phone, email)

exports.updateUserDetails = async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Check if phone number is taken by another user
    const existingUserWithPhone = await User.findOne({ phone: phone.trim(), _id: { $ne: req.user.id } });
    if (existingUserWithPhone) {
      return res.status(409).json({ message: 'Phone number already in use by another account.' });
    }

    // Update user details
    user.name = name.trim();
    user.phone = phone.trim();

    await user.save();

    res.status(200).json({
      message: 'User details updated successfully',
      user: {
        name: user.name,
        phone: user.phone,
        email: user.email,  // optionally return email if you want
      },
    });
  } catch (error) {
    console.error('Error updating user details:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.upgradeToDriver = async (req, res) => {
  const userId = req.user.id; // Get the user ID from the authenticated request (from protect middleware)
  const adminEmail = process.env.ADMIN_EMAIL; // Admin email to notify

  try {
    // Fetch the user from the database by ID and exclude the password field from the result
    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If the user already requested the upgrade, inform them
    if (user.roleUpgradeRequested) {
      return res.status(400).json({ message: 'Your upgrade request is already pending approval' });
    }

    // Set the 'roleUpgradeRequested' flag to true
    user.roleUpgradeRequested = true;
    await user.save();

    // Send email to admin for approval
    const subject = 'Request to Upgrade to Driver';
    const text = `User ${user.email} has requested to be upgraded to a driver. Please review and approve the request.`;
    await sendEmail("kgotatso909@gmail.com", subject, text);

    // Send confirmation email to the user
    const userSubject = 'Upgrade Request Received';
    const userText = `Hello ${user.name},\n\nYour request to be upgraded to a driver has been received. An admin will review and approve the request shortly.\n\nThank you.`;
    await sendEmail(user.email, userSubject, userText);

    return res.status(200).json({ message: 'Your request for an upgrade to driver has been sent for approval' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.requestAccountDeletion = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.isDeletionRequested) {
      return res.status(400).json({ message: 'Deletion already requested' });
    }

    user.isDeletionRequested = true;
    user.deletionRequestedAt = new Date();
    await user.save();

    res.status(200).json({ message: 'Account deletion initiated. Your account will be permanently deleted in 7 days.' });
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};


exports.cancelAccountDeletion = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isDeletionRequested = false;
    user.deletionRequestedAt = null;
    await user.save();

    res.status(200).json({ message: 'Account deletion canceled' });
  } catch (err) {
    res.status(500).json({ message: 'Something went wrong', error: err.message });
  }
};


