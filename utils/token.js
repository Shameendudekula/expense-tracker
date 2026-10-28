const jwt = require('jsonwebtoken');

// A JWT is a signed string with three parts: header.payload.signature.
// The payload here is just the user's id ("sub" = subject). The signature is made with JWT_SECRET,
// so the server can later check the token wasn't forged or changed - without storing sessions.
function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Throws if the signature is wrong or the token has expired
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
}

module.exports = { signToken, verifyToken };
