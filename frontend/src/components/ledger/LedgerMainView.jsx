import React, { useState, useEffect } from 'react';
import { getAccounts } from '../../api/ledger';
import LedgerDashboardView from './LedgerDashboardView';
import AccountReconcileView from './AccountReconcileView';
import SavingsAccountView from './SavingsAccountView';
import AccountFormView from './AccountFormView';
import TaxManagementView from './investment/TaxManagementView';
import InvestmentAccountDetailPage from './investment/InvestmentAccountDetailPage';
import InvestmentTransactionCreatePage from './investment/InvestmentTransactionCreatePage';
import ForeignCurrencyAccountView from './foreign/ForeignCurrencyAccountView';
import DebtAccountView from './DebtAccountView';
import LedgerTransactionsView from './LedgerTransactionsView';
import AccountTransferCreatePage from './AccountTransferCreatePage';
import FinancialPlanningView from './FinancialPlanningView';
import BalanceReconciliationModal from './shared/BalanceReconciliationModal';
import LedgerSettingsView from './LedgerSettingsView';
import FeatureSidebar from '../workspace/FeatureSidebar';
import api from '../../api/client';
import '../../styles/ledger-wide.css';
import '../../styles/account-detail-shared.css';
import '../../styles/ledger-mobile.css';

const formatAccountMoney = (value, currency = 'KRW') => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency, maximumFractionDigits: currency === 'KRW' ? 0 : 2,
}).format(Number(value || 0));

