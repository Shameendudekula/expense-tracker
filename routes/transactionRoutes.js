const express = require('express');
const ctrl = require('../controllers/transactionController');
const requireAuth = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

// Every transaction route needs a logged-in user
router.use(requireAuth);

router.route('/').get(ctrl.getTransactions).post(ctrl.createTransaction);

router
  .route('/:id')
  .all(validateObjectId)
  .get(ctrl.getTransaction)
  .put(ctrl.updateTransaction)
  .delete(ctrl.deleteTransaction);

module.exports = router;
