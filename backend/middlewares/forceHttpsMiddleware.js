// backend/middlewares/forceHttpsMiddleware.js

/**
 * Middleware to force all incoming HTTP requests to redirect to HTTPS.
 * This is typically used when your Node.js server is behind a proxy
 * (like Nginx, a load balancer, or cloud service) that handles SSL termination.
 *
 * IMPORTANT: This middleware relies on the 'trust proxy' setting in Express
 * being configured correctly (e.g., app.set('trust proxy', true)) if your
 * server is behind a proxy that sets headers like 'X-Forwarded-Proto'.
 * Without 'trust proxy', req.protocol will always be 'http' for connections
 * from the proxy, leading to infinite redirects.
 */
const forceHttpsMiddleware = (req, res, next) => {
  // Check if the request protocol is NOT HTTPS
  // req.protocol is correctly populated by Express when 'trust proxy' is set
  // based on headers like 'X-Forwarded-Proto'.
  if (req.protocol !== 'https') {
    // Construct the full HTTPS URL using the original hostname and URL path
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;

    // Redirect to the HTTPS version (301 Moved Permanently is standard for this)
    console.log(`Redirecting HTTP request to HTTPS: ${req.method} ${req.originalUrl} -> ${httpsUrl}`);
    return res.redirect(301, httpsUrl);
  }

  // If the request is already HTTPS, proceed to the next middleware/route
  next();
};

module.exports = forceHttpsMiddleware;
