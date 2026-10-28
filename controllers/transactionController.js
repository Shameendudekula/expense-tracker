const Transaction = require('../models/Transaction');
const { CATEGORIES, TYPES } = require('../config/constants');
const { monthRange } = require('../utils/dates');

// Only these fields can be set from a request body. "user" is always taken from the token,
// so nobody can create or move a transaction into another user's account.
const EDITABLE_FIELDS = ['type', 'amount', 'category', 'description', 'date'];

function pickEditable(body = {}) {
  const data = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) data[field] = body[field];
  }
  return data;
}

const firstValue = (v) => (Array.isArray(v) ? v[0] : v);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const round2 = (n) => Math.round(n * 100) / 100;

// Builds the MongoDB filter from the query string. Always starts with { user }.
// Returns { error } for invalid input so the route can answer 400.
function buildFilter(userId, query) {
  const filter = { user: userId };
  const month = firstValue(query.month);
  const type = firstValue(query.type);
  const category = firstValue(query.category);
  const search = String(firstValue(query.search) ?? '').trim();

  if (month) {
    const range = monthRange(month);
    if (!range) return { error: 'Month must be in the format YYYY-MM' };
    filter.date = { $gte: range.start, $lt: range.end };
  }
  if (type) {
    if (!TYPES.includes(type)) return { error: 'Type must be income or expense' };
    filter.type = type;
  }
  if (category) {
    const all = [...new Set([...CATEGORIES.income, ...CATEGORIES.expense])];
    if (!all.includes(category)) return { error: `Unknown category "${category}"` };
    filter.category = category;
  }
  if (search) filter.description = new RegExp(escapeRegex(search), 'i');
  return { filter };
}

// GET /api/transactions?month=YYYY-MM&type=&category=&search=&page=&limit=
exports.getTransactions = async (req, res) => {
  const { filter, error } = buildFilter(req.user._id, req.query);
  if (error) return res.status(400).json({ message: error });

  const page = Math.max(1, parseInt(firstValue(req.query.page), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(firstValue(req.query.limit), 10) || 20));

  const [transactions, total, sums] = await Promise.all([
    // Newest first; _id breaks ties so pages never repeat or skip records
    Transaction.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments(filter),
    // Income and expense totals for everything matching the filters (not just this page)
    Transaction.aggregate([{ $match: filter }, { $group: { _id: '$type', total: { $sum: '$amount' } } }]),
  ]);

  const totals = { income: 0, expense: 0 };
  for (const s of sums) totals[s._id] = round2(s.total);

  res.json({
    data: transactions,
    totals: { ...totals, balance: round2(totals.income - totals.expense) },
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
};

// GET /api/transactions/:id
exports.getTransaction = async (req, res) => {
  // Filtering on both _id and user means another user's id simply returns 404
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });
  res.json({ data: tx });
};

// POST /api/transactions
exports.createTransaction = async (req, res) => {
  const tx = await Transaction.create({ ...pickEditable(req.body), user: req.user._id });
  res.status(201).json({ message: 'Transaction added', data: tx });
};

// PUT /api/transactions/:id
exports.updateTransaction = async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });

  // Assign then save() so every validator runs, including "category must match type"
  tx.set(pickEditable(req.body));
  await tx.save();
  res.json({ message: 'Transaction updated', data: tx });
};

// DELETE /api/transactions/:id
exports.deleteTransaction = async (req, res) => {
  const tx = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!tx) return res.status(404).json({ message: 'Transaction not found' });
  res.json({ message: 'Transaction deleted', data: { _id: tx._id } });
};
