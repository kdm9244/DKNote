import api from './client';

// 계좌 목록 및 요약 정보 조회
export const getAccounts = async (includeInactive = false) => {
  const response = await api.get(`/api/ledger/accounts?includeInactive=${includeInactive}`);
  return response.data;
};

export const getLedgerDashboard = async (month) => {
  const response = await api.get('/api/ledger/dashboard', { params: month ? { month } : {} });
  return response.data;
};

// 신규 계좌 생성
export const createAccount = async (accountData) => {
  const response = await api.post('/api/ledger/accounts', accountData);
  return response.data;
};

// 계좌 단건 상세 조회
export const getAccount = async (accountId) => {
  const response = await api.get(`/api/ledger/accounts/${accountId}`);
  return response.data;
};

// 계좌 정보 수정
export const updateAccount = async (accountId, accountData) => {
  const response = await api.put(`/api/ledger/accounts/${accountId}`, accountData);
  return response.data;
};

// 계좌 비활성화 (Soft Delete)
export const deactivateAccount = async (accountId) => {
  const response = await api.delete(`/api/ledger/accounts/${accountId}`);
  return response.data;
};

// 계좌 재활성화
export const activateAccount = async (accountId) => {
  const response = await api.patch(`/api/ledger/accounts/${accountId}/activate`);
  return response.data;
};

// 계좌 영구 삭제 (Hard Delete)
export const deleteAccountPermanently = async (accountId) => {
  const response = await api.delete(`/api/ledger/accounts/${accountId}/permanent`);
  return response.data;
};

// 실제 통장 잔액 맞춤 (Reconcile)
export const reconcileBalance = async (accountId, actualBalance) => {
  const response = await api.patch(`/api/ledger/accounts/${accountId}/reconcile`, {
    actualBalance: Number(actualBalance),
  });
  return response.data;
};

export const reconcileAndAdjustBalance = async (accountId, adjustmentData) => {
  const response = await api.post(`/api/ledger/accounts/${accountId}/reconcile-adjustment`, {
    actualBalance: Number(adjustmentData.actualBalance),
    reason: adjustmentData.reason,
    memo: adjustmentData.memo || '',
  });
  return response.data;
};

// 차액 발생 시 장부 잔액을 실제 뱅킹 잔액과 100% 동기화하는 상계 처리 (Auto Adjustment)
export const adjustBalanceToActual = async (accountId) => {
  const response = await api.post(`/api/ledger/accounts/${accountId}/adjust-to-actual`);
  return response.data;
};

// 계좌 대조 이력 조회
export const getReconciliationLogs = async (accountId) => {
  const response = await api.get(`/api/ledger/accounts/${accountId}/reconciliations`);
  return response.data;
};

// 계좌별 수입/지출 빠른 등록
export const applyQuickTransaction = async (accountId, transactionData) => {
  const response = await api.post(`/api/ledger/accounts/${accountId}/quick-transaction`, transactionData);
  return response.data;
};

// 신규 수입/지출 거래 내역 등록 (Transaction API)
export const createTransaction = async (data) => {
  const response = await api.post('/api/ledger/transactions', data);
  return response.data;
};

// 거래 내역 수정
export const updateTransaction = async (transactionId, data) => {
  const response = await api.put(`/api/ledger/transactions/${transactionId}`, data);
  return response.data;
};

// 거래 내역 삭제
export const deleteTransaction = async (transactionId) => {
  const response = await api.delete(`/api/ledger/transactions/${transactionId}`);
  return response.data;
};

// 계좌별 거래 내역 조회
export const getTransactionsByAccount = async (accountId) => {
  const response = await api.get(`/api/ledger/accounts/${accountId}/transactions`);
  return response.data;
};

// 전체 거래 내역 조회
export const getTransactionsByUser = async () => {
  const response = await api.get('/api/ledger/transactions');
  return response.data;
};

// 계좌별 실시간 월간 입금/출금/건수 통계 조회
export const getAccountStats = async (accountId) => {
  const response = await api.get(`/api/ledger/accounts/${accountId}/stats`);
  return response.data;
};

export const applyDebtMonthlyRepayment = async (accountId) => {
  const response = await api.post(`/api/ledger/accounts/${accountId}/debt/monthly-repayment`);
  return response.data;
};

export const createAccountTransfer = async (data) => {
  const response = await api.post('/api/ledger/transfers', data);
  return response.data;
};

export const getAccountTransfers = async () => {
  const response = await api.get('/api/ledger/transfers');
  return response.data;
};

// 적금/목적 저축 계좌 목표 저축 금액 갱신
export const updateTargetBalance = async (accountId, targetBalance) => {
  const response = await api.patch(`/api/ledger/accounts/${accountId}/target-balance`, {
    targetBalance: Number(targetBalance),
  });
  return response.data;
};

// --- 고정 지출 (Fixed Expenses) API ---

export const getFixedExpenses = async () => {
  const response = await api.get('/api/ledger/fixed-expenses');
  return response.data;
};

export const createFixedExpense = async (data) => {
  const response = await api.post('/api/ledger/fixed-expenses', data);
  return response.data;
};

export const deactivateFixedExpense = async (id) => {
  const response = await api.delete(`/api/ledger/fixed-expenses/${id}`);
  return response.data;
};

export const updateFixedExpense = async (id, data) => {
  const response = await api.put(`/api/ledger/fixed-expenses/${id}`, data);
  return response.data;
};

export const applyFixedExpense = async (id, expectedPaymentDate) => {
  const response = await api.post(`/api/ledger/fixed-expenses/${id}/apply`, {
    expectedPaymentDate,
  });
  return response.data;
};

// --- 월간 자금 계획 / 목표·위시리스트 ---

export const getFinancialPlanning = async (month, currency = 'KRW') => {
  const response = await api.get('/api/ledger/planning', { params: { month, currency } });
  return response.data;
};

export const saveMonthlyFinancialPlan = async (data) => {
  await api.put('/api/ledger/planning/monthly', data);
};

export const saveCategoryBudgets = async (data) => {
  await api.put('/api/ledger/planning/budgets', data);
};

export const createFinancialGoal = async (data) => {
  const response = await api.post('/api/ledger/planning/goals', data);
  return response.data;
};

export const updateFinancialGoal = async (goalId, data) => {
  const response = await api.put(`/api/ledger/planning/goals/${goalId}`, data);
  return response.data;
};

export const archiveFinancialGoal = async (goalId) => {
  await api.delete(`/api/ledger/planning/goals/${goalId}`);
};

export const addGoalContribution = async (goalId, data) => {
  const response = await api.post(`/api/ledger/planning/goals/${goalId}/contributions`, data);
  return response.data;
};

export const getInvestmentPlans = async (month) => {
  const response = await api.get('/api/ledger/planning/investment-plans', { params: { month } });
  return response.data;
};

export const createInvestmentPlan = async (data, month) => {
  const response = await api.post('/api/ledger/planning/investment-plans', data, { params: { month } });
  return response.data;
};

export const updateInvestmentPlan = async (planId, data, month) => {
  const response = await api.put(`/api/ledger/planning/investment-plans/${planId}`, data, { params: { month } });
  return response.data;
};

export const archiveInvestmentPlan = async (planId) => {
  await api.delete(`/api/ledger/planning/investment-plans/${planId}`);
};
