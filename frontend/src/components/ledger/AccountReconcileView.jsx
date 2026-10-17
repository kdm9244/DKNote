import InlineEditor from "../workspace/InlineEditor";
import React, { useState, useEffect, useCallback } from 'react';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionsByAccount,
  getAccountStats,
  getReconciliationLogs,
  getFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deactivateFixedExpense,
  applyFixedExpense,
} from '../../api/ledger';
import AccountIdentityCard from './shared/AccountIdentityCard';
import { getLedgerSettings } from '../../services/ledgerSettings';

const TYPE_LABELS = {
  CHECKING: '입출금',
  SAVINGS: '저축/예금',
  INVESTMENT: '투자',
  FOREIGN_CURRENCY: '외화',
  DEBT: '부채',
};

const PURPOSE_LABELS = {
  CASH: '현금 / 지갑',
  TRANSIT_CARD: '교통카드 / 선불',
  GENERAL_CHECKING: '일반 입출금',
  SALARY_CHECKING: '급여',
  LIVING_CHECKING: '생활비',
  EMERGENCY_CHECKING: '비상금',
  ALLOWANCE_CHECKING: '용돈',
  INSTALLMENT_SAVINGS: '적금',
  TIME_DEPOSIT: '정기예금',
  FREE_SAVINGS: '자유저축',
  STOCK_BROKERAGE: '증권',
  CMA: 'CMA',
  NISA: 'NISA',
  PENSION: '연금',
  OTHER_INVESTMENT: '기타 투자',
  FOREIGN_SAVINGS: '외화예금',
  FOREIGN_LIVING: '해외생활비',
  LOAN: '대출',
  CREDIT_LINE: '마이너스통장',
};

const EXPENSE_CATEGORIES = [
  { value: '식비 · 카페', label: '☕ 식비 / 카페' },
  { value: '생활비', label: '🛒 생활비 / 쇼핑' },
  { value: '교통', label: '🚌 교통비' },
  { value: '주거 · 통신', label: '🏠 주거 / 통신 / 공과금' },
  { value: '의료 · 건강', label: '🏥 의료 / 건강' },
  { value: '문화 · 여가', label: '🎬 문화 / 취미 / 여가' },
  { value: '여행 · 숙박', label: '✈️ 여행 / 숙박' },
  { value: '잔액 조정', label: '⚖️ 잔액 조정 (출금)' },
  { value: '기타', label: '📌 기타 지출' },
];

const INCOME_CATEGORIES = [
  { value: '급여', label: '💰 급여 / 월급' },
  { value: '부수입', label: '💵 부수입 / 알바' },
  { value: '투자수익', label: '📈 투자수익 / 배당금' },
  { value: '용돈 · 상여', label: '🎁 용돈 / 상여금' },
  { value: '잔액 조정', label: '⚖️ 잔액 조정 (입금)' },
  { value: '기타', label: '📌 기타 수입' },
];

const CATEGORY_COLORS = ['#527a8c', '#d59a45', '#3f976f', '#a96657', '#7b70a8', '#c56d7b'];

const localDateValue = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

