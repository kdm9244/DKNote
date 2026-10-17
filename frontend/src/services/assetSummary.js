// Amounts in different currencies are kept separate; investment cash is counted once.
export function summarizeAssets(accounts = [], investment = {}) {
  const cash = {},
    market = {},
    debt = {};
  for (const account of accounts) {
    if (account.isActive === false || account.active === false) continue;
    const currency = account.currency || "KRW";
    const amount = Number(account.cachedBookBalance || 0);
    if (account.accountType === "DEBT")
      debt[currency] = (debt[currency] || 0) + Math.abs(amount);
    else cash[currency] = (cash[currency] || 0) + amount;
  }
  for (const total of investment?.totals || []) {
    const currency = total.currency || "KRW";
    market[currency] =
      (market[currency] || 0) +
      Number(
        total.marketValue ??
          Number(total.totalAsset || 0) - Number(total.cashBalance || 0),
      );
  }
  const currencies = [
    ...new Set([
      ...Object.keys(cash),
      ...Object.keys(market),
      ...Object.keys(debt),
    ]),
  ].sort((a, b) => (a === "KRW" ? -1 : b === "KRW" ? 1 : a.localeCompare(b)));
  if (!currencies.length) currencies.push("KRW");
  const rows = currencies.map((currency) => ({
    currency,
    cash: cash[currency] || 0,
    market: market[currency] || 0,
    debt: debt[currency] || 0,
    amount: (cash[currency] || 0) + (market[currency] || 0),
    net:
      (cash[currency] || 0) + (market[currency] || 0) - (debt[currency] || 0),
  }));
  return { cash, market, debt, currencies, rows };
}
export function assetMoney(amount, currency = "KRW") {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2,
  }).format(Number(amount || 0));
}
export function normalizeAssetRate(quote, currency) {
  const unit = Number(
    quote.baseUnit ??
      (quote.provider === "KIS" ? 1 : currency === "JPY" ? 100 : 1),
  );
  const rate = Number(quote.rate) / unit;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
export function convertAssetsToKrw(summary, rates = {}) {
  const missing = summary.rows
    .filter(
      (r) =>
        r.currency !== "KRW" &&
        (r.amount || r.debt) &&
        !rates[r.currency]?.rate,
    )
    .map((r) => r.currency);
  const value = { amount: 0, cash: 0, market: 0, debt: 0, net: 0 };
  if (missing.length) return { ...value, complete: false, missing };
  for (const row of summary.rows) {
    const rate = row.currency === "KRW" ? 1 : rates[row.currency]?.rate || 0;
    for (const field of Object.keys(value)) value[field] += row[field] * rate;
  }
  return { ...value, complete: true, missing };
}
