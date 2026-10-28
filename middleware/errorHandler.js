const mongoose = require('mongoose');

// 404 for unknown /api routes
function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler. Express 5 forwards errors thrown in async route handlers here automatically,
// so controllers don't need try/catch. Each known error type is mapped to a clear status code.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Schema validation failed -> 400 with a message per field
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = {};
    for (const [field, e] of Object.entries(err.errors)) {
      errors[field] = e.name === 'CastError' ? `Invalid value for ${field}` : e.message;
    }
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // Unique index violated (email already registered) -> 409 Conflict
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const label = field.charAt(0).toUpperCase() + field.slice(1);
    return res.status(409).json({
      message: `An account with this ${field} already exists`,
      errors: { [field]: `${label} is already registered` },
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }

  console.error(err);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong on the server' : err.message,
  });
}

module.exports = { notFound, errorHandler };
