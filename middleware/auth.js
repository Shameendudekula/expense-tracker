const User = require('../models/User');
const { verifyToken } = require('../utils/token');

// Protects a route: the request must carry a valid token in the header
//   Authorization: Bearer <token>
// On success the logged-in user is attached as req.user for the controllers to use.
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Please log in to continue' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Your session has expired, please log in again' : 'Invalid token, please log in again';
    return res.status(401).json({ message });
  }

  // Look the user up so a token for a deleted account stops working immediately
  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ message: 'Account no longer exists, please log in again' });

  req.user = user;
  next();
};
