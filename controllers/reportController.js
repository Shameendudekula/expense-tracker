const Transaction = require('../models/Transaction');
const { monthRange, currentMonth, lastMonths } = require('../utils/dates');

const round2 = (n) => Math.round(n * 100) / 100;
const firstValue = (v) => (Array.isArray(v) ? v[0] : v);

// GET /api/reports/summary?month=YYYY-MM  (defaults to the current month)
//
// One aggregation pipeline produces everything the dashboard needs:
//   1. $match  – keep only this user's transactions from the 6-month window
//   2. $facet  – run three sub-pipelines over those same documents in parallel:
//        totals     – income and expense sums for the selected month
//        byCategory – sums per (type, category) for the selected month
//        trend      – sums per (year, month, type) for all 6 months
exports.getSummary = async (req, res) => {
  const month = firstValue(req.query.month) || currentMonth();
  const range = monthRange(month);
  if (!range) return res.status(400).json({ message: 'Month must be in the format YYYY-MM' });

  const months = lastMonths(month, 6);
  const windowStart = monthRange(months[0]).start;
  const inSelectedMonth = { date: { $gte: range.start, $lt: range.end } };

  const [result] = await Transaction.aggregate([
    // req.user._id is already an ObjectId. (aggregate() does not convert strings to ObjectIds
    // the way find() does, so passing a string id here would silently match nothing.)
    { $match: { user: req.user._id, date: { $gte: windowStart, $lt: range.end } } },
    {
      $facet: {
        totals: [
          { $match: inSelectedMonth },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ],
        byCategory: [
          { $match: inSelectedMonth },
          { $group: { _id: { type: '$type', category: '$category' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          { $sort: { total: -1 } },
        ],
        trend: [
          {
            $group: {
              _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
              total: { $sum: '$amount' },
            },
          },
        ],
      },
    },
  ]);

  // Shape the raw aggregation output for the frontend
  const totals = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
  for (const t of result.totals) {
    totals[t._id] = round2(t.total);
    totals[`${t._id}Count`] = t.count;
  }

  const byCategory = result.byCategory.map((c) => ({
    type: c._id.type,
    category: c._id.category,
    total: round2(c.total),
    count: c.count,
    // Share of that type's total for the month, e.g. Food = 32% of expenses
    percent: totals[c._id.type] ? Math.round((c.total / totals[c._id.type]) * 1000) / 10 : 0,
  }));

  // Months with no transactions are missing from the aggregation, so start every month at 0
  const trend = months.map((m) => ({ month: m, income: 0, expense: 0 }));
  for (const t of result.trend) {
    const key = `${t._id.year}-${String(t._id.month).padStart(2, '0')}`;
    const row = trend.find((r) => r.month === key);
    if (row) row[t._id.type] = round2(t.total);
  }

  res.json({
    month,
    currency: req.user.currency,
    income: totals.income,
    expenses: totals.expense,
    balance: round2(totals.income - totals.expense),
    counts: { income: totals.incomeCount, expense: totals.expenseCount },
    byCategory,
    trend,
  });
};

// Spreadsheet apps run cells starting with = + - @ as formulas ("CSV injection"),
// so those get a leading apostrophe. Quotes are doubled and every field is quoted.
function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /api/reports/export?month=YYYY-MM – the month's transactions as a CSV file
exports.exportCsv = async (req, res) => {
  const month = firstValue(req.query.month) || currentMonth();
  const range = monthRange(month);
  if (!range) return res.status(400).json({ message: 'Month must be in the format YYYY-MM' });

  const rows = await Transaction.find({ user: req.user._id, date: { $gte: range.start, $lt: range.end } })
    .sort({ date: 1, _id: 1 })
    .lean();

  const header = ['Date', 'Type', 'Category', 'Description', `Amount (${req.user.currency})`];
  const lines = [header, ...rows.map((t) => [t.date.toISOString().slice(0, 10), t.type, t.category, t.description, t.amount.toFixed(2)])];
  // BOM so Excel opens UTF-8 (e.g. "₹" or "å") correctly
  const csv = '﻿' + lines.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="transactions-${month}.csv"`);
  res.send(csv);
};