export default function AccountReconcileView({ account, onUpdate, onEditClick, onOpenReconcile, onOpenTransfer, onBackToDashboard }) {

  // Warning Modal (잔액 부족 경고)
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [warningData, setWarningData] = useState(null);

  // 거래 수정 영역
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // 수정 중인 transaction 객체
  const [editForm, setEditForm] = useState({
    title: '',
    amount: '',
    transactionType: 'EXPENSE',
    categoryId: '식비 · 카페',
    transactionDate: '',
    memo: '',
  });

  // Quick Transaction Form (환경설정 기본값 연동)
  const initialSettings = getLedgerSettings();
  const [txMode, setTxMode] = useState(initialSettings.defaultTxMode || 'EXPENSE'); // 'EXPENSE' | 'INCOME' | 'MATCH'
  const [txAmount, setTxAmount] = useState('');
  const [txIsIncome, setTxIsIncome] = useState(initialSettings.defaultTxMode === 'INCOME');
  const [txCategory, setTxCategory] = useState(
    initialSettings.defaultTxMode === 'MATCH'
      ? '잔액 조정'
      : initialSettings.defaultTxMode === 'INCOME'
      ? '수입'
      : '식비 · 카페'
  );
  const [txTitle, setTxTitle] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 16));

  // Backend Data
  const [transactions, setTransactions] = useState([]);
  const [accountStats, setAccountStats] = useState({
    monthlyIncomeTotal: 0,
    monthlyExpenseTotal: 0,
    monthlyTransactionCount: 0,
  });

  // 최근 계좌 활동 (현금 흐름 카드의 보조 정보)
  const [activityLog, setActivityLog] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [fixedExpenseForm, setFixedExpenseForm] = useState({
    title: '',
    amount: '',
    nextPaymentDate: localDateValue(),
  });
  const [processingFixedExpenseId, setProcessingFixedExpenseId] = useState('');
  const [editingFixedExpenseId, setEditingFixedExpenseId] = useState('');

  const [filterTab, setFilterTab] = useState('ALL');
  const [contentTab, setContentTab] = useState('TRANSACTIONS');
  const [cashFlowTab, setCashFlowTab] = useState('FLOW');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 4000); };
  const showErr = (msg) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 6000); };

  const loadAccountData = useCallback(async () => {
    if (!account?.accountId) return;
    try {
      setLoading(true);
      const [txData, statsData, logsData, fixedExpenseData] = await Promise.all([
        getTransactionsByAccount(account.accountId),
        getAccountStats(account.accountId),
        getReconciliationLogs(account.accountId),
        getFixedExpenses().catch(() => []),
      ]);
      const txList = txData || [];
      const logList = logsData || [];
      setTransactions(txList);
      setAccountStats(statsData || { monthlyIncomeTotal: 0, monthlyExpenseTotal: 0, monthlyTransactionCount: 0 });
      setFixedExpenses((fixedExpenseData || []).filter((item) => item.accountId === account.accountId));
      // 통합 타임라인 생성: 거래내역 + 대조이력 합쳐서 날짜 역순 정렬
      const txEntries = txList.map((tx) => ({
        id: tx.transactionId,
        type: tx.transactionType, // INCOME | EXPENSE
        title: tx.title,
        amount: tx.amount,
        categoryId: tx.categoryId,
        date: tx.transactionDate || tx.createdAt,
        memo: tx.memo,
      }));
      const reconcileEntries = logList.map((log) => ({
        id: log.reconciliationId,
        type: 'RECONCILE',
        title: '잔액 대조 실행',
        amount: log.diffAmount,
        date: log.reconciledAt,
        memo: log.memo || '',
      }));
      const combined = [...txEntries, ...reconcileEntries].sort(
        (a, b) => new Date(b.date) - new Date(a.date),
      );
      setActivityLog(combined);
    } catch (err) {
      console.error('Failed to load account live data', err);
    } finally {
      setLoading(false);
    }
  }, [account?.accountId]);

  useEffect(() => {
    if (account) {
      setMessage('');
      setErrorMsg('');
      loadAccountData();
    }
  }, [account, loadAccountData]);

  if (!account) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <span className="text-5xl">📕</span>
        <h3 className="font-serif font-bold text-xl text-stone-800">선택된 계좌가 없습니다</h3>
        <button type="button" onClick={onBackToDashboard} className="ledger-primary-btn">
          📊 대시보드로 돌아가기
        </button>
      </div>
    );
  }

  const formatCurrency = (val) => {
    const num = Number(val || 0);
    if (account?.currency === 'JPY') return `¥ ${num.toLocaleString()}`;
    if (account?.currency === 'USD') return `$ ${num.toLocaleString()}`;
    return `₩ ${num.toLocaleString()}`;
  };

  const bookBal = Number(account.cachedBookBalance || 0);
  const actualBal = account.lastActualBalance !== null && account.lastActualBalance !== undefined
    ? Number(account.lastActualBalance) : bookBal;
  const diff = actualBal - bookBal;

  // ─── 수입/지출/현재잔액맞춤 빠른 등록 ──────────────────────────────
  const handleQuickTxSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (txAmount === '' || isNaN(Number(txAmount))) {
      showErr(txMode === 'MATCH' ? '현재 남은 실제 잔액을 입력해 주세요.' : '올바른 입출금 금액을 입력해 주세요.');
      return;
    }

    let amountNum = Number(txAmount);
    let finalTxIsIncome = txIsIncome;
    let finalCategory = txCategory;
    let finalTitle = txTitle.trim();

    if (txMode === 'MATCH') {
      const targetBal = amountNum;
      const balanceDiff = targetBal - bookBal;
      if (balanceDiff === 0) {
        showMsg('⚖️ 현재 장부 잔액과 입력하신 실제 잔액이 이미 완벽히 일치합니다!');
        return;
      }
      if (balanceDiff < 0) {
        finalTxIsIncome = false;
        amountNum = Math.abs(balanceDiff);
        finalCategory = '잔액 조정';
        finalTitle = finalTitle || '실제 잔액 맞춤 (지출 조정)';
      } else {
        finalTxIsIncome = true;
        amountNum = balanceDiff;
        finalCategory = '잔액 조정';
        finalTitle = finalTitle || '실제 잔액 맞춤 (수입 조정)';
      }
    } else {
      if (amountNum <= 0) {
        showErr('금액은 0보다 커야 합니다.');
        return;
      }
      finalTitle = finalTitle || (finalTxIsIncome ? '수기 입금' : '수기 출금');
    }

    const isDebtAccount = account.accountType === 'DEBT' || account.accountPurpose === 'CREDIT_LINE';
    if (!finalTxIsIncome && !isDebtAccount && bookBal - amountNum < 0 && txMode !== 'MATCH') {
      setWarningData({ accountName: account.accountName, bookBal, amountNum, shortfall: amountNum - bookBal });
      setIsWarningModalOpen(true);
      return;
    }

    try {
      setLoading(true);
      const dateIso = txDate ? `${txDate}:00` : new Date().toISOString().slice(0, 19);
      const saved = await createTransaction({
        accountId: account.accountId,
        amount: amountNum,
        transactionType: finalTxIsIncome ? 'INCOME' : 'EXPENSE',
        title: finalTitle,
        categoryId: finalCategory,
        currency: account.currency || 'KRW',
        memo: txMode === 'MATCH' ? `[잔액 맞춤] 장부 ${formatCurrency(bookBal)} → 실제 ${formatCurrency(txAmount)}` : '수기 입력',
        transactionDate: dateIso,
      });
      // 이력 타임라인에 즉시 추가
      setActivityLog((prev) => [
        {
          id: saved?.transactionId || Date.now(),
          type: finalTxIsIncome ? 'INCOME' : 'EXPENSE',
          title: finalTitle,
          amount: amountNum,
          categoryId: finalCategory,
          date: dateIso,
          memo: txMode === 'MATCH' ? '잔액 맞춤' : '수기 입력',
        },
        ...prev,
      ]);
      if (txMode === 'MATCH') {
        showMsg(`⚖️ 장부 잔액이 실제 잔액 ${formatCurrency(Number(txAmount))}으로 정확히 맞춰졌습니다! (차액 조정: ${finalTxIsIncome ? '+' : '-'}${formatCurrency(amountNum)})`);
      } else {
        showMsg(`✨ ${finalTxIsIncome ? '수입' : '지출'} ${formatCurrency(amountNum)}이 등록 및 통장에 반영되었습니다!`);
      }
      setTxAmount('');
      setTxTitle('');
      onUpdate();
      await loadAccountData();
    } catch (err) {
      showErr(err.response?.data?.message || '입출금 내역 저장 실패');
    } finally {
      setLoading(false);
    }
  };

  // ─── 거래 수정 영역 열기 ──────────────────────────────
  const openEditModal = (tx) => {
    setEditTarget(tx);
    const dateStr = tx.transactionDate
      ? new Date(tx.transactionDate).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);
    setEditForm({
      title: tx.title || '',
      amount: String(tx.amount || ''),
      transactionType: tx.transactionType || 'EXPENSE',
      categoryId: tx.categoryId || '기타',
      transactionDate: dateStr,
      memo: tx.memo || '',
    });
    setEditModalOpen(true);
  };

  // ─── 거래 수정 저장 ────────────────────────────────────
  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    try {
      setLoading(true);
      const dateIso = editForm.transactionDate ? `${editForm.transactionDate}:00` : undefined;
      await updateTransaction(editTarget.id || editTarget.transactionId, {
        title: editForm.title,
        amount: Number(editForm.amount),
        transactionType: editForm.transactionType,
        categoryId: editForm.categoryId,
        transactionDate: dateIso,
        memo: editForm.memo,
      });
      // 이력 타임라인에 수정 기록 추가
      setActivityLog((prev) => [
        {
          id: `edit-${Date.now()}`,
          type: 'EDIT',
          title: `"${editForm.title}" 내역 수정`,
          amount: Number(editForm.amount),
          categoryId: editForm.categoryId,
          date: new Date().toISOString(),
          memo: editForm.memo,
        },
        ...prev,
      ]);
      showMsg('✏️ 거래 내역이 수정되었습니다.');
      setEditModalOpen(false);
      setEditTarget(null);
      onUpdate();
      await loadAccountData();
    } catch (err) {
      showErr(err.response?.data?.message || '거래 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ─── 거래 삭제 ────────────────────────────────────────
  const handleDeleteTx = async (tx) => {
    if (!window.confirm(`"${tx.title}" 거래 내역을 삭제하시겠습니까?\n삭제 시 계좌 잔액이 역보정됩니다.`)) return;
    try {
      setLoading(true);
      await deleteTransaction(tx.transactionId || tx.id);
      setActivityLog((prev) => [
        {
          id: `del-${Date.now()}`,
          type: 'DELETE',
          title: `"${tx.title}" 내역 삭제`,
          amount: tx.amount,
          categoryId: tx.categoryId,
          date: new Date().toISOString(),
          memo: '',
        },
        ...prev.filter((a) => a.id !== (tx.transactionId || tx.id)),
      ]);
      showMsg('🗑️ 거래 내역이 삭제되었습니다.');
      onUpdate();
      await loadAccountData();
    } catch (err) {
      showErr(err.response?.data?.message || '거래 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 테이블 필터 + 페이징
  const filteredTransactions = transactions.filter((tx) => {
    if (filterTab === 'INCOME' && tx.transactionType !== 'INCOME') return false;
    if (filterTab === 'EXPENSE' && tx.transactionType !== 'EXPENSE') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (tx.title || '').toLowerCase().includes(q)
        || (tx.categoryId || '').toLowerCase().includes(q)
        || (tx.memo || '').toLowerCase().includes(q);
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / PAGE_SIZE));
  const pagedTransactions = filteredTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const monthlyIncome = Number(accountStats.monthlyIncomeTotal || 0);
  const monthlyExpense = Number(accountStats.monthlyExpenseTotal || 0);
  const monthlyNetFlow = monthlyIncome - monthlyExpense;
  const expenseRatio = monthlyIncome > 0 ? Math.min(100, Math.round((monthlyExpense / monthlyIncome) * 100)) : (monthlyExpense > 0 ? 100 : 0);
  const now = new Date();
  const monthlyExpenseTransactions = transactions.filter((tx) => {
    if (tx.transactionType !== 'EXPENSE' || !tx.transactionDate) return false;
    const transactionDate = new Date(tx.transactionDate);
    return transactionDate.getFullYear() === now.getFullYear()
      && transactionDate.getMonth() === now.getMonth();
  });
  const categoryMap = monthlyExpenseTransactions.reduce((result, tx) => {
    const category = (tx.categoryId || '기타').trim() || '기타';
    result.set(category, (result.get(category) || 0) + Number(tx.amount || 0));
    return result;
  }, new Map());
  const categoryTotal = Array.from(categoryMap.values()).reduce((sum, amount) => sum + amount, 0);
  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, amount], index) => ({
      category,
      amount,
      percentage: categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
    .sort((a, b) => b.amount - a.amount);
  const topExpenseCategory = categoryBreakdown[0];
  const latestActivity = activityLog[0];
  const latestActivityDate = latestActivity?.date
    ? new Date(latestActivity.date).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '아직 등록된 활동이 없습니다';
  const fixedExpenseTotal = fixedExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const handleSaveFixedExpense = async (event) => {
    event.preventDefault();
    if (!fixedExpenseForm.title.trim()) {
      showErr('고정지출 명칭을 입력해 주세요.');
      return;
    }
    if (!fixedExpenseForm.amount || Number(fixedExpenseForm.amount) <= 0) {
      showErr('고정지출 금액을 올바르게 입력해 주세요.');
      return;
    }
    if (!fixedExpenseForm.nextPaymentDate) {
      showErr('다음 결제일을 선택해 주세요.');
      return;
    }
    try {
      setLoading(true);
      const isEditing = Boolean(editingFixedExpenseId);
      const paymentDate = new Date(`${fixedExpenseForm.nextPaymentDate}T00:00:00`);
      const payload = {
        title: fixedExpenseForm.title.trim(),
        amount: Number(fixedExpenseForm.amount),
        paymentDayOfMonth: paymentDate.getDate(),
        nextPaymentDate: fixedExpenseForm.nextPaymentDate,
      };
      if (editingFixedExpenseId) {
        await updateFixedExpense(editingFixedExpenseId, payload);
      } else {
        await createFixedExpense({
          ...payload,
          currency: account.currency || 'KRW',
          accountId: account.accountId,
        });
      }
      setFixedExpenseForm({ title: '', amount: '', nextPaymentDate: localDateValue() });
      setEditingFixedExpenseId('');
      await loadAccountData();
      showMsg(isEditing ? '고정지출 정보가 수정되었습니다.' : '고정지출이 등록되었습니다. 결제 시점에 반영 버튼을 눌러 주세요.');
    } catch (err) {
      showErr(err.response?.data?.message || '고정지출 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFixedExpense = async (item) => {
    if (!window.confirm(`“${item.title}” ${formatCurrency(item.amount)}을 출금 거래로 반영하시겠습니까?`)) return;
    try {
      setProcessingFixedExpenseId(item.fixedExpenseId);
      await applyFixedExpense(item.fixedExpenseId, item.nextPaymentDate);
      await onUpdate();
      await loadAccountData();
      showMsg(`${item.title} 고정지출이 반영되었습니다. 거래 내역 탭에서도 확인할 수 있습니다.`);
    } catch (err) {
      showErr(err.response?.data?.message || '고정지출 반영에 실패했습니다.');
    } finally {
      setProcessingFixedExpenseId('');
    }
  };

  const handleStartFixedExpenseEdit = (item) => {
    setEditingFixedExpenseId(item.fixedExpenseId);
    setFixedExpenseForm({
      title: item.title || '',
      amount: String(item.amount || ''),
      nextPaymentDate: item.nextPaymentDate || localDateValue(),
    });
  };

  const handleCancelFixedExpenseEdit = () => {
    setEditingFixedExpenseId('');
    setFixedExpenseForm({ title: '', amount: '', nextPaymentDate: localDateValue() });
  };

  const handleDeactivateFixedExpense = async (item) => {
    if (!window.confirm(`“${item.title}” 고정지출 등록을 해제하시겠습니까?`)) return;
    try {
      setProcessingFixedExpenseId(item.fixedExpenseId);
      await deactivateFixedExpense(item.fixedExpenseId);
      if (editingFixedExpenseId === item.fixedExpenseId) handleCancelFixedExpenseEdit();
      await loadAccountData();
      showMsg('고정지출 등록이 해제되었습니다.');
    } catch (err) {
      showErr(err.response?.data?.message || '고정지출 해제에 실패했습니다.');
    } finally {
      setProcessingFixedExpenseId('');
    }
  };

  const renderManagementTabs = () => (
    <div className="investment-card-tabs" role="tablist" aria-label="입출금 거래 관리">
      <button type="button" role="tab" aria-selected={contentTab === 'TRANSACTIONS'} className={contentTab === 'TRANSACTIONS' ? 'is-active' : ''} onClick={() => setContentTab('TRANSACTIONS')}>거래 내역</button>
      <button type="button" role="tab" aria-selected={contentTab === 'FORM'} className={contentTab === 'FORM' ? 'is-active' : ''} onClick={() => setContentTab('FORM')}>입출금 등록</button>
      <button type="button" role="tab" aria-selected={contentTab === 'FIXED'} className={contentTab === 'FIXED' ? 'is-active' : ''} onClick={() => setContentTab('FIXED')}>고정지출</button>
    </div>
  );

  return (
    <div className="ledger-account-detail ledger-account-detail--checking space-y-5 animate-in fade-in duration-300">

      {/* ── 상단 헤더 */}
      <header className="ledger-account-detail__header">
        <div>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="ledger-account-detail__back"
          >
            ← 대시보드로
          </button>
          <div className="ledger-account-detail__title-row">
            <h1>{account.accountPurpose === 'CASH' ? '현금 / 지갑 상세' : account.accountPurpose === 'TRANSIT_CARD' ? '교통카드 / 선불 상세' : '입출금 계좌 상세'}</h1>
            <span>{account.currency}</span>
          </div>
          <p>
            {account.accountPurpose === 'CASH'
              ? '지갑 속 실물 현금 잔액과 지출/수입 내역을 관리합니다.'
              : account.accountPurpose === 'TRANSIT_CARD'
                ? '교통카드 잔액과 승차/충전 내역을 한눈에 관리합니다.'
                : '장부 잔액과 실제 계좌 잔액, 거래 내역을 한곳에서 관리합니다.'}
          </p>
        </div>

        <div className="ledger-account-detail__actions">
          <button type="button" className="is-transfer" onClick={() => onOpenTransfer?.(account)}>↔ 이체</button>
          <button type="button" className="is-reconcile" onClick={onOpenReconcile}>잔액 대조</button>
          <button type="button" onClick={() => onEditClick(account)}>계좌 수정</button>
        </div>
      </header>
      {editModalOpen && editTarget && (
        <InlineEditor title="거래 내역 수정" busy={loading} onClose={()=>setEditModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full p-5 space-y-4 border border-stone-200">
            <form onSubmit={handleEditSave} className="space-y-3">
              {/* 입출금 타입 */}
              <div className="flex gap-2">
                {[
                  { label: '📈 지출 (-)', val: 'EXPENSE', activeCls: 'bg-rose-500 text-white border-rose-500' },
                  { label: '📥 수입 (+)', val: 'INCOME', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
                ].map(({ label, val, activeCls }) => (
                  <button key={val} type="button"
                    onClick={() => setEditForm((f) => ({
                      ...f,
                      transactionType: val,
                      categoryId: val === 'INCOME' ? INCOME_CATEGORIES[0].value : EXPENSE_CATEGORIES[0].value,
                    }))}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      editForm.transactionType === val ? activeCls : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                    }`}>{label}</button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">거래처 / 제목</label>
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#527a8c]" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">금액</label>
                  <input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none font-bold" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {editForm.transactionType === 'INCOME' ? '수입 카테고리' : '지출 카테고리'}
                  </label>
                  <select value={editForm.categoryId} onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none">
                    {(editForm.transactionType === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">거래일시</label>
                  <input type="datetime-local" value={editForm.transactionDate} onChange={(e) => setEditForm((f) => ({ ...f, transactionDate: e.target.value }))}
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">메모</label>
                <textarea value={editForm.memo} onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none resize-none" />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800">
                ⚠️ 금액 수정 시 계좌 잔액이 자동으로 역보정 후 재반영됩니다.
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl">취소</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-[#527a8c] hover:bg-[#315362] text-white text-xs font-bold rounded-xl shadow-sm transition-all">
                  {loading ? '저장 중...' : '✏️ 수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </InlineEditor>
      )}

      {/* 알림 메시지 */}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold text-center animate-in fade-in">
          {message}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center animate-in fade-in">
          {errorMsg}
        </div>
      )}

      {/* ── HERO BANNER */}
      <div className="ledger-account-detail__overview ledger-investment-style-summary ledger-investment-style-summary--checking bg-gradient-to-r from-white via-[#faf6f0] to-[#f4ebe0] border border-[#a08c6e]/40 rounded-2xl p-5 shadow-sm">
        <AccountIdentityCard
          variant="checking"
          mark={account.accountPurpose === 'CASH' ? '💵' : account.accountPurpose === 'TRANSIT_CARD' ? '🚌' : '입출'}
          status={diff === 0 ? '대조 완료' : '대조 필요'}
          statusTone={diff === 0 ? 'success' : 'warning'}
          eyebrow={account.accountPurpose === 'CASH' ? '실물 현금 / 지갑' : account.accountPurpose === 'TRANSIT_CARD' ? '교통카드 / 선불카드' : '입출금 계좌'}
          accountName={account.accountName}
          bankName={account.bankName || (account.accountPurpose === 'CASH' ? '실물 지갑' : account.accountPurpose === 'TRANSIT_CARD' ? '교통 / 선불카드' : '금융기관 미등록')}
          accountNumber={account.accountNumberMasked || (account.accountPurpose === 'CASH' ? '지갑 보관' : account.accountPurpose === 'TRANSIT_CARD' ? '카드 번호 미등록' : '계좌번호 미등록')}
          tags={[
            { label: TYPE_LABELS[account.accountType] || account.accountType },
            { label: PURPOSE_LABELS[account.accountPurpose] || account.accountPurpose },
            { label: account.currency || 'KRW', tone: 'blue' },
          ]}
          footerLabel="마지막 대조"
          footerValue={account.lastReconciledAt
            ? new Date(account.lastReconciledAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '아직 대조하지 않음'}
          footerBadge={diff === 0 ? '일치' : '확인'}
        />

        <div className="grid grid-cols-5 gap-3 pt-3 border-t border-[#a08c6e]/20">
          {[
            { label: '장부 잔액', val: formatCurrency(bookBal), cls: 'text-stone-900' },
            { label: '실계좌 잔액', val: formatCurrency(actualBal), cls: 'text-stone-900' },
            { label: '대조 차액', val: diff === 0 ? '₩ 0' : `${diff > 0 ? '+' : ''}${formatCurrency(diff)}`, cls: diff === 0 ? 'text-emerald-600' : 'text-amber-600', badge: diff === 0 ? '대조 완료' : '⚠️ 대조 필요', badgeCls: diff === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-100 text-amber-800' },
            { label: '이번 달 입금', val: formatCurrency(accountStats.monthlyIncomeTotal), cls: 'text-emerald-700', labelCls: 'text-emerald-600' },
            { label: '이번 달 출금', val: formatCurrency(accountStats.monthlyExpenseTotal), cls: 'text-rose-700', labelCls: 'text-rose-600' },
            { label: '이번 달 거래', val: `${accountStats.monthlyTransactionCount}건`, cls: 'text-stone-900' },
          ].map((m, i) => (
            <div key={i} className="bg-white/90 p-3 rounded-xl border border-stone-200">
              <span className={`text-[11px] font-bold ${m.labelCls || 'text-stone-500'}`}>{m.label}</span>
              <div className={`font-serif font-bold text-lg mt-0.5 ${m.cls}`}>{m.val}</div>
              {m.badge && (
                <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${m.badgeCls}`}>
                  {m.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 중단 2열: 수기 작성 | 고정지출 */}
      <div className="ledger-investment-style-main ledger-investment-style-main--checking">
      <div className="ledger-investment-style-row grid grid-cols-12 gap-5">

        {/* 수입/지출 수기 작성 */}
        <div hidden={contentTab !== 'FORM'} className="ledger-investment-style-primary col-span-6 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="ledger-unified-tab-header">
            {renderManagementTabs()}
          </div>
          <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <h3 className="font-serif font-bold text-base text-stone-900">수입 / 지출 수기 작성</h3>
            </div>
            <span className="text-[11px] text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-full font-bold">
              이번 달 <strong className="text-[#43697a]">{accountStats.monthlyTransactionCount}건</strong>
            </span>
          </div>

          <form onSubmit={handleQuickTxSubmit} className="space-y-3">
            <div className="flex gap-1.5 w-full">
              {[
                { mode: 'EXPENSE', label: '📉 지출 (-)', activeCls: 'bg-rose-500 text-white border-rose-500' },
                { mode: 'INCOME', label: '📥 수입 (+)', activeCls: 'bg-emerald-600 text-white border-emerald-600' },
                { mode: 'MATCH', label: '🎯 현재 잔액 맞춤', activeCls: 'bg-[#43697a] text-white border-[#43697a]' },
              ].map(({ mode, label, activeCls }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setTxMode(mode);
                    if (mode === 'EXPENSE') {
                      setTxIsIncome(false);
                      setTxCategory(EXPENSE_CATEGORIES[0].value);
                    } else if (mode === 'INCOME') {
                      setTxIsIncome(true);
                      setTxCategory(INCOME_CATEGORIES[0].value);
                    } else {
                      setTxCategory('잔액 조정');
                    }
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                    txMode === mode ? activeCls : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* MATCH 모드 안내 카드 */}
            {txMode === 'MATCH' && (
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-2.5 text-xs text-stone-700 space-y-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-stone-500">현재 장부 잔액:</span>
                  <span className="font-bold text-stone-800">{formatCurrency(bookBal)}</span>
                </div>
                {txAmount !== '' && !isNaN(Number(txAmount)) && (
                  <div className="flex justify-between items-center pt-1 border-t border-sky-100 font-semibold text-[11px]">
                    <span className="text-sky-800">예상 자동 조정:</span>
                    <span className={Number(txAmount) - bookBal < 0 ? 'text-rose-600 font-bold' : Number(txAmount) - bookBal > 0 ? 'text-emerald-600 font-bold' : 'text-stone-600'}>
                      {Number(txAmount) - bookBal < 0
                        ? `지출 -${formatCurrency(Math.abs(Number(txAmount) - bookBal))}`
                        : Number(txAmount) - bookBal > 0
                        ? `수입 +${formatCurrency(Number(txAmount) - bookBal)}`
                        : '잔액 변동 없음 (일치)'}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {txMode === 'MATCH' ? `실제 현재 잔액 (${account.currency})` : `금액 (${account.currency})`}
                </label>
                <input
                  type="number"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  placeholder={txMode === 'MATCH' ? `현재 잔액 (예: ${bookBal})` : "예: 15,000"}
                  required
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#527a8c] font-bold text-stone-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {txMode === 'MATCH' ? '조정 사유 / 메모' : '거래처 / 메모'}
                </label>
                <input
                  type="text"
                  value={txTitle}
                  onChange={(e) => setTxTitle(e.target.value)}
                  placeholder={txMode === 'MATCH' ? "실제 잔액 맞춤" : "예: 스타벅스 강남점"}
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {txMode === 'MATCH' ? '카테고리' : (txMode === 'INCOME' ? '수입 카테고리' : '지출 카테고리')}
                </label>
                {txMode === 'MATCH' ? (
                  <input
                    type="text"
                    value="⚖️ 잔액 조정"
                    disabled
                    className="w-full px-3 py-1.5 text-xs bg-stone-100 border border-stone-200 rounded-xl text-stone-600 font-semibold cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                  >
                    {(txMode === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">거래일시</label>
                <input
                  type="datetime-local"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-stone-400">ℹ️ 수기 작성 내역은 장부 잔액에 즉시 반영됩니다.</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setTxAmount(''); setTxTitle(''); }}
                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl">🔄 초기화</button>
                <button type="submit" disabled={loading}
                  className="px-5 py-1.5 bg-[#008080] hover:bg-[#006666] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1">
                  <span>📝</span> 내역 저장
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 고정지출 등록 */}
        <div hidden={contentTab !== 'FIXED'} className="ledger-investment-style-primary ledger-fixed-expense-form-card col-span-6 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="ledger-unified-tab-header">{renderManagementTabs()}</div>
          <div className="ledger-fixed-expense-form-card__heading">
            <div><span>RECURRING EXPENSE</span><h3>{editingFixedExpenseId ? '고정지출 수정' : '고정지출 등록'}</h3></div>
            <p>등록 항목은 아래 표에서 반영·수정·삭제할 수 있습니다.</p>
          </div>
          <form onSubmit={handleSaveFixedExpense} className="ledger-fixed-expense-form">
            <label><span>지출 명칭 *</span><input type="text" value={fixedExpenseForm.title} onChange={(event) => setFixedExpenseForm((current) => ({ ...current, title: event.target.value }))} maxLength={100} placeholder="예: 넷플릭스, 월세, 보험료" /></label>
            <label><span>결제 금액 *</span><div className="ledger-fixed-expense-form__money"><input type="number" min="0" step="0.01" value={fixedExpenseForm.amount} onChange={(event) => setFixedExpenseForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" /><em>{account.currency}</em></div></label>
            <label><span>다음 결제일 *</span><input type="date" value={fixedExpenseForm.nextPaymentDate} onChange={(event) => setFixedExpenseForm((current) => ({ ...current, nextPaymentDate: event.target.value }))} /></label>
            <div className="ledger-fixed-expense-form__buttons">
              {editingFixedExpenseId && <button type="button" onClick={handleCancelFixedExpenseEdit}>취소</button>}
              <button type="submit" disabled={loading}>{loading ? '저장 중…' : editingFixedExpenseId ? '수정 저장' : '고정지출 저장'}</button>
            </div>
          </form>
          <div className="ledger-fixed-expense-table__header">
            <div><h3>등록된 고정지출</h3><span>{fixedExpenses.length}건 · 월 {formatCurrency(fixedExpenseTotal)}</span></div>
          </div>
          <div className="ledger-fixed-expense-table-wrap">
            <table className="ledger-fixed-expense-table">
              <thead><tr><th>지출 명칭</th><th>다음 결제일</th><th>금액</th><th>상태</th><th>관리</th></tr></thead>
              <tbody>
                {fixedExpenses.length === 0 ? (
                  <tr><td colSpan="5" className="is-empty">등록된 고정지출이 없습니다.</td></tr>
                ) : fixedExpenses.map((item) => {
                  const isProcessing = processingFixedExpenseId === item.fixedExpenseId;
                  const isDue = item.nextPaymentDate && item.nextPaymentDate <= localDateValue();
                  return (
                    <tr key={item.fixedExpenseId}>
                      <td><strong>{item.title}</strong></td>
                      <td>{item.nextPaymentDate ? new Date(`${item.nextPaymentDate}T00:00:00`).toLocaleDateString('ko-KR') : '-'}</td>
                      <td><strong>{formatCurrency(item.amount)}</strong></td>
                      <td><span className={isDue ? 'is-due' : 'is-scheduled'}>{isDue ? '반영 필요' : '예정'}</span></td>
                      <td><div className="ledger-fixed-expense-table__actions">
                        <button type="button" className="is-apply" disabled={isProcessing} onClick={() => handleApplyFixedExpense(item)}>반영</button>
                        <button type="button" className="is-edit" disabled={isProcessing} onClick={() => handleStartFixedExpenseEdit(item)}>수정</button>
                        <button type="button" className="is-delete" disabled={isProcessing} onClick={() => handleDeactivateFixedExpense(item)}>삭제</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 하단 2열: 거래 내역 테이블 | 이번 달 현금 흐름 */}
      <div className="ledger-investment-style-row grid grid-cols-12 gap-5">

        {/* 최근 거래 내역 테이블 */}
        <div hidden={contentTab !== 'TRANSACTIONS'} className="ledger-investment-style-primary col-span-8 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="ledger-unified-tab-header">
            {renderManagementTabs()}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-base text-stone-900">최근 거래 내역</h3>
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                {['ALL', 'INCOME', 'EXPENSE'].map((t) => (
                  <button key={t} type="button" onClick={() => { setFilterTab(t); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${filterTab === t ? 'bg-[#527a8c] text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}>
                    {t === 'ALL' && '전체'}{t === 'INCOME' && '입금'}{t === 'EXPENSE' && '출금'}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="거래처, 메모 검색"
              className="px-3 py-1 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none w-44" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-bold bg-stone-50/70">
                  <th className="py-2.5 px-3">날짜</th>
                  <th className="py-2.5 px-3">구분</th>
                  <th className="py-2.5 px-3">거래처 / 제목</th>
                  <th className="py-2.5 px-3">카테고리</th>
                  <th className="py-2.5 px-3">사유 / 메모</th>
                  <th className="py-2.5 px-3 text-right">금액</th>
                  <th className="py-2.5 px-3 text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {pagedTransactions.length === 0 ? (
                  <tr><td colSpan="7" className="py-8 text-center text-stone-400 text-xs">등록된 거래 내역이 없습니다.</td></tr>
                ) : (
                  pagedTransactions.map((tx) => {
                    const isInc = tx.transactionType === 'INCOME';
                    const isTransfer = tx.transactionType === 'TRANSFER';
                    const transferIn = isTransfer && tx.transferDirection === 'IN';
                    return (
                      <tr key={tx.transactionId} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-stone-500 font-mono text-[11px]">
                          {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : '오늘'}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span className={`inline-flex items-center gap-1 text-[11px] ${isTransfer ? 'text-sky-700' : isInc ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isTransfer ? `↔ 이체 ${transferIn ? '입금' : '출금'}` : isInc ? '↓ 입금' : '↑ 출금'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-stone-900">{tx.title}</td>
                        <td className="py-2.5 px-3 text-stone-500 text-[11px]">{tx.categoryId || '기타'}</td>
                        <td className="py-2.5 px-3 text-stone-500 text-[11px] max-w-48 truncate" title={tx.memo || ''}>{tx.memo || '-'}</td>
                        <td className={`py-2.5 px-3 text-right font-serif font-bold ${transferIn || isInc ? 'text-emerald-700' : 'text-stone-900'}`}>
                          {transferIn || isInc ? '+' : '-'} {formatCurrency(tx.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isTransfer ? <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1">연결 거래</span> : <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(tx)}
                              title="수정"
                              className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                            >
                              ✏️ 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx)}
                              title="삭제"
                              className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100 transition-colors"
                            >
                              🗑️
                            </button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 페이징 바 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
              <span className="text-[11px] text-stone-400">
                전체 {filteredTransactions.length}건 중 {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredTransactions.length)}건
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-2 py-1 text-[11px] font-bold rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ‹ 이전
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && arr[idx - 1] !== p - 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-stone-400 text-[11px]">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 text-[11px] font-bold rounded-lg border transition-all ${
                          currentPage === p
                            ? 'bg-[#527a8c] text-white border-[#527a8c] shadow-xs'
                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-2 py-1 text-[11px] font-bold rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  다음 ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 이번 달 현금 흐름 */}
        <div className="ledger-support-card col-span-4 space-y-4">
          <div className="ledger-support-card__header">
            <div>
              <span className="ledger-support-card__eyebrow">MONTHLY FLOW</span>
              <h3>{cashFlowTab === 'FLOW' ? '이번 달 현금 흐름' : '이번 달 소비 구성'}</h3>
            </div>
            <span className="ledger-support-card__status">{accountStats.monthlyTransactionCount}건</span>
          </div>
          <div className="ledger-support-card__tabs" role="tablist" aria-label="이번 달 지출 요약">
            <button type="button" role="tab" aria-selected={cashFlowTab === 'FLOW'} className={cashFlowTab === 'FLOW' ? 'is-active' : ''} onClick={() => setCashFlowTab('FLOW')}>현금 흐름</button>
            <button type="button" role="tab" aria-selected={cashFlowTab === 'CATEGORY'} className={cashFlowTab === 'CATEGORY' ? 'is-active' : ''} onClick={() => setCashFlowTab('CATEGORY')}>소비 구성</button>
          </div>
          {cashFlowTab === 'FLOW' ? <>
            <div className="ledger-support-card__hero ledger-support-card__hero--checking">
              <span>순현금흐름</span>
              <strong className={monthlyNetFlow >= 0 ? 'is-positive' : 'is-negative'}>
                {monthlyNetFlow > 0 ? '+' : ''}{formatCurrency(monthlyNetFlow)}
              </strong>
              <p>{monthlyNetFlow >= 0 ? '입금이 출금보다 많습니다.' : '이번 달은 출금이 입금보다 많습니다.'}</p>
            </div>
            <div className="ledger-support-card__grid">
              <div><span>입금</span><strong className="is-positive">+{formatCurrency(monthlyIncome)}</strong></div>
              <div><span>출금</span><strong className="is-negative">-{formatCurrency(monthlyExpense)}</strong></div>
            </div>
            <div className="ledger-support-card__ratio">
              <div><span>입금 대비 출금</span><strong>{expenseRatio}%</strong></div>
              <div className="ledger-support-card__progress"><span style={{ width: `${expenseRatio}%` }} /></div>
            </div>
            <div className="ledger-support-card__latest">
              <span>잔액 대조</span>
              <strong className={diff === 0 ? 'is-positive' : 'is-warning'}>{diff === 0 ? '일치' : `${formatCurrency(Math.abs(diff))} 차이`}</strong>
            </div>
            <div className="ledger-support-card__latest">
              <span>최근 활동</span>
              <strong>{latestActivity?.title || latestActivityDate}</strong>
              {latestActivity && <small>{latestActivityDate}</small>}
            </div>
          </> : <>
            <div className="ledger-support-card__hero ledger-support-card__hero--checking">
              <span>이번 달 총 소비</span>
              <strong className="is-negative">{formatCurrency(categoryTotal)}</strong>
              <p>{topExpenseCategory ? `${topExpenseCategory.category} 지출이 ${topExpenseCategory.percentage}%로 가장 큽니다.` : '아직 이번 달 소비 내역이 없습니다.'}</p>
            </div>
            <div className="ledger-category-breakdown">
              {categoryBreakdown.length === 0 ? (
                <div className="ledger-category-breakdown__empty"><span>✓</span><p>지출을 등록하면 카테고리별 소비 비중이 표시됩니다.</p></div>
              ) : categoryBreakdown.map((item) => (
                <div key={item.category} className="ledger-category-breakdown__item">
                  <div className="ledger-category-breakdown__label"><span style={{ backgroundColor: item.color }} /><strong>{item.category}</strong><em>{item.percentage}%</em></div>
                  <div className="ledger-category-breakdown__amount"><span><i style={{ width: `${item.percentage}%`, backgroundColor: item.color }} /></span><strong>{formatCurrency(item.amount)}</strong></div>
                </div>
              ))}
            </div>
            <div className="ledger-support-card__latest">
              <span>지출 건수</span>
              <strong>{monthlyExpenseTransactions.length}건</strong>
            </div>
          </>}
        </div>
      </div>

      </div>

      {/* ── 거래 수정 영역 */}


      {/* ── 잔액 부족 경고 모달 */}
      {isWarningModalOpen && warningData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white border-2 border-rose-300 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-stone-200 pb-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="font-serif font-bold text-lg text-stone-900">잔액 부족 출금 차단</h3>
                <p className="text-xs text-rose-600 font-semibold">마이너스 잔액이 허용되지 않는 계좌입니다.</p>
              </div>
            </div>
            <div className="bg-rose-50/80 p-4 rounded-xl border border-rose-200 space-y-2 text-xs">
              {[
                { l: '대상 계좌', v: warningData.accountName, cls: 'text-stone-900' },
                { l: '현재 장부 잔액', v: formatCurrency(warningData.bookBal), cls: 'text-emerald-700 font-serif' },
                { l: '요청 지출 금액', v: `- ${formatCurrency(warningData.amountNum)}`, cls: 'text-rose-600 font-serif' },
              ].map(({ l, v, cls }) => (
                <div key={l} className="flex justify-between">
                  <span className="text-stone-600 font-bold">{l}:</span>
                  <span className={`font-bold ${cls}`}>{v}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-rose-200 flex justify-between font-bold text-sm">
                <span className="text-rose-800">부족 금액:</span>
                <span className="text-rose-700 font-serif">{formatCurrency(warningData.shortfall)}</span>
              </div>
            </div>
            <p className="text-[11px] text-stone-500">💡 일반 입출금/저축 계좌는 잔액이 0원 미만으로 내려갈 수 없습니다.</p>
            <button type="button" onClick={() => setIsWarningModalOpen(false)}
              className="w-full py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-md transition-all">
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
