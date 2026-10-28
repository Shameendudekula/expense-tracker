const express = require('express');
const ctrl = require('../controllers/reportController');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/summary', ctrl.getSummary);
router.get('/export', ctrl.exportCsv);

module.exports = router;
