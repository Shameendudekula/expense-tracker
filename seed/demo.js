// npm run demo – runs the full app on a temporary in-memory MongoDB with the demo user and data.
// Handy for trying the app without MongoDB Atlas. Data is lost when you stop it.
const crypto = require('crypto');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// A throwaway secret is fine here: tokens only need to survive until you stop the demo
process.env.JWT_SECRET ||= crypto.randomBytes(48).toString('hex');

const app = require('../app');
const { seedDemo } = require('./seed');
const { DEMO_USER } = require('./sampleData');

const PORT = process.env.PORT || 5050;

(async () => {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { inserted } = await seedDemo();
  app.listen(PORT, () =>
    console.log(`Demo running on http://localhost:${PORT} (in-memory database, ${inserted} transactions) – log in with ${DEMO_USER.email} / ${DEMO_USER.password}`)
  );

  const shutdown = async () => { await mongoose.disconnect(); await mongo.stop(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
