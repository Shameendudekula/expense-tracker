// Single source of truth for categories and currencies. The frontend loads these from GET /api/meta
// so the dropdowns and the database validation can never drift apart.
const EXPENSE_CATEGORIES = ['Food', 'Rent', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Other'];
const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Other'];

const CATEGORIES = {
  expense: EXPENSE_CATEGORIES,
  income: INCOME_CATEGORIES,
};

const TYPES = ['income', 'expense'];
const CURRENCIES = ['SEK', 'INR', 'USD'];

module.exports = { CATEGORIES, TYPES, CURRENCIES };
