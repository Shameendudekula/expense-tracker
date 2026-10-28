// Transactions page: filterable, paginated table with add / edit / delete.

const state = { page: 1, limit: 15, search: '', month: '', type: '', category: '', request: 0, rows: [] };

const el = {
  search: document.getElementById('search'),
  month: document.getElementById('month-filter'),
  type: document.getElementById('type-filter'),
  category: document.getElementById('category-filter'),
  totals: document.getElementById('filter-totals'),
  tableWrap: document.getElementById('table-wrap'),
  rows: document.getElementById('rows'),
  state: document.getElementById('state'),
  pagination: document.getElementById('pagination'),
  pageInfo: document.getElementById('page-info'),
  prev: document.getElementById('prev-page'),
  next: document.getElementById('next-page'),
};

// The category list depends on the selected type ("All types" shows every category once)
function fillCategoryFilter() {
  const { income, expense } = appState.meta.categories;
  const list = state.type ? appState.meta.categories[state.type] : [...new Set([...expense, ...income])];
  if (!list.includes(state.category)) state.category = '';
  el.category.innerHTML = '<option value="">All categories</option>' + list.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  el.category.value = state.category;
}

function show(kind, html = '') {
  el.tableWrap.hidden = kind !== 'table';
  el.pagination.hidden = kind !== 'table';
  el.state.innerHTML = kind === 'table' ? '' : html;
}

function renderRows(rows) {
  el.rows.innerHTML = rows
    .map((t) => {
      const sign = t.type === 'income' ? '+' : '−';
      return `<tr>
        <td data-label="Date">${formatDate(t.date)}</td>
        <td data-label="Description">${escapeHtml(t.description || '—')}</td>
        <td data-label="Category"><span class="badge-dot" style="--dot:${categoryColor(t.type, t.category)}">${escapeHtml(t.category)}</span></td>
        <td data-label="Type"><span class="type-pill type-${t.type}">${t.type}</span></td>
        <td data-label="Amount" class="num amount-${t.type}">${sign}${formatMoney(t.amount)}</td>
        <td class="actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${t._id}">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="delete" data-id="${t._id}">Delete</button>
        </td>
      </tr>`;
    })
    .join('');
}

async function load() {
  const requestId = ++state.request;
  show('loading', stateHtml('loading'));
  el.totals.textContent = '';

  try {
    const { data, totals, pagination } = await api.listTransactions({
      page: state.page, limit: state.limit, search: state.search, month: state.month, type: state.type, category: state.category,
    });
    if (requestId !== state.request) return; // a newer request has started (e.g. while typing)

    // e.g. the last item on the last page was deleted: step back a page
    if (data.length === 0 && pagination.total > 0 && state.page > 1) {
      state.page = pagination.totalPages;
      return load();
    }

    state.rows = data;
    const filtered = state.search || state.month || state.type || state.category;
    if (data.length === 0) {
      show(
        'empty',
        filtered
          ? stateHtml('empty', { title: 'No matching transactions', text: 'Try a different search or clear the filters.', action: '<button type="button" class="btn btn-ghost" data-action="clear">Clear filters</button>' })
          : stateHtml('empty', { title: 'No transactions yet', text: 'Add your first income or expense to get started.', action: '<button type="button" class="btn btn-primary" data-action="add">＋ Add transaction</button>' })
      );
      return;
    }

    renderRows(data);
    show('table');
    const scope = state.month ? monthLabel(state.month) : 'all time';
    el.totals.innerHTML = `
      <span>${pagination.total} transaction${pagination.total === 1 ? '' : 's'} · ${escapeHtml(scope)}</span>
      <span>Income <strong class="amount-income">${formatMoney(totals.income)}</strong></span>
      <span>Expenses <strong class="amount-expense">${formatMoney(totals.expense)}</strong></span>
      <span>Net <strong>${formatMoney(totals.balance)}</strong></span>`;
    el.pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
    el.prev.disabled = pagination.page <= 1;
    el.next.disabled = pagination.page >= pagination.totalPages;
    el.pagination.hidden = pagination.totalPages <= 1;
  } catch (err) {
    if (requestId !== state.request) return;
    show('error', stateHtml('error', { title: "Couldn't load transactions", text: err.message, action: '<button type="button" class="btn btn-ghost" data-action="retry">Try again</button>' }));
  }
}

const reloadFromStart = () => { state.page = 1; load(); };

// ---------- Events ----------
document.getElementById('add-btn').addEventListener('click', () => TxModal.open(null, load));

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const tx = state.rows.find((t) => t._id === btn.dataset.id);
  switch (btn.dataset.action) {
    case 'edit': TxModal.open(tx, load); break;
    case 'delete': ConfirmDelete.open(tx, load); break;
    case 'add': TxModal.open(null, load); break;
    case 'retry': load(); break;
    case 'clear':
      Object.assign(state, { search: '', month: '', type: '', category: '' });
      el.search.value = el.month.value = el.type.value = '';
      fillCategoryFilter();
      reloadFromStart();
      break;
  }
});

el.search.addEventListener('input', debounce(() => { state.search = el.search.value.trim(); reloadFromStart(); }, 300));
el.month.addEventListener('change', () => { state.month = el.month.value; reloadFromStart(); });
el.type.addEventListener('change', () => { state.type = el.type.value; fillCategoryFilter(); reloadFromStart(); });
el.category.addEventListener('change', () => { state.category = el.category.value; reloadFromStart(); });
el.prev.addEventListener('click', () => { state.page--; load(); });
el.next.addEventListener('click', () => { state.page++; load(); });
document.addEventListener('currencychange', load);

(async () => {
  try {
    await initShell('transactions');
    // Start on the current month; clearing the month field shows all months
    state.month = el.month.value = currentMonth();
    el.month.max = currentMonth();
    fillCategoryFilter();
    load();
  } catch (err) {
    shellError(err);
  }
})();
