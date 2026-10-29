# Expense Tracker

A full-stack web application for tracking income and expenses. Users create an account, record transactions, see where their money goes on a dashboard with charts, and export monthly reports. Built with **Node.js, Express, MongoDB (Mongoose)**, **JWT authentication** and a **plain HTML/CSS/JavaScript** frontend with **Chart.js**.

🔗 **Live demo:** https://expense-tracker-e0ck.onrender.com (free Render instance – the first request after inactivity can take ~50 seconds)
💻 **Source:** https://github.com/Shameendudekula/expense-tracker

### Demo login

| Email | Password |
|-------|----------|
| `demo@example.com` | `demo1234` |

The demo account has about 3 months of realistic sample transactions. You can also create your own account.

---

## ✨ Features

**Authentication & security**
- Register and log in with email and password
- Passwords hashed with **bcrypt** (cost 12), never stored or returned in plain text
- Stateless sessions with **JSON Web Tokens** (7-day expiry)
- Auth middleware protects every transaction and report route
- **Each user only ever sees their own data**: every query is scoped to the logged-in user, and other users' records return 404
- Login rate limiting (20 failed attempts per 15 minutes per IP)
- Same error message for "wrong email" and "wrong password", so attackers can't find out which emails have accounts
- Formula-injection protection in CSV exports, and every value is escaped before display (XSS)

**Transactions**
- Full CRUD for income and expense transactions: amount, category, description, date
- Categories depend on the type (e.g. *Salary* is income only, *Rent* is expense only)
- Filter by month, type and category, search descriptions, and paginate
- Totals (income / expenses / net) for whatever is currently filtered

**Dashboard**
- Stat cards: income, expenses, balance and savings rate for the selected month
- Doughnut chart of expenses by category with amounts and percentages
- Bar chart of income vs expenses for the last 6 months
- Recent transactions

**Reports**
- Month picker with a category breakdown table for expenses and for income
- **Export to CSV** (opens correctly in Excel, Numbers and Google Sheets)

**General**
- Currency setting per user: **INR, SEK or USD**, used for all amounts
- Validation in the browser plus the server's error messages shown next to each field
- Toast notifications plus loading, empty and error states
- Fully responsive: on phones, tables turn into cards and the charts stack

---

## 🛠 Tech Stack

| Layer | Technology |
|------|------------|
| Backend | Node.js, Express 5 |
| Database | MongoDB Atlas, Mongoose 9 (aggregation pipelines) |
| Auth | bcryptjs, jsonwebtoken, express-rate-limit |
| Frontend | HTML5, CSS3, vanilla JavaScript (Fetch API), Chart.js 4, native `<dialog>` modals |
| Testing | Node.js test runner, Supertest, mongodb-memory-server, Puppeteer (UI) |
| Deployment | Render (one Web Service serves the API and the frontend) |

---

## 🧠 How it works

### JWT authentication

