const express = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/authController');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// Slow down password guessing: at most 20 login/register attempts per IP every 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many attempts, please try again in a few minutes' },
  skip: () => process.env.NODE_ENV === 'test',
});

router.post('/register', authLimiter, ctrl.register);
router.post('/login', authLimiter, ctrl.login);
router.route('/me').get(requireAuth, ctrl.me).patch(requireAuth, ctrl.updateMe);

module.exports = router;
