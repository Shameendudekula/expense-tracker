const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setupDatabase, registerUser, Transaction } = require('./helpers');

setupDatabase();

async function seedFor(userId) {
  const t = (type, amount, category, date, description = '') => ({ user: userId, type, amount, category, date, description });
  await Transaction.create([
    // June 2026 (inside the 6-month window for October)
    t('income', 1000, 'Salary', '2026-06-01'),
    // August 2026
    t('income', 30000, 'Salary', '2026-08-01'),
    t('expense', 8000, 'Rent', '2026-08-02'),
    // September 2026 (the month we report on)
    t('income', 30000, 'Salary', '2026-09-01'),
    t('income', 5000.5, 'Freelance', '2026-09-12'),
    t('expense', 8000, 'Rent', '2026-09-02'),
    t('expense', 1200.25, 'Food', '2026-09-10'),
    t('expense', 799.75, 'Food', '2026-09-30'),
    // October 2026 and April 2026 must not count for September's totals
    t('expense', 999, 'Food', '2026-10-01'),
    t('expense', 555, 'Food', '2026-03-31'),
  ]);
}

test('report routes require a token', async () => {
  await request(app).get('/api/reports/summary').expect(401);
  await request(app).get('/api/reports/export').expect(401);
});

test('summary returns month totals, balance and category breakdown', async () => {
  const { auth, user } = await registerUser({ currency: 'SEK' });
  await seedFor(user._id);

  const res = await request(app).get('/api/reports/summary?month=2026-09').set('Authorization', auth).expect(200);
  const s = res.body;
  assert.equal(s.month, '2026-09');
  assert.equal(s.currency, 'SEK');
  assert.equal(s.income, 35000.5);
  assert.equal(s.expenses, 10000);
  assert.equal(s.balance, 25000.5);
  assert.deepEqual(s.counts, { income: 2, expense: 3 });

  const expense = s.byCategory.filter((c) => c.type === 'expense');
  assert.deepEqual(expense, [
    { type: 'expense', category: 'Rent', total: 8000, count: 1, percent: 80 },
    { type: 'expense', category: 'Food', total: 2000, count: 2, percent: 20 },
  ]);
  const freelance = s.byCategory.find((c) => c.category === 'Freelance');
  assert.equal(freelance.percent, 14.3);
});

test('trend covers the last 6 months, oldest first, with zeros for empty months', async () => {
  const { auth, user } = await registerUser();
  await seedFor(user._id);
  const { body } = await request(app).get('/api/reports/summary?month=2026-09').set('Authorization', auth).expect(200);
  assert.deepEqual(body.trend, [
    { month: '2026-04', income: 0, expense: 0 },
    { month: '2026-05', income: 0, expense: 0 },
    { month: '2026-06', income: 1000, expense: 0 },
    { month: '2026-07', income: 0, expense: 0 },
    { month: '2026-08', income: 30000, expense: 8000 },
    { month: '2026-09', income: 35000.5, expense: 10000 },
  ]);
});

test('trend handles a window that crosses a year boundary', async () => {
  const { auth } = await registerUser();
  const { body } = await request(app).get('/api/reports/summary?month=2026-02').set('Authorization', auth).expect(200);
  assert.deepEqual(body.trend.map((r) => r.month), ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
});

test("summary only includes the logged-in user's data", async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  await seedFor(a.user._id);
  const { body } = await request(app).get('/api/reports/summary?month=2026-09').set('Authorization', b.auth).expect(200);
  assert.equal(body.income, 0);
  assert.equal(body.expenses, 0);
  assert.deepEqual(body.byCategory, []);
});

test('summary defaults to the current month and rejects a malformed month', async () => {
  const { auth } = await registerUser();
  const { body } = await request(app).get('/api/reports/summary').set('Authorization', auth).expect(200);
  assert.equal(body.month, new Date().toISOString().slice(0, 7));
  await request(app).get('/api/reports/summary?month=2026-9').set('Authorization', auth).expect(400);
});

test('CSV export lists the month with proper quoting and formula-injection protection', async () => {
  const { auth, user } = await registerUser({ currency: 'INR' });
  await Transaction.create([
    { user: user._id, type: 'expense', amount: 120, category: 'Food', date: '2026-09-02', description: 'Lunch, with "friends"' },
    { user: user._id, type: 'expense', amount: 50, category: 'Other', date: '2026-09-01', description: '=HYPERLINK("http://evil")' },
    { user: user._id, type: 'expense', amount: 75, category: 'Food', date: '2026-10-01', description: 'Next month' },
  ]);

  const res = await request(app).get('/api/reports/export?month=2026-09').set('Authorization', auth).expect(200);
  assert.match(res.headers['content-type'], /text\/csv/);
  assert.match(res.headers['content-disposition'], /transactions-2026-09\.csv/);

  const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines.length, 3, 'header + 2 rows (October excluded)');
  assert.equal(lines[0], '"Date","Type","Category","Description","Amount (INR)"');
  assert.equal(lines[1], `"2026-09-01","expense","Other","'=HYPERLINK(""http://evil"")","50.00"`);
  assert.equal(lines[2], '"2026-09-02","expense","Food","Lunch, with ""friends""","120.00"');
});
