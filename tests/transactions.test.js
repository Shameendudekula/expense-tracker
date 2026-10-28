const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setupDatabase, registerUser, Transaction } = require('./helpers');

setupDatabase();

const tx = (overrides = {}) => ({ type: 'expense', amount: 250, category: 'Food', description: 'Groceries', date: '2026-09-15', ...overrides });

test('transaction routes require a token', async () => {
  await request(app).get('/api/transactions').expect(401);
  await request(app).post('/api/transactions').send(tx()).expect(401);
});

test('create (201) stores the transaction for the logged-in user, rounding the amount', async () => {
  const { auth, user } = await registerUser();
  const res = await request(app).post('/api/transactions').set('Authorization', auth).send(tx({ amount: '10.005' })).expect(201);
  assert.equal(res.body.data.amount, 10.01);
  const tricky = await request(app).post('/api/transactions').set('Authorization', auth).send(tx({ amount: 1.005 })).expect(201);
  assert.equal(tricky.body.data.amount, 1.01);
  assert.equal(res.body.data.user, user._id);
  assert.equal(res.body.data.date, '2026-09-15T00:00:00.000Z');
});

test('the owner always comes from the token, never from the request body', async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  const res = await request(app).post('/api/transactions').set('Authorization', a.auth).send(tx({ user: b.user._id })).expect(201);
  assert.equal(res.body.data.user, a.user._id);
});

test('create validates fields (400), including that the category matches the type', async () => {
  const { auth } = await registerUser();
  const bad = await request(app)
    .post('/api/transactions')
    .set('Authorization', auth)
    .send({ type: 'gift', amount: -5, category: '', date: 'not-a-date', description: 'x'.repeat(200) })
    .expect(400);
  for (const f of ['type', 'amount', 'category', 'date', 'description']) assert.ok(bad.body.errors[f], `error for ${f}`);

  const mismatch = await request(app).post('/api/transactions').set('Authorization', auth).send(tx({ type: 'income', category: 'Food' })).expect(400);
  assert.match(mismatch.body.errors.category, /not a valid category/);

  await request(app).post('/api/transactions').set('Authorization', auth).send(tx({ date: '2999-01-01' })).expect(400);
  await request(app).post('/api/transactions').set('Authorization', auth).send(tx({ amount: 'abc' })).expect(400);
});

test('list filters by month, type, category and search, and returns totals for the filtered set', async () => {
  const { auth, user } = await registerUser();
  await Transaction.create([
    { ...tx({ amount: 30000, type: 'income', category: 'Salary', description: 'September salary', date: '2026-09-01' }), user: user._id },
    { ...tx({ amount: 100, description: 'Pizza night', date: '2026-09-20' }), user: user._id },
    { ...tx({ amount: 900, category: 'Rent', description: 'Rent', date: '2026-09-30' }), user: user._id },
    { ...tx({ amount: 50, description: 'Coffee', date: '2026-10-01' }), user: user._id },
  ]);

  let res = await request(app).get('/api/transactions?month=2026-09').set('Authorization', auth).expect(200);
  assert.equal(res.body.pagination.total, 3);
  assert.deepEqual(res.body.totals, { income: 30000, expense: 1000, balance: 29000 });
  assert.deepEqual(res.body.data.map((t) => t.description), ['Rent', 'Pizza night', 'September salary'], 'newest first');

  res = await request(app).get('/api/transactions?type=expense').set('Authorization', auth).expect(200);
  assert.equal(res.body.pagination.total, 3);

  res = await request(app).get('/api/transactions?category=Food&month=2026-09').set('Authorization', auth).expect(200);
  assert.equal(res.body.data.length, 1);

  res = await request(app).get('/api/transactions?search=PIZZA').set('Authorization', auth).expect(200);
  assert.equal(res.body.data[0].description, 'Pizza night');

  res = await request(app).get('/api/transactions?search=.*').set('Authorization', auth).expect(200);
  assert.equal(res.body.data.length, 0, 'regex characters are matched literally');

  await request(app).get('/api/transactions?month=2026-13').set('Authorization', auth).expect(400);
  await request(app).get('/api/transactions?type=gift').set('Authorization', auth).expect(400);
  await request(app).get('/api/transactions?category=Nope').set('Authorization', auth).expect(400);
});

test('pagination returns every transaction exactly once', async () => {
  const { auth, user } = await registerUser();
  await Transaction.create(Array.from({ length: 25 }, (_, i) => ({ ...tx({ amount: i + 1, description: `T${i}`, date: '2026-09-10' }), user: user._id })));
  const seen = [];
  for (const page of [1, 2, 3]) {
    const res = await request(app).get(`/api/transactions?limit=10&page=${page}`).set('Authorization', auth).expect(200);
    seen.push(...res.body.data.map((t) => t.description));
    assert.equal(res.body.pagination.totalPages, 3);
  }
  assert.equal(new Set(seen).size, 25);
});

test('get, update and delete a transaction', async () => {
  const { auth } = await registerUser();
  const { body } = await request(app).post('/api/transactions').set('Authorization', auth).send(tx()).expect(201);
  const id = body.data._id;

  await request(app).get(`/api/transactions/${id}`).set('Authorization', auth).expect(200);

  const upd = await request(app).put(`/api/transactions/${id}`).set('Authorization', auth).send({ amount: 300, description: 'Big shop' }).expect(200);
  assert.equal(upd.body.data.amount, 300);
  assert.equal(upd.body.data.category, 'Food');

  // Changing the type without a matching category is rejected
  await request(app).put(`/api/transactions/${id}`).set('Authorization', auth).send({ type: 'income' }).expect(400);
  await request(app).put(`/api/transactions/${id}`).set('Authorization', auth).send({ type: 'income', category: 'Salary' }).expect(200);

  await request(app).delete(`/api/transactions/${id}`).set('Authorization', auth).expect(200);
  await request(app).delete(`/api/transactions/${id}`).set('Authorization', auth).expect(404);
  await request(app).get('/api/transactions/abc').set('Authorization', auth).expect(400);
});

test("users can't see, change or delete each other's transactions", async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  const { body } = await request(app).post('/api/transactions').set('Authorization', a.auth).send(tx()).expect(201);
  const id = body.data._id;

  const list = await request(app).get('/api/transactions').set('Authorization', b.auth).expect(200);
  assert.equal(list.body.data.length, 0);
  await request(app).get(`/api/transactions/${id}`).set('Authorization', b.auth).expect(404);
  await request(app).put(`/api/transactions/${id}`).set('Authorization', b.auth).send({ amount: 1 }).expect(404);
  await request(app).delete(`/api/transactions/${id}`).set('Authorization', b.auth).expect(404);

  const still = await request(app).get(`/api/transactions/${id}`).set('Authorization', a.auth).expect(200);
  assert.equal(still.body.data.amount, 250);
});
