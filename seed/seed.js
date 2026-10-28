// npm run seed – creates (or resets) the demo user and replaces ONLY that user's transactions.
// Other users' accounts and data are never touched.
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { DEMO_USER, generateTransactions } = require('./sampleData');

async function seedDemo() {
  await User.init();
  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) user = new User(DEMO_USER);
  // Reset name, password and currency in case they were changed while trying the app
  user.set(DEMO_USER);
  await user.save();

  const { deletedCount } = await Transaction.deleteMany({ user: user._id });
  const inserted = await Transaction.insertMany(generateTransactions().map((t) => ({ ...t, user: user._id })));
  return { user, deletedCount, inserted: inserted.length };
}

if (require.main === module) {
  (async () => {
    try {
      await connectDB(process.env.MONGO_URI);
      const { deletedCount, inserted } = await seedDemo();
      console.log(`Demo user ready: ${DEMO_USER.email} / ${DEMO_USER.password}`);
      console.log(`Removed ${deletedCount} old demo transactions, inserted ${inserted}.`);
    } catch (err) {
      console.error('Seeding failed:', err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}

module.exports = { seedDemo };
