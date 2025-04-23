const jwt = require('jsonwebtoken');

// Function to generate JWT with user data (userId, email, role)
function generateToken(userId, email, role, name) {
  try {
    // JWT payload includes the user details you want to store
    const payload = {
      id: userId,
      email,
      role,  // Can be an array of roles e.g., ['user', 'admin']
      name,
    };

    // Retrieve the JWT secret from the environment variable
    const jwtSecret = process.env.JWT_SECRET;

    // Options for the token, such as expiration time (e.g., 1 hour)
    const options = { expiresIn: '30d' };

    // Generate the token
    const token = jwt.sign(payload, jwtSecret, options);

    return token;
  } catch (error) {
    console.error('Error generating JWT token:', error.message);
    throw new Error('Token generation failed');
  }
}

module.exports = generateToken;
