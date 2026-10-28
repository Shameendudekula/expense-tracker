// Shared helpers and the page shell (top navigation) used by every logged-in page.

// ---------- Formatting ----------
// Escape user-entered text before putting it into HTML (prevents XSS)
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CURRENCY_LOCALES = { INR: 'en-IN', SEK: 'sv-SE', USD: 'en-US' };

function formatMoney(amount, currency = appState.user?.currency || 'INR', options = {}) {
  return new Intl.NumberFormat(CURRENCY_LOCALES[currency] || 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

// Short form for chart axes: ₹45K, 1,2 tn kr, $3.4K
const formatMoneyShort = (amount) => formatMoney(amount, undefined, { notation: 'compact', maximumFractionDigits: 1 });

// Dates are stored as UTC midnight; format in UTC so the day never shifts
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// "2026-10" -> "Oct 2026" (or "Oct" with short = true)
function monthLabel(month, short = false) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: short ? undefined : 'numeric', timeZone: 'UTC' });
}

// Today / this month in the user's own time zone (toISOString() would give the UTC date,
// which is "yesterday" just after midnight in Sweden or India)
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const currentMonth = () => today().slice(0, 7);

const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// ---------- Category colours ----------
// Each category always gets the same colour (colour follows the category, never its rank),
// taken in a fixed order from a colour-blind-checked categorical palette.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const CATEGORY_COLORS = {
  expense: { Food: PALETTE[0], Rent: PALETTE[1], Transport: PALETTE[2], Shopping: PALETTE[3], Bills: PALETTE[4], Health: PALETTE[5], Entertainment: PALETTE[6], Other: PALETTE[7] },
  income: { Salary: PALETTE[0], Freelance: PALETTE[2], Other: PALETTE[7] },
};
const categoryColor = (type, category) => CATEGORY_COLORS[type]?.[category] || '#94a3b8';

// ---------- Toasts ----------
function toast(message, type = 'success') {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 300); }, 3500);
}

// ---------- Loading / empty / error blocks ----------
function stateHtml(kind, { title, text, action } = {}) {
  if (kind === 'loading') return '<div class="state"><div class="spinner" role="status" aria-label="Loading"></div></div>';
  const icon = kind === 'error' ? '⚠️' : '🧾';
  return `<div class="state"><div class="state-icon" aria-hidden="true">${icon}</div><h3>${escapeHtml(title)}</h3>${text ? `<p class="muted">${escapeHtml(text)}</p>` : ''}${action || ''}</div>`;
}

// ---------- Page shell ----------
const appState = { user: null, meta: null };

// Call at the top of every logged-in page. Redirects to /login if there is no token,
// loads the user and the category list, and renders the top navigation.
async function initShell(activePage) {
  if (!auth.getToken()) {
    location.replace('/login');
    return new Promise(() => {}); // never resolves; the page is navigating away
  }

  const [{ user }, meta] = await Promise.all([api.me(), api.meta()]);
  appState.user = user;
  appState.meta = meta;

  const links = [
    ['dashboard', '/', 'Dashboard'],
    ['transactions', '/transactions', 'Transactions'],
    ['reports', '/reports', 'Reports'],
  ];
  document.getElementById('topbar').innerHTML = `
    <div class="container topbar-inner">
      <a class="brand" href="/"><span class="brand-logo" aria-hidden="true">₹</span><span class="brand-name">Expense Tracker</span></a>
      <nav class="nav" aria-label="Main">
        ${links.map(([key, href, label]) => `<a href="${href}"${key === activePage ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <div class="user-menu">
        <span class="user-name" title="${escapeHtml(user.email)}">${escapeHtml(user.name)}</span>
        <label for="currency-select" class="sr-only">Currency</label>
        <select id="currency-select">
          ${meta.currencies.map((c) => `<option value="${c}"${c === user.currency ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-ghost btn-sm" id="logout-btn">Log out</button>
      </div>
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', () => auth.logout());

  // Changing the currency saves it on the user and tells the page to re-render amounts
  document.getElementById('currency-select').addEventListener('change', async (e) => {
    const select = e.target;
    const previous = appState.user.currency;
    select.disabled = true;
    try {
      const { user: updated } = await api.updateMe({ currency: select.value });
      appState.user = updated;
      updateBrandSymbol();
      toast(`Currency set to ${updated.currency}`);
      document.dispatchEvent(new CustomEvent('currencychange'));
    } catch (err) {
      select.value = previous;
      toast(err.message, 'error');
    } finally {
      select.disabled = false;
    }
  });

  updateBrandSymbol();
  return appState;
}

function updateBrandSymbol() {
  const symbols = { INR: '₹', SEK: 'kr', USD: '$' };
  const logo = document.querySelector('.brand-logo');
  if (logo) logo.textContent = symbols[appState.user.currency] || '₹';
}

// Show a page-level error if the shell itself fails to load (e.g. server down)
function shellError(err) {
  const main = document.querySelector('main');
  if (main) main.innerHTML = `<div class="panel">${stateHtml('error', { title: "Couldn't load the page", text: err.message, action: '<button type="button" class="btn btn-ghost" onclick="location.reload()">Try again</button>' })}</div>`;
}
