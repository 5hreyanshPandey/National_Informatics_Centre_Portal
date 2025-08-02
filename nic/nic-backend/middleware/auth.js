

const jwt = require('jsonwebtoken');

const auth = (role) => (req, res, next) => {
  // Log entry to middleware
  console.log('Auth middleware invoked for:', req.originalUrl);

  // Extract token from Authorization header
  const authHeader = req.header('Authorization');
  console.log('Authorization header:', authHeader);

  if (!authHeader) {
    console.log('No Authorization header provided');
    return res.status(401).json({ message: 'No Authorization header, authorization denied' });
  }

  // Ensure token starts with 'Bearer '
  if (!authHeader.startsWith('Bearer ')) {
    console.log('Invalid Authorization header format');
    return res.status(401).json({ message: 'Invalid Authorization header format, must start with Bearer' });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    console.log('No token found after Bearer prefix');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    console.log('Verifying token:', token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decoded:', decoded);

    // Ensure decoded token has id
    if (!decoded.id) {
      console.log('Invalid token: missing id');
      return res.status(401).json({ message: 'Invalid token: missing user ID' });
    }

    req.user = decoded; // Attach decoded user data to req.user
    console.log('req.user set:', req.user);

    // Role-based access control
    if (role && decoded.role !== role) {
      console.log(`Role mismatch: required ${role}, got ${decoded.role}`);
      return res.status(403).json({ message: `Access denied: ${role} role required` });
    }

    next(); // Proceed to route handler
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({ message: `Invalid token: ${err.message}` });
  }
};

module.exports = auth;