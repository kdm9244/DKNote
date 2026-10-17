import api from './client';

const basePath = '/api/ledger/investment-accounts';

export async function getInvestmentDetail(accountId) {
  const response = await api.get(`${basePath}/${accountId}/detail`);
  return response.data;
}

export async function getInvestmentTransactions(accountId, filters = {}) {
  const params = {
    page: filters.page ?? 0,
    size: filters.size ?? 50,
    sort: filters.sort ?? 'tradeDate,desc',
  };

  if (filters.type) params.type = filters.type;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;

  const response = await api.get(`${basePath}/${accountId}/transactions`, { params });
  return response.data;
}

export async function getInvestmentActivities(filters = {}) {
  const response = await api.get(`${basePath}/transactions`, {
    params: {
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    },
  });
  return response.data;
}

export async function syncInvestmentPrices(accountId) {
  const response = await api.post(`${basePath}/${accountId}/prices/sync`);
  return response.data;
}

export async function searchInvestmentSymbols(accountId, query, market = 'ALL') {
  const response = await api.get(`${basePath}/${accountId}/symbols/search`, {
    params: { query, market },
  });
  return response.data;
}

export async function getInvestmentTradePrice(accountId, symbol) {
  const response = await api.get(`${basePath}/${accountId}/quotes/trade-price`, {
    params: {
      tickerCode: symbol.tickerCode,
      market: symbol.market,
      currency: symbol.currency,
    },
  });
  return response.data;
}

export async function createInvestmentTransaction(accountId, transaction) {
  const response = await api.post(`${basePath}/${accountId}/transactions`, transaction);
  return response.data;
}

export async function getInvestmentFeeSettings(accountId) {
  const response = await api.get(`${basePath}/${accountId}/fee-settings`);
  return response.data;
}

export async function updateInvestmentFeeSettings(accountId, settings) {
  const response = await api.put(`${basePath}/${accountId}/fee-settings`, { settings });
  return response.data;
}

export async function updateInvestmentTargetAllocations(accountId, items) {
  const response = await api.put(`${basePath}/${accountId}/target-allocations`, { items });
  return response.data;
}

export async function createInvestmentNote(accountId, note) {
  const response = await api.post(`${basePath}/${accountId}/notes`, note);
  return response.data;
}

export async function getInvestmentPriceProviderStatus() {
  const response = await api.get(`${basePath}/price-provider/status`);
  return response.data;
}
