// Dashboard: month summary cards, two Chart.js charts and the latest transactions.

const monthInput = document.getElementById('month');
let doughnutChart, trendChart;
// Latest summary from the server; chart tooltips read from here so they always match the data shown
let latest = null;
let doughnutRows = [];

Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.color = '#64748b';

function renderStats(s) {
  const savingsRate = s.income > 0 ? Math.round((s.balance / s.income) * 100) : null;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  document.getElementById('stats').innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Income</span>
      <span class="stat-value">${formatMoney(s.income)}</span>
      <span class="stat-sub">${plural(s.counts.income, 'transaction')} in ${monthLabel(s.month)}</span>
    </div>
    <div class="stat-card">
      <span class="stat-label">Expenses</span>
      <span class="stat-value">${formatMoney(s.expenses)}</span>
      <span class="stat-sub">${plural(s.counts.expense, 'transaction')} in ${monthLabel(s.month)}</span>
    </div>
    <div class="stat-card stat-balance">
      <span class="stat-label">Balance</span>
      <span class="stat-value">${formatMoney(s.balance)}</span>
      <span class="stat-sub">${savingsRate === null ? 'No income this month' : `${savingsRate}% of income saved`}</span>
    </div>`;
}

function renderDoughnut(s) {
  // Keep the fixed category order so each category keeps its colour
  const order = appState.meta.categories.expense;
  const rows = s.byCategory.filter((c) => c.type === 'expense').sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
  doughnutRows = rows;

  const area = document.getElementById('doughnut-area');
  const empty = document.getElementById('doughnut-state');
  if (rows.length === 0) {
    area.hidden = true;
    empty.hidden = false;
    empty.innerHTML = stateHtml('empty', { title: 'No expenses this month', text: `Nothing spent in ${monthLabel(s.month)} yet.` });
    return;
  }
  area.hidden = false;
  empty.hidden = true;

  const data = {
    labels: rows.map((r) => r.category),
    datasets: [{
      data: rows.map((r) => r.total),
      backgroundColor: rows.map((r) => categoryColor('expense', r.category)),
      borderColor: '#ffffff', // 2px white gap between slices
      borderWidth: 2,
      hoverOffset: 6,
    }],
  };

  if (doughnutChart) {
    doughnutChart.data = data;
    doughnutChart.update();
  } else {
    doughnutChart = new Chart(document.getElementById('doughnut'), {
      type: 'doughnut',
      data,
      options: {
        cutout: '62%',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }, // custom legend with amounts is rendered next to the chart
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${formatMoney(ctx.parsed)} (${doughnutRows[ctx.dataIndex]?.percent ?? 0}%)`,
            },
          },
        },
      },
    });
  }
  document.getElementById('doughnut-legend').innerHTML = rows
    .map(
      (r) => `<li>
        <span class="swatch" style="background:${categoryColor('expense', r.category)}"></span>
        <span>${escapeHtml(r.category)}</span>
        <span class="value">${formatMoney(r.total)}<span class="pct">${r.percent}%</span></span>
      </li>`
    )
    .join('');
}

function renderTrend(s) {
  const data = {
    labels: s.trend.map((t) => monthLabel(t.month, true)),
    datasets: [
      { label: 'Income', data: s.trend.map((t) => t.income), backgroundColor: '#2a78d6', borderRadius: 4, barPercentage: 0.85, categoryPercentage: 0.7 },
      { label: 'Expenses', data: s.trend.map((t) => t.expense), backgroundColor: '#eb6834', borderRadius: 4, barPercentage: 0.85, categoryPercentage: 0.7 },
    ],
  };

  if (trendChart) {
    trendChart.data = data;
    trendChart.update();
    return;
  }
  trendChart = new Chart(document.getElementById('trend'), {
    type: 'bar',
    data,
    options: {
      maintainAspectRatio: false,
      // Hovering anywhere over a month shows both values for that month
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false }, // shown above the chart as HTML
        tooltip: {
          callbacks: {
            title: (items) => monthLabel(latest.trend[items[0].dataIndex].month),
            label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: '#e2e8f0' } },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: '#eef2f6' },
          ticks: { callback: (v) => formatMoneyShort(v), maxTicksLimit: 6 },
        },
      },
    },
  });
}

async function loadSummary() {
  try {
    const s = await api.summary(monthInput.value);
    latest = s;
    renderStats(s);
    renderDoughnut(s);
    renderTrend(s);
  } catch (err) {
    toast("Couldn't load the summary: " + err.message, 'error');
  }
}

async function loadRecent() {
  const box = document.getElementById('recent');
  box.innerHTML = stateHtml('loading');
  try {
    const { data } = await api.listTransactions({ limit: 6 });
    if (data.length === 0) {
      box.innerHTML = stateHtml('empty', {
        title: 'No transactions yet',
        text: 'Add your first income or expense to get started.',
        action: '<button type="button" class="btn btn-primary" data-action="add">＋ Add transaction</button>',
      });
      return;
    }
    box.innerHTML =
      '<ul class="tx-list">' +
      data
        .map((t) => {
          const sign = t.type === 'income' ? '+' : '−';
          return `<li>
            <div class="tx-main">
              <div class="tx-desc">${escapeHtml(t.description || t.category)}</div>
              <div class="tx-meta"><span class="badge-dot" style="--dot:${categoryColor(t.type, t.category)}">${escapeHtml(t.category)}</span> · ${formatDate(t.date)}</div>
            </div>
            <div class="tx-amount amount-${t.type}">${sign}${formatMoney(t.amount)}</div>
          </li>`;
        })
        .join('') +
      '</ul>';
  } catch (err) {
    box.innerHTML = stateHtml('error', { title: "Couldn't load transactions", text: err.message });
  }
}

const reload = () => Promise.all([loadSummary(), loadRecent()]);

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="add"]')) TxModal.open(null, reload);
});
document.getElementById('add-btn').addEventListener('click', () => TxModal.open(null, reload));
monthInput.addEventListener('change', () => { if (monthInput.value) loadSummary(); });
document.addEventListener('currencychange', reload);

(async () => {
  try {
    await initShell('dashboard');
    monthInput.value = currentMonth();
    monthInput.max = currentMonth();
    reload();
  } catch (err) {
    shellError(err);
  }
})();
