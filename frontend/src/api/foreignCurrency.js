import api from './client';

export const getForeignAccountDetail = async (accountId) => {
  const response = await api.get(`/api/ledger/foreign-accounts/${accountId}/detail`);
  return response.data;
};

export const syncForeignExchangeRates = async (accountId) => {
  const response = await api.post(`/api/ledger/foreign-accounts/${accountId}/rates/sync`);
  return response.data;
};

export const createForeignTransaction = async (accountId, data) => {
  const response = await api.post(`/api/ledger/foreign-accounts/${accountId}/transactions`, data);
  return response.data;
};

export const updateForeignTransaction = async (accountId, transactionId, data) => {
  const response = await api.put(`/api/ledger/foreign-accounts/${accountId}/transactions/${transactionId}`, data);
  return response.data;
};

export const deleteForeignTransaction = async (accountId, transactionId) => {
  await api.delete(`/api/ledger/foreign-accounts/${accountId}/transactions/${transactionId}`);
};
