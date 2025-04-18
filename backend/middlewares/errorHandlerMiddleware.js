const errorHandler = (err, req, res, next) => {
    console.error("Server Error:", err);
  
    if (res.headersSent) {
      return next(err);
    }
  
    const statusCode = err.statusCode || 500;
    const response = {
      success: false,
      message: err.message || "Internal Server Error",
    };
  
    // Only send stack trace in development
    if (process.env.NODE_ENV === "production") {
      response.stack = err.stack;
    }
  
    res.status(statusCode).json(response);
  };
  
  module.exports = errorHandler;
  