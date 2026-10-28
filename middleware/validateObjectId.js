// Rejects malformed ids (e.g. /api/transactions/abc) with 400 before they reach the database
module.exports = function validateObjectId(req, res, next) {
  if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
    return res.status(400).json({ message: 'Invalid id' });
  }
  next();
};
