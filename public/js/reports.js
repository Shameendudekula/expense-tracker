// Reports page: month picker, summary cards, category breakdown tables and CSV export.

const monthInput = document.getElementById('month');
const exportBtn = document.getElementById('export-btn');
const report = document.getElementById('report');
const stats = document.getElementById('stats');

function renderStats(s) {
  const savingsRate = s.income > 0 ? `${Math.round((s.balance / s.income) * 100)}%` : '—';
  stats.innerHTML = `
    <div class="stat-card"><span class="stat-label">Income</span><span class="stat-value">${formatMoney(s.income)}</span><span class="stat-sub">${s.counts.income} transactions</span></div>
    <div class="stat-card"><span class="stat-label">Expenses</span><span class="stat-value">${formatMoney(s.expenses)}</span><span class="stat-sub">${s.counts.expense} transactions</span></div>
    <div class="stat-card stat-balance"><span class="stat-label">Balance</span><span class="stat-value">${formatMoney(s.balance)}</span><span class="stat-sub">Income minus expenses</span></div>
    <div class="stat-card"><span class="stat-label">Savings rate</span><span class="stat-value">${savingsRate}</span><span class="stat-sub">Share of income kept</span></div>`;
}

function breakdownTable(type, rows, total) {
  const title = type === 'expense' ? 'Expenses by category' : 'Income by category';
  if (rows.length === 0) {
    return `<section class="panel"><div class="panel-header"><h2>${title}</h2></div>${stateHtml('empty', { title: `No ${type === 'expense' ? 'expenses' : 'income'} this month` })}</section>`;
  }
  return `<section class="panel" aria-labelledby="t-${type}">
    <div class="panel-header"><h2 id="t-${type}">${title}</h2></div>
    <div class="table-wrap">
      <table class="table responsive">
        <thead><tr><th scope="col">Category</th><th scope="col" class="num">Transactions</th><th scope="col" class="num">Amount</th><th scope="col" class="num">Share</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr>
                <td data-label="Category"><span class="badge-dot" style="--dot:${categoryColor(type, r.category)}">${escapeHtml(r.category)}</span></td>
                <td data-label="Transactions" class="num">${r.count}</td>
                <td data-label="Amount" class="num">${formatMoney(r.total)}</td>
                <td data-label="Share" class="num">${r.percent}%</td>
              </tr>`
            )
            .join('')}
        </tbody>
        <tfoot><tr>
          <td data-label="Category">Total</td>
          <td data-label="Transactions" class="num">${rows.reduce((n, r) => n + r.count, 0)}</td>
          <td data-label="Amount" class="num">${formatMoney(total)}</td>
          <td data-label="Share" class="num">100%</td>
        </tr></tfoot>
      </table>
    </div>
  </section>`;
}

async function load() {
  report.innerHTML = `<div class="panel">${stateHtml('loading')}</div>`;
  try {
    const s = await api.summary(monthInput.value);
    renderStats(s);
    const expenses = s.byCategory.filter((c) => c.type === 'expense');
    const income = s.byCategory.filter((c) => c.type === 'income');
    exportBtn.disabled = expenses.length + income.length === 0;
    report.innerHTML = breakdownTable('expense', expenses, s.expenses) + breakdownTable('income', income, s.income);
  } catch (err) {
    report.innerHTML = `<div class="panel">${stateHtml('error', { title: "Couldn't load the report", text: err.message, action: '<button type="button" class="btn btn-ghost" onclick="load()">Try again</button>' })}</div>`;
  }
}

// Download the month's transactions as a CSV file. The request needs the JWT header,
// so we fetch the file ourselves and hand it to the browser as a download.
exportBtn.addEventListener('click', async () => {
  const month = monthInput.value;
  exportBtn.disabled = true;
  const label = exportBtn.textContent;
  exportBtn.textContent = 'Preparing…';
  try {
    const blob = await api.exportCsv(month);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `transactions-${month}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported transactions for ${monthLabel(month)}`);
  } catch (err) {
    toast("Couldn't export: " + err.message, 'error');
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = label;
  }
});

monthInput.addEventListener('change', () => { if (monthInput.value) load(); });
document.addEventListener('currencychange', load);

(async () => {
  try {
    await initShell('reports');
    monthInput.value = currentMonth();
    monthInput.max = currentMonth();
    load();
  } catch (err) {
    shellError(err);
  }
})();
