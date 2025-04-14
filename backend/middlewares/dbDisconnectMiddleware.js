const mongoose = require('mongoose');

const gracefulShutdown = () => {
  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
  });

  process.on('SIGINT', async () => {
    try {
      await mongoose.connection.close(); // Await the connection close
      console.log('MongoDB disconnected due to app termination');
      process.exit(0);
    } catch (err) {
      console.error('Error while disconnecting from MongoDB', err);
      process.exit(1);
    }
  });
};

module.exports = gracefulShutdown;
