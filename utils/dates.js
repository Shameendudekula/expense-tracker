// All dates are stored as UTC midnight (the date picker sends "2026-10-05" -> 2026-10-05T00:00:00Z),
// so month boundaries are also calculated in UTC.

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

// "2026-10" -> { start: 2026-10-01, end: 2026-11-01 } (end is exclusive), or null if invalid
function monthRange(value) {
  const m = MONTH_RE.exec(value || '');
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
}

// Current month as "YYYY-MM"
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

// The `count` months ending with `month`, oldest first: lastMonths("2026-03", 3) -> ["2026-01", "2026-02", "2026-03"]
function lastMonths(month, count) {
  const { start } = monthRange(month);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

module.exports = { monthRange, currentMonth, lastMonths };
