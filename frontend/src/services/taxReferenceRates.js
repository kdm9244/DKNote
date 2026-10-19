import {normalizeAssetRate} from './assetSummary.js';

// Reuse the dashboard's KRW quotes, including the provider's 1/100-unit convention.
export async function loadTaxReferenceRates(keys, fetchQuote) {
  const currencies = [...new Set(keys.flatMap(key => key.split('_')).filter(c => c !== 'KRW'))];
  const results = await Promise.allSettled(currencies.map(async currency => {
    const quote = await fetchQuote(currency, 'KRW');
    const rate = normalizeAssetRate(quote, currency);
    if (!rate || (quote.base && quote.base !== currency) || (quote.quote && quote.quote !== 'KRW')) {
      throw new Error('Invalid exchange rate quote');
    }
    return {...quote, rate};
  }));
  const quotes = {};
  results.forEach((result, i) => {if (result.status === 'fulfilled') quotes[currencies[i]] = result.value;});
  const rates = {}, sources = {}, failed = [];
  for (const key of keys) {
    const [from, to] = key.split('_');
    const base = from === 'KRW' ? 1 : quotes[from]?.rate;
    const counter = to === 'KRW' ? 1 : quotes[to]?.rate;
    const rate = base && counter ? Number((base / counter).toFixed(8)) : 0;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1000000) {failed.push(key); continue;}
    rates[key] = String(rate);
    sources[key] = [...new Set([quotes[from]?.updatedAt, quotes[to]?.updatedAt].filter(Boolean))];
  }
  return {rates, sources, failed};
}