1. **Register / login:** the server checks the password with `bcrypt.compare()` against the stored hash, then signs a JWT whose payload is just the user's id: `jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' })`.
2. **The browser** stores the token and sends it with every API request as `Authorization: Bearer <token>`.
3. **The auth middleware** (`middleware/auth.js`) runs before every protected route:
   - reads the header and verifies the token's signature and expiry with `jwt.verify()`. A forged or expired token gives 401.
   - loads the user from the database, so a token for a deleted account stops working.
   - attaches the user as `req.user`.
4. **The controllers** always filter by `req.user._id`, e.g. `Transaction.findOne({ _id: id, user: req.user._id })`. Another user's transaction id simply isn't found (404). The owner is always taken from the token, never from the request body.
5. **On a 401** the frontend deletes the token and returns to the login page.

The server is stateless: it doesn't store sessions. The signature, made with `JWT_SECRET`, is what proves the token is genuine, so the server refuses to start without a secret of at least 32 characters.

### Report aggregation (`controllers/reportController.js`)

`GET /api/reports/summary?month=2026-10` runs **one aggregation pipeline**:

```js
Transaction.aggregate([
  // 1. Only this user's transactions in the 6-month window
  { $match: { user: req.user._id, date: { $gte: sixMonthsAgo, $lt: endOfMonth } } },
  // 2. Three sub-reports over the same documents, in parallel
  { $facet: {
      totals:     [{ $match: thisMonth }, { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }],
      byCategory: [{ $match: thisMonth }, { $group: { _id: { type: '$type', category: '$category' }, total: { $sum: '$amount' } } }, { $sort: { total: -1 } }],
      trend:      [{ $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' }, total: { $sum: '$amount' } } }],
  } },
]);
```

- `$match` filters first, so the later stages only see the relevant documents. The index on `{ user, date }` makes this fast.
- `$group` adds up the amounts per type, per category, and per month.
- `$facet` runs the three groupings in one database round trip.
- Months with no transactions don't appear in the `$group` output, so the controller fills them in with 0. The trend chart therefore always has 6 bars.
- Note: unlike `find()`, `aggregate()` doesn't convert string ids to ObjectIds. That's why `req.user._id` (already an ObjectId) is used in `$match`.

---

## 📁 Project Structure

```
expense-tracker/
├── server.js                    # Entry point: checks JWT_SECRET, connects to MongoDB, starts the server
├── app.js                       # Express app: middleware, routes, static frontend, error handler
├── config/
│   ├── db.js                    # MongoDB connection
│   └── constants.js             # Categories per type and currencies
├── models/
│   ├── User.js                  # User schema, bcrypt hashing hook, password never returned
│   └── Transaction.js           # Transaction schema, category-matches-type validation, money rounding
├── controllers/
│   ├── authController.js        # register, login, me, update settings
│   ├── transactionController.js # CRUD + filters, pagination, filtered totals
│   └── reportController.js      # summary aggregation and CSV export
├── routes/                      # authRoutes, transactionRoutes, reportRoutes
├── middleware/
│   ├── auth.js                  # JWT check -> req.user
│   ├── validateObjectId.js      # 400 for malformed ids
│   └── errorHandler.js          # Maps errors to 400 / 401 / 404 / 409 / 500
├── utils/
│   ├── token.js                 # sign / verify JWTs
│   └── dates.js                 # month ranges in UTC
├── public/                      # Frontend served by Express
│   ├── login.html, index.html (dashboard), transactions.html, reports.html
│   ├── css/styles.css
│   └── js/
│       ├── api.js               # fetch wrapper: adds the token, handles 401
│       ├── common.js            # navigation, currency formatting, toasts, category colours
│       ├── tx-modal.js          # shared add/edit modal and delete confirmation
│       └── login.js, dashboard.js, transactions.js, reports.js
├── seed/
│   ├── sampleData.js            # demo user + ~3 months of generated transactions
│   ├── seed.js                  # npm run seed
│   └── demo.js                  # npm run demo – in-memory database, no Atlas needed
├── tests/                       # 24 API tests (auth, transactions, reports)
├── .env.example
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20 or newer
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster

### Setup

```bash
git clone https://github.com/Shameendudekula/expense-tracker.git
cd expense-tracker
npm install
cp .env.example .env     # then fill in MONGO_URI and JWT_SECRET (see below)
npm run seed             # creates the demo user with sample data
npm run dev              # http://localhost:5050
```

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> In MongoDB Atlas → **Network Access**, allow your IP address (or `0.0.0.0/0` for Render).

### Try it without MongoDB Atlas

```bash
npm run demo
```

Runs the whole app on http://localhost:5050 with a temporary in-memory database and the demo user. Data is lost when you stop it.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm start` | Start the server (production) |
| `npm run dev` | Start with nodemon (restarts on file changes) |
| `npm run seed` | Create/reset the demo user and its transactions (other users are not touched) |
| `npm run demo` | Run the app with an in-memory database and demo data |
| `npm test` | Run the API tests (in-memory database, never touches Atlas) |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string with the database name `expense-tracker`. URL-encode special characters in the password (`@` → `%40`) |
| `JWT_SECRET` | ✅ | Random string of at least 32 characters used to sign login tokens |
| `JWT_EXPIRES_IN` | – | Token lifetime, default `7d` |
| `PORT` | – | Default `5050`; Render sets this automatically |
| `NODE_ENV` | – | `production` hides internal error details from responses |
| `CLIENT_URL` | – | Allowed CORS origin(s), only needed if the frontend is hosted elsewhere |

---

## 📡 API Endpoints

Base URL: `/api`. 🔒 = requires `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Success | Errors |
|--------|----------|-------------|---------|--------|
| GET | `/health` | Server and database status | 200 | – |
| GET | `/meta` | Categories per type and currencies | 200 | – |
| POST | `/auth/register` | Create an account → `{ token, user }` | 201 | 400, 409, 429 |
| POST | `/auth/login` | Log in → `{ token, user }` | 200 | 400, 401, 429 |
| GET | `/auth/me` 🔒 | The logged-in user | 200 | 401 |
| PATCH | `/auth/me` 🔒 | Update name / currency | 200 | 400, 401 |
| GET | `/transactions` 🔒 | List with filters, pagination and totals | 200 | 400, 401 |
| POST | `/transactions` 🔒 | Create a transaction | 201 | 400, 401 |
| GET | `/transactions/:id` 🔒 | Get one transaction | 200 | 400, 401, 404 |
| PUT | `/transactions/:id` 🔒 | Update a transaction | 200 | 400, 401, 404 |
| DELETE | `/transactions/:id` 🔒 | Delete a transaction | 200 | 400, 401, 404 |
| GET | `/reports/summary?month=YYYY-MM` 🔒 | Totals, category breakdown, 6-month trend | 200 | 400, 401 |
| GET | `/reports/export?month=YYYY-MM` 🔒 | Month's transactions as CSV | 200 | 400, 401 |

**Query parameters for `GET /transactions`**: `month=2026-10`, `type=income|expense`, `category=Food`, `search=coffee`, `page=1`, `limit=20` (max 100).

**Example**

```bash
# Log in and keep the token
TOKEN=$(curl -s -X POST http://localhost:5050/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# Add an expense
curl -X POST http://localhost:5050/api/transactions \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"expense","amount":250,"category":"Food","description":"Groceries","date":"2026-10-20"}'

# Monthly summary
curl -H "Authorization: Bearer $TOKEN" "http://localhost:5050/api/reports/summary?month=2026-10"
```

**Example summary response**

```json
{
  "month": "2026-10", "currency": "INR",
  "income": 76910, "expenses": 45157, "balance": 31753,
  "counts": { "income": 2, "expense": 33 },
  "byCategory": [{ "type": "expense", "category": "Rent", "total": 15000, "count": 1, "percent": 33.2 }],
  "trend": [{ "month": "2026-05", "income": 0, "expense": 0 }, { "month": "2026-10", "income": 76910, "expense": 45157 }]
}
```

---

## 🧪 Testing

```bash
npm test
```

24 API tests cover:
- **Auth:** hashing, validation, duplicate email, login errors, forged/expired tokens, deleted users, rate limiting
- **Transactions:** CRUD, validation, filters, search, pagination with no repeats, money rounding, and that users can't read, change or delete each other's data
- **Reports:** exact totals, category percentages, the 6-month trend including a year boundary, user isolation, CSV quoting and formula-injection protection

The UI was tested end-to-end in Chrome at 1280px and 375px: register, login, logout, dashboard charts, add/edit/delete, filters, search, pagination, reports, CSV download, currency switching and tampered-token handling.

---

## ☁️ Deployment (Render)

1. In MongoDB Atlas → **Network Access**, make sure `0.0.0.0/0` is allowed.
2. On [Render](https://render.com) → **New → Web Service** → connect this repo.
3. Settings: **Region** Frankfurt, **Build** `npm install`, **Start** `npm start`, **Instance** Free, **Health Check Path** `/api/health`.
4. Environment variables: `MONGO_URI`, `JWT_SECRET` (a new random one, not the one from your laptop), `NODE_ENV=production`.
5. Deploy. Then run `npm run seed` locally against the same `MONGO_URI` to create the demo user.

> The free Render instance sleeps after inactivity, so the first request can take ~50 seconds.

---

## 📸 Screenshots

> _Screenshots coming soon._

| View | Screenshot |
|------|-----------|
| Login / register | `![Login](screenshots/login.png)` |
| Dashboard | `![Dashboard](screenshots/dashboard.png)` |
| Transactions | `![Transactions](screenshots/transactions.png)` |
| Add / edit transaction | `![Form](screenshots/form.png)` |
| Reports | `![Reports](screenshots/reports.png)` |
| Mobile | `![Mobile](screenshots/mobile.png)` |

---

## 👩‍💻 Author

**Shameen Dudekula** · [Portfolio](https://portfolio-shameen.vercel.app) · [GitHub](https://github.com/Shameendudekula) · [LinkedIn](https://linkedin.com/in/shameen-d)
