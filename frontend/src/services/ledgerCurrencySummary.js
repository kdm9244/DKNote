// A missing quote must never turn a partial currency sum into a complete total.
export function convertLedgerTotals(values = {}, rates = {}) {
  let amount = 0;
  const missing = [];
  for (const [currency, raw] of Object.entries(values)) {
    const value = Number(raw || 0);
    if (!value) continue;
    const rate = currency === 'KRW' ? 1 : Number(rates[currency]?.rate);
    if (!Number.isFinite(rate) || rate <= 0) missing.push(currency);
    else amount += value * rate;
  }
  return { amount: missing.length ? null : amount, missing, complete: !missing.length };
}

export function summarizeLedgerCategories(categories, rates = {}) {
  const totals = {};
  for (const row of categories) {
    const converted = convertLedgerTotals({[row.currency]: row.amount}, rates);
    if (!converted.complete) return null;
    totals[row.category] = (totals[row.category] || 0) + converted.amount;
  }
  const sum = Object.values(totals).reduce((total, amount) => total + amount, 0);
  return Object.entries(totals).map(([category, amount]) => ({
    category, amount, currency: 'KRW', ratio: sum ? amount / sum * 100 : 0,
  })).sort((a,b) => b.amount - a.amount);
}
