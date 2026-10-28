// Generates ~3 months of realistic transactions (two full months + the current month up to today).
// A fixed random seed makes the data the same every time you run the seed.

const DEMO_USER = { name: 'Demo User', email: 'demo@example.com', password: 'demo1234', currency: 'INR' };

// Small deterministic pseudo-random generator (mulberry32)
function makeRandom(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateTransactions(today = new Date()) {
  const rand = makeRandom(20261105);
  const between = (min, max) => Math.round((min + rand() * (max - min)) / 10) * 10; // round to 10
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const txs = [];

  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  for (let offset = 2; offset >= 0; offset--) {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth() - offset;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const add = (day, type, category, amount, description) => {
      const date = new Date(Date.UTC(year, month, Math.min(day, daysInMonth)));
      if (date.getTime() <= todayUtc) txs.push({ type, category, amount, description, date });
    };

    // Income
    add(1, 'income', 'Salary', 65000, 'Monthly salary');
    for (let i = 0, n = 1 + Math.floor(rand() * 2); i < n; i++) {
      add(5 + Math.floor(rand() * 22), 'income', 'Freelance', between(4000, 15000), pick(['Website project', 'Logo design', 'Freelance bug fixes', 'Landing page build']));
    }

    // Fixed monthly costs
    add(2, 'expense', 'Rent', 15000, 'Apartment rent');
    add(5, 'expense', 'Bills', between(1100, 2200), 'Electricity bill');
    add(8, 'expense', 'Bills', 799, 'Internet');
    add(10, 'expense', 'Bills', 399, 'Mobile recharge');
    add(15, 'expense', 'Entertainment', 649, 'Netflix subscription');

    // Weekly groceries
    for (const day of [3, 10, 17, 24]) add(day, 'expense', 'Food', between(1400, 3200), pick(['Weekly groceries', 'Supermarket', 'Vegetables and fruit']));

    // Day-to-day spending
    for (let i = 0; i < 9; i++) add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Food', between(150, 900), pick(['Lunch with friends', 'Coffee', 'Dinner out', 'Swiggy order', 'Bakery']));
    for (let i = 0; i < 10; i++) add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Transport', between(40, 450), pick(['Metro card top-up', 'Auto ride', 'Uber', 'Fuel', 'Bus pass']));
    for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Shopping', between(700, 4200), pick(['Clothes', 'Headphones', 'Shoes', 'Books', 'Home supplies']));
    for (let i = 0, n = Math.floor(rand() * 3); i < n; i++) add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Health', between(250, 1600), pick(['Pharmacy', 'Doctor visit', 'Gym membership']));
    for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Entertainment', between(200, 900), pick(['Movie tickets', 'Concert', 'Bowling', 'Game purchase']));
    add(1 + Math.floor(rand() * daysInMonth), 'expense', 'Other', between(100, 1200), pick(['Gift for a friend', 'Donation', 'Haircut', 'Stationery']));
  }

  return txs.sort((a, b) => a.date - b.date);
}

module.exports = { DEMO_USER, generateTransactions };
