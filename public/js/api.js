// All communication with the backend goes through this file.
//
// After login the server returns a JWT. We keep it in localStorage and send it with every
// request in the "Authorization: Bearer <token>" header. If the server ever answers 401
// (token missing, expired or invalid) we forget the token and send the user to the login page.
const API_BASE = '/api';
const TOKEN_KEY = 'expense-tracker-token';

const auth = {
  getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* private mode: login lasts for this page only */ }
  },
  clear() {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  },
  logout(reason) {
    auth.clear();
    location.replace('/login' + (reason ? `?reason=${encodeURIComponent(reason)}` : ''));
  },
};

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  // Session ended: go back to login (but not for a failed login attempt itself)
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    auth.logout('expired');
    throw Object.assign(new Error('Session expired'), { status: 401, errors: {} });
  }

  if (raw && res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Carry the server's message and per-field errors so the UI can show them
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = data.errors || {};
    throw err;
  }
  return data;
}

const query = (params) => {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  return new URLSearchParams(clean).toString();
};

const api = {
  // Auth
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),
  updateMe: (data) => request('/auth/me', { method: 'PATCH', body: data }),

  // Categories and currencies
  meta: () => request('/meta'),

  // Transactions
  listTransactions: (params) => request('/transactions?' + query(params)),
  getTransaction: (id) => request(`/transactions/${id}`),
  createTransaction: (data) => request('/transactions', { method: 'POST', body: data }),
  updateTransaction: (id, data) => request(`/transactions/${id}`, { method: 'PUT', body: data }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  // Reports
  summary: (month) => request('/reports/summary?' + query({ month })),
  exportCsv: async (month) => {
    const res = await request('/reports/export?' + query({ month }), { raw: true });
    return res.blob();
  },
};