export default function LedgerMainView({ initialTab = 'dashboard' }) {
  const [summaryData, setSummaryData] = useState({
    accounts: [],
    totalAccounts: 0,
    totalCachedBalance: 0,
  });
  const [, setLoading] = useState(true);
  const [, setError] = useState(null);
  const [user, setUser] = useState(null);

  const [selectedAccount, setSelectedAccount] = useState(null);
  const [activeTab, setActiveTab] = useState(initialTab); // 'dashboard' | 'accounts' | 'investment-detail' | 'create' | 'edit' | 'reconcile' | ...
  const [editingAccount, setEditingAccount] = useState(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [transferSourceAccount, setTransferSourceAccount] = useState(null);
  const [transactionInitialType, setTransactionInitialType] = useState('ALL');
  const [investmentTradeDraft, setInvestmentTradeDraft] = useState(null);
  const [investmentTransactionReturnTab, setInvestmentTransactionReturnTab] = useState('investment-detail');
  const [planningInitialTab, setPlanningInitialTab] = useState('monthly');

  useEffect(() => {
    fetchAccounts();
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Endpoint /api/users/myProfile (or /api/users/me)
      const response = await api.get('/api/users/myProfile');
      setUser(response.data);
    } catch (err) {
      console.error('Failed to fetch user profile, trying /api/users/me', err);
      try {
        const fallbackRes = await api.get('/api/users/me');
        setUser(fallbackRes.data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await getAccounts(false);
      setSummaryData(data);

      if (selectedAccount) {
        const updated = data.accounts.find((a) => a.accountId === selectedAccount.accountId);
        if (updated) setSelectedAccount(updated);
      } else if (initialTab === 'investment-detail') {
        const investmentAccount = data.accounts.find((item) => item.accountType === 'INVESTMENT');
        if (investmentAccount) {
          setSelectedAccount(investmentAccount);
        } else {
          setActiveTab('accounts');
        }
      }
    } catch (err) {
      console.error(err);
      setError('계좌 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAccount = (account) => {
    setSelectedAccount(account);
    setActiveTab(account.accountType === 'INVESTMENT'
      ? 'investment-detail'
      : account.accountType === 'FOREIGN_CURRENCY' ? 'foreign-detail'
        : account.accountType === 'DEBT' ? 'debt-detail' : 'reconcile');
  };

  const handleOpenCreateView = () => {
    setActiveTab('create');
  };

  const handleOpenEditView = (account) => {
    setEditingAccount(account);
    setActiveTab('edit');
  };

  const handleOpenInvestmentTransaction = (account) => {
    setSelectedAccount(account);
    setInvestmentTradeDraft(null);
    setInvestmentTransactionReturnTab('investment-detail');
    setActiveTab('investment-transaction-create');
  };

  const handleOpenPlannedInvestmentTrade = (plan, item) => {
    const account = summaryData.accounts.find((value) => value.accountId === plan.investmentAccountId);
    if (!account) return;
    setSelectedAccount(account);
    setInvestmentTradeDraft({
      planId: plan.investmentPlanId,
      planTitle: plan.title,
      investmentId: item.investmentId,
      tickerCode: item.tickerCode,
      symbolName: item.symbolName,
      market: item.market,
      currency: item.quoteCurrency,
      assetClass: item.assetClass,
      currentPrice: item.referencePrice,
      exchangeRate: item.exchangeRate,
      quantity: item.expectedQuantity,
      plannedAmount: item.plannedAmount,
    });
    setPlanningInitialTab('investment');
    setInvestmentTransactionReturnTab('budget');
    setActiveTab('investment-transaction-create');
  };

  const handleOpenTransfer = (sourceAccount = null) => {
    setTransferSourceAccount(sourceAccount);
    setActiveTab('transfer-create');
  };

  const handleTransferSaved = async () => {
    await fetchAccounts();
    setTransferSourceAccount(null);
    setActiveTab('transactions');
  };

  const handleInvestmentTransactionSaved = async () => {
    await fetchAccounts();
    setInvestmentTradeDraft(null);
    setActiveTab(investmentTransactionReturnTab);
  };

  const handleBalanceReconciliationCompleted = async (updatedAccount) => {
    if (updatedAccount?.accountId) {
      setSelectedAccount(updatedAccount);
      setSummaryData((current) => ({
        ...current,
        accounts: current.accounts.map((item) => (
          item.accountId === updatedAccount.accountId ? updatedAccount : item
        )),
      }));
    }
    await fetchAccounts();
  };

  const handleFormSuccess = async (savedResult) => {
    try {
      const data = await getAccounts(false);
      setSummaryData(data);

      const targetId = savedResult?.accountId || editingAccount?.accountId || selectedAccount?.accountId;
      if (targetId) {
        const fresh = data.accounts.find((a) => a.accountId === targetId);
        if (fresh) {
          setSelectedAccount(fresh);
          setActiveTab(fresh.accountType === 'INVESTMENT'
            ? 'investment-detail'
            : fresh.accountType === 'FOREIGN_CURRENCY' ? 'foreign-detail'
              : fresh.accountType === 'DEBT' ? 'debt-detail' : 'reconcile');
        } else {
          setActiveTab('dashboard');
        }
      } else {
        setActiveTab('dashboard');
      }
    } catch (e) {
      console.error(e);
      setActiveTab('dashboard');
    } finally {
      setEditingAccount(null);
    }
  };

  const displayAccounts = summaryData.accounts;

  return (
    <div className="ledger-wide-wrapper workspace-layout feature-layout feature-ledger">
      <FeatureSidebar scope="ledger" userOverride={user} menuItems={[
        { key: 'dashboard', icon: '⌂', label: '대시보드', active: activeTab === 'dashboard', onClick: () => setActiveTab('dashboard') },
        { key: 'accounts', icon: '▤', label: '계좌', active: ['accounts', 'transfer-create', 'reconcile', 'foreign-detail', 'debt-detail', 'investment-detail', 'investment-transaction-create', 'create', 'edit'].includes(activeTab), onClick: () => setActiveTab('accounts') },
        { key: 'transactions', icon: '☷', label: '가계부', active: activeTab === 'transactions', onClick: () => { setTransactionInitialType('ALL'); setActiveTab('transactions'); } },
        { key: 'tax', icon: '▧', label: '세금 정산', active: activeTab === 'tax', onClick: () => { setSelectedAccount(null); setActiveTab('tax'); } },
        { key: 'budget', icon: '◇', label: '자금 계획', active: activeTab === 'budget', onClick: () => { setPlanningInitialTab('monthly'); setActiveTab('budget'); } },
        { key: 'analytics', icon: '▥', label: '통계', active: activeTab === 'analytics', onClick: () => setActiveTab('analytics') },
        { key: 'settings', icon: '⚙', label: '가계부 설정', active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
      ]} />
      {/* MAIN WORKSPACE CANVAS */}
      <main className="ledger-wide-main">
        {activeTab === 'tax' && <TaxManagementView accounts={summaryData.accounts} initialAccountId={selectedAccount?.accountId || ''} />}
        {activeTab === 'dashboard' && (
          <LedgerDashboardView
            accountsSummary={summaryData}
            onOpenCreateView={handleOpenCreateView}
            onSelectAccount={handleSelectAccount}
            onNavigateAccounts={() => setActiveTab('accounts')}
            onNavigateTransactions={(filter = 'ALL') => { setTransactionInitialType(filter); setActiveTab('transactions'); }}
          />
        )}

        {activeTab === 'accounts' && (
          <div className="space-y-6 ledger-accounts-page">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 ledger-accounts-header">
              <div>
                <h1 className="font-serif font-bold text-2xl text-stone-900">내 계좌 종합 관리</h1>
                <p className="text-xs text-stone-500 mt-1">등록된 전체 통장 및 자산 계좌 목록입니다.</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleOpenTransfer()} className="ledger-secondary-btn">↔ 계좌 이체</button>
                <button type="button" onClick={handleOpenCreateView} className="ledger-primary-btn">+ 신규 계좌 등록</button>
              </div>
            </div>

            <div className="ledger-account-grid">
              {displayAccounts.map((acc) => (
                <div
                  key={acc.accountId}
                  onClick={() => handleSelectAccount(acc)}
                  className="ledger-account-tile cursor-pointer bg-white p-5 rounded-2xl border border-stone-200 shadow-sm transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
                      {acc.accountPurpose === 'CASH' ? '💵' : acc.accountPurpose === 'TRANSIT_CARD' ? '🚌' : '💳'} {acc.accountName}
                    </span>
                    <span className="text-xs text-stone-400">
                      {acc.bankName || (acc.accountPurpose === 'CASH' ? '실물 지갑' : acc.accountPurpose === 'TRANSIT_CARD' ? '교통 / 선불카드' : '')}
                    </span>
                  </div>
                  <div className="ledger-account-amount font-bold text-xl">
                    {formatAccountMoney(
                      acc.accountType === 'DEBT' ? Math.abs(Number(acc.cachedBookBalance || 0)) : acc.cachedBookBalance,
                      acc.accountType === 'FOREIGN_CURRENCY' ? 'KRW' : acc.currency,
                    )}
                  </div>
                  <div className="ledger-account-tile-actions flex items-center justify-between gap-2 text-xs text-stone-500 pt-2 border-t border-stone-100">
                    <span>
                      {acc.accountType === 'FOREIGN_CURRENCY' ? '보유 통화: KRW · USD · JPY' : `통화: ${acc.currency}`}
                    </span>
                    {acc.accountType !== 'FOREIGN_CURRENCY' && <button type="button" onClick={(event) => { event.stopPropagation(); handleOpenTransfer(acc); }} className="font-bold text-[#477266] bg-[#edf6f2] px-2 py-1 rounded border border-[#cfe1da]">{acc.accountType === 'DEBT' ? (acc.accountPurpose === 'CREDIT_LINE' ? '사용·상환 →' : '상환 →') : '이체 →'}</button>}
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {acc.accountType === 'INVESTMENT' ? '투자 현황 보기 →' : acc.accountType === 'DEBT' ? '상환 현황 보기 →' : '잔액 대조하기 →'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'transactions' && (
          <LedgerTransactionsView
            accounts={summaryData.accounts}
            onSelectAccount={handleSelectAccount}
            initialType={transactionInitialType}
          />
        )}

        {activeTab === 'transfer-create' && (
          <AccountTransferCreatePage
            accounts={summaryData.accounts}
            initialSourceAccount={transferSourceAccount}
            onCancel={() => { setTransferSourceAccount(null); setActiveTab('accounts'); }}
            onSaved={handleTransferSaved}
          />
        )}

        {activeTab === 'create' && (
          <AccountFormView
            onSuccess={handleFormSuccess}
            onCancel={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'edit' && (
          <AccountFormView
            initialData={editingAccount}
            onSuccess={handleFormSuccess}
            onCancel={() => setActiveTab('accounts')}
          />
        )}

        {activeTab === 'reconcile' && (
          selectedAccount?.accountType === 'SAVINGS'
            ? <SavingsAccountView
                account={selectedAccount}
                onUpdate={fetchAccounts}
                onEditClick={handleOpenEditView}
                onOpenReconcile={() => setIsBalanceModalOpen(true)}
                onOpenTransfer={handleOpenTransfer}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
            : <AccountReconcileView
                account={selectedAccount}
                onUpdate={fetchAccounts}
                onEditClick={handleOpenEditView}
                onOpenReconcile={() => setIsBalanceModalOpen(true)}
                onOpenTransfer={handleOpenTransfer}
                onBackToDashboard={() => setActiveTab('dashboard')}
              />
        )}

        {activeTab === 'foreign-detail' && selectedAccount && (
          <ForeignCurrencyAccountView
            key={`${selectedAccount.accountId}-${selectedAccount.balanceUpdatedAt || ''}`}
            account={selectedAccount}
            onUpdate={fetchAccounts}
            onEditClick={handleOpenEditView}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'debt-detail' && selectedAccount && (
          <DebtAccountView
            key={`${selectedAccount.accountId}-${selectedAccount.balanceUpdatedAt || ''}`}
            account={selectedAccount}
            onUpdate={fetchAccounts}
            onEditClick={handleOpenEditView}
            onOpenReconcile={() => setIsBalanceModalOpen(true)}
            onOpenTransfer={handleOpenTransfer}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'investment-detail' && (
          <InvestmentAccountDetailPage
            key={`${selectedAccount?.accountId}-${selectedAccount?.balanceUpdatedAt || selectedAccount?.lastReconciledAt || ''}`}
            account={selectedAccount}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onEditAccount={handleOpenEditView}
            onOpenTax={() => setActiveTab('tax')}
            onAddTransaction={handleOpenInvestmentTransaction}
            onOpenReconcile={() => setIsBalanceModalOpen(true)}
            onOpenTransfer={handleOpenTransfer}
          />
        )}

        {activeTab === 'investment-transaction-create' && selectedAccount && (
          <InvestmentTransactionCreatePage
            account={selectedAccount}
            accounts={summaryData.accounts}
            initialDraft={investmentTradeDraft}
            onCancel={() => { setInvestmentTradeDraft(null); setActiveTab(investmentTransactionReturnTab); }}
            onSaved={handleInvestmentTransactionSaved}
          />
        )}

        <BalanceReconciliationModal
          open={isBalanceModalOpen}
          account={selectedAccount}
          onClose={() => setIsBalanceModalOpen(false)}
          onCompleted={handleBalanceReconciliationCompleted}
        />

        {activeTab === 'budget' && (
          <FinancialPlanningView accounts={summaryData.accounts} initialTab={planningInitialTab} onOpenInvestmentTrade={handleOpenPlannedInvestmentTrade} />
        )}

        {activeTab === 'settings' && (
          <LedgerSettingsView
            accounts={summaryData.accounts}
            onBackToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <span className="text-5xl">📊</span>
            <h2 className="font-serif font-bold text-xl text-stone-800">
              자산 분석 및 통계
            </h2>
            <p className="text-xs text-stone-500 max-w-sm">
              상단의 대시보드와 계좌 관리를 통해 자산을 실시간으로 대조하고 체크할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="ledger-primary-btn"
            >
              📊 대시보드로 돌아가기
            </button>
          </div>
        )}
      </main>

    </div>
  );
}
