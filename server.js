require('dotenv').config({ quiet: true });

const app = require('./app');
const connectDB = require('./config/db');
const User = require('./models/User');

const PORT = process.env.PORT || 5050;

async function start() {
  try {
    // Tokens signed with a short or missing secret could be forged, so refuse to start without one
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be set and at least 32 characters long (see .env.example)');
    }
    await connectDB(process.env.MONGO_URI);
    // Make sure the unique index on email exists before accepting requests
    await User.init();
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
