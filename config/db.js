const mongoose = require('mongoose');

async function connectDB(rawUri) {
  // Tolerate copy-paste slips in hosting dashboards: surrounding spaces or quotes
  const uri = (rawUri || '').trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!uri) throw new Error('MONGO_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.');
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    // Show only the first characters (never the password) so the mistake is easy to spot
    throw new Error(
      `MONGO_URI must start with "mongodb+srv://" but starts with "${uri.slice(0, 10)}…". ` +
        'Paste only the value, without "MONGO_URI=" or quotes.'
    );
  }

  // Close pooled connections after 60 s idle, so a request after a laptop sleep or network change
  // doesn't pick up a dead connection (which shows up as "read ECONNRESET")
  await mongoose.connect(uri, { maxIdleTimeMS: 60_000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
