// Shared test setup: a temporary in-memory MongoDB, so tests never touch your Atlas database
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';

const { before, after, beforeEach } = require('node:test');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

function setupDatabase() {
  let mongo;
  before(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await User.init();
  });
  after(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Transaction.deleteMany({})]);
  });
}

// Registers a user and returns { token, user, auth } where auth is the Authorization header value
async function registerUser(overrides = {}) {
  const body = { name: 'Test User', email: 'test@example.com', password: 'secret123', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body).expect(201);
  return { token: res.body.token, user: res.body.user, auth: `Bearer ${res.body.token}` };
}

module.exports = { app, request, setupDatabase, registerUser, User, Transaction };
