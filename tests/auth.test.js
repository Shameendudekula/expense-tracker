const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { app, request, setupDatabase, registerUser, User } = require('./helpers');

setupDatabase();

test('register returns 201, a JWT and the user without the password', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Asha', email: 'ASHA@Example.com', password: 'secret123', currency: 'SEK' })
    .expect(201);
  assert.ok(res.body.token.split('.').length === 3, 'token has three JWT parts');
  assert.equal(res.body.user.email, 'asha@example.com');
  assert.equal(res.body.user.currency, 'SEK');
  assert.equal(res.body.user.password, undefined);
});

test('passwords are stored as bcrypt hashes, never in plain text', async () => {
  await registerUser();
  const stored = await User.findOne({ email: 'test@example.com' }).select('+password').lean();
  assert.notEqual(stored.password, 'secret123');
  assert.match(stored.password, /^\$2[aby]\$12\$/);
});

test('register validates input (400) and rejects a duplicate email (409)', async () => {
  const bad = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: 'short', currency: 'EUR' }).expect(400);
  for (const f of ['name', 'email', 'password', 'currency']) assert.ok(bad.body.errors[f], `error for ${f}`);

  await registerUser();
  const dup = await request(app).post('/api/auth/register').send({ name: 'Other', email: 'Test@example.com', password: 'secret123' }).expect(409);
  assert.match(dup.body.message, /already exists/);
});

test('register ignores fields it should not accept', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Asha', email: 'a@example.com', password: 'secret123', _id: '000000000000000000000001', role: 'admin' })
    .expect(201);
  assert.notEqual(res.body.user._id, '000000000000000000000001');
  assert.equal(res.body.user.role, undefined);
});

test('login works with the right password and gives the same error for wrong email or password', async () => {
  await registerUser();
  const ok = await request(app).post('/api/auth/login').send({ email: 'TEST@example.com', password: 'secret123' }).expect(200);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.password, undefined);

  const wrongPw = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrongpass' }).expect(401);
  const noUser = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'secret123' }).expect(401);
  assert.equal(wrongPw.body.message, noUser.body.message);

  await request(app).post('/api/auth/login').send({ email: 'test@example.com' }).expect(400);
  await request(app).post('/api/auth/login').send({ email: { $gt: '' }, password: { $gt: '' } }).expect(400);
});

test('GET /me needs a valid token', async () => {
  const { auth } = await registerUser();
  const me = await request(app).get('/api/auth/me').set('Authorization', auth).expect(200);
  assert.equal(me.body.user.email, 'test@example.com');

  await request(app).get('/api/auth/me').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.token').expect(401);
  await request(app).get('/api/auth/me').set('Authorization', auth.replace('Bearer ', 'Token ')).expect(401);
});

test('tokens that are forged, expired or belong to a deleted user are rejected', async () => {
  const { user, auth } = await registerUser();

  const forged = jwt.sign({ sub: user._id }, 'some-other-secret-that-is-long-enough-to-sign');
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);

  const expired = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: -10 });
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
  assert.match(res.body.message, /expired/);

  await User.deleteMany({});
  await request(app).get('/api/auth/me').set('Authorization', auth).expect(401);
});

test('PATCH /me updates the currency and validates it', async () => {
  const { auth } = await registerUser();
  const res = await request(app).patch('/api/auth/me').set('Authorization', auth).send({ currency: 'USD' }).expect(200);
  assert.equal(res.body.user.currency, 'USD');
  await request(app).patch('/api/auth/me').set('Authorization', auth).send({ currency: 'EUR' }).expect(400);
});

test('rate limiter blocks after 20 failed logins but never counts successful ones', async () => {
  await registerUser();
  process.env.NODE_ENV = 'development'; // the limiter is switched off in tests; turn it on here
  try {
    for (let i = 0; i < 25; i++) {
      await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'secret123' }).expect(200);
    }
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong-guess' }).expect(401);
    }
    const blocked = await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong-guess' }).expect(429);
    assert.match(blocked.body.message, /Too many attempts/);
  } finally {
    process.env.NODE_ENV = 'test';
  }
});
