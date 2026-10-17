import InlineEditor from "../workspace/InlineEditor";
import React, { useState, useEffect, useCallback } from 'react';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionsByAccount,
  getAccountStats,
} from '../../api/ledger';
import AccountIdentityCard from './shared/AccountIdentityCard';

const PURPOSE_LABELS = {
  INSTALLMENT_SAVINGS: '적금',
  TIME_DEPOSIT: '정기예금',
  FREE_SAVINGS: '자유저축',
};

const SAVINGS_INCOME_CATEGORIES = [
  { value: '저축 납입', label: '💰 저축 납입' },
  { value: '이자 수령', label: '📈 이자 수령' },
  { value: '기타 입금', label: '✨ 기타 입금' },
];

const SAVINGS_EXPENSE_CATEGORIES = [
  { value: '출금', label: '📤 일반 출금' },
  { value: '중도 인출', label: '💸 중도 인출' },
  { value: '만기 해지', label: '🏁 만기 해지' },
  { value: '기타 출금', label: '📌 기타 출금' },
];

// ── 이자 계산 (고정값 표시용) ──────────────────────────────────────
function calcMaturityFixed({ principal, monthlyPayment, interestRate, months, interestType, accountPurpose }) {
  const rate = Number(interestRate || 0) / 100;
  const p = Number(principal || 0);
  const mp = Number(monthlyPayment || 0);
  const n = Number(months || 12);
  if (!rate || n <= 0) return null;

  let maturityAmount = 0;
  let totalInterest = 0;

  if (accountPurpose === 'INSTALLMENT_SAVINGS' && mp > 0) {
    // 월 납입 적금 이자
    for (let m = 1; m <= n; m++) {
      totalInterest += mp * rate * ((n - m + 1) / 12);
    }
    // 기존 잔액이 있다면 그에 대한 이자도 가산
    if (p > 0) {
      totalInterest += p * rate * (n / 12);
    }
    maturityAmount = p + (mp * n) + totalInterest;
  } else if (interestType === 'COMPOUND') {
    maturityAmount = p * Math.pow(1 + rate / 12, n);
    totalInterest = maturityAmount - p;
  } else {
    totalInterest = p * rate * (n / 12);
    maturityAmount = p + totalInterest;
  }

  return {
    maturityAmount: Math.round(maturityAmount),
    totalInterest: Math.round(totalInterest),
    monthlyInterest: Math.round(totalInterest / Math.max(1, n)),
  };
}

export default function SavingsAccountView({ account, onUpdate, onEditClick, onOpenReconcile, onOpenTransfer, onBackToDashboard }) {
  const [transactions, setTransactions] = useState([]);
  const [accountStats, setAccountStats] = useState({ monthlyIncomeTotal: 0, monthlyExpenseTotal: 0, monthlyTransactionCount: 0 });
  const [activityLog, setActivityLog] = useState([]);

  // 납입 폼
  const [txAmount, setTxAmount] = useState('');
  const [txIsIncome, setTxIsIncome] = useState(true);
  const [txCategory, setTxCategory] = useState('저축 납입');
  const [txTitle, setTxTitle] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().slice(0, 16));

  // 거래 내역 필터/페이징
  const [filterTab, setFilterTab] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [contentTab, setContentTab] = useState('TRANSACTIONS');
  const PAGE_SIZE = 5;

  // 수정 영역
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', amount: '', transactionType: 'INCOME',
    categoryId: '저축 납입', transactionDate: '', memo: '',
  });

  const [loading, setLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showMsg = (m) => { setMessage(m); setTimeout(() => setMessage(''), 4000); };
  const showErr = (m) => { setErrorMsg(m); setTimeout(() => setErrorMsg(''), 6000); };

  const loadData = useCallback(async () => {
    if (!account?.accountId) return;
    try {
      const [txData, statsData] = await Promise.all([
        getTransactionsByAccount(account.accountId),
        getAccountStats(account.accountId),
      ]);
      const txList = txData || [];
      setTransactions(txList);
      setAccountStats(statsData || { monthlyIncomeTotal: 0, monthlyExpenseTotal: 0, monthlyTransactionCount: 0 });
      setActivityLog(
        txList
          .map((tx) => ({ ...tx, id: tx.transactionId, date: tx.transactionDate || tx.createdAt, type: tx.transactionType }))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      );
    } catch (err) { console.error(err); }
  }, [account?.accountId]);

  useEffect(() => {
    if (account) loadData();
  }, [account, loadData]);

  if (!account) return null;

  const fmt = (val) => {
    const n = Number(val || 0);
    if (account.currency === 'JPY') return `¥${n.toLocaleString()}`;
    if (account.currency === 'USD') return `$${n.toLocaleString()}`;
    return `₩${n.toLocaleString()}`;
  };

  const bookBal = Number(account.cachedBookBalance || 0);
  const targetBal = Number(account.targetBalance || 0);
  const goalPct = targetBal > 0 ? Math.min(100, Math.round((bookBal / targetBal) * 100)) : 0;
  const monthlyAmt = Number(account.monthlyPayment || 0);

  // 만기 D-day & 개월수
  const dDay = account.maturityDate
    ? Math.max(0, Math.ceil((new Date(account.maturityDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;
  const startDate = account.initialBalanceDate ? new Date(account.initialBalanceDate) : account.createdAt ? new Date(account.createdAt) : new Date();
  const totalMonths = account.maturityDate
    ? Math.max(1, Math.round((new Date(account.maturityDate) - startDate) / (1000 * 60 * 60 * 24 * 30.44)))
    : 12;

  // 예상 이자 계산 (등록값 기반, 읽기전용)
  const interestResult = calcMaturityFixed({
    principal: bookBal,
    monthlyPayment: account.monthlyPayment,
    interestRate: account.interestRate,
    months: totalMonths,
    interestType: account.interestType,
    accountPurpose: account.accountPurpose,
  });

  // 이번 달 납입 여부
  const nowDate = new Date();
  const thisMonthLabel = `${nowDate.getFullYear()}년 ${nowDate.getMonth() + 1}월`;
  const alreadyPaidThisMonth = transactions.some((tx) => {
    if (tx.transactionType !== 'INCOME') return false;
    const d = new Date(tx.transactionDate || tx.createdAt);
    return d.getFullYear() === nowDate.getFullYear()
      && d.getMonth() === nowDate.getMonth()
      && (tx.categoryId === '저축 납입' || tx.title?.includes('납입'));
  });

  // 이번 달 납부 즉시 처리
  const handleQuickPay = async () => {
    if (!monthlyAmt || alreadyPaidThisMonth) return;
    setPayLoading(true);
    try {
      const dateIso = new Date().toISOString().slice(0, 19);
      const saved = await createTransaction({
        accountId: account.accountId,
        amount: monthlyAmt,
        transactionType: 'INCOME',
        title: `${thisMonthLabel} 정기 납입`,
        categoryId: '저축 납입',
        currency: account.currency || 'KRW',
        memo: '월 자동이체',
        transactionDate: dateIso,
      });
      setActivityLog((prev) => [{
        id: saved?.transactionId || Date.now(),
        transactionId: saved?.transactionId,
        type: 'INCOME', transactionType: 'INCOME',
        title: `${thisMonthLabel} 정기 납입`,
        amount: monthlyAmt, categoryId: '저축 납입',
        date: dateIso, transactionDate: dateIso,
      }, ...prev]);
      showMsg(`✅ ${thisMonthLabel} 납입 ${fmt(monthlyAmt)} 완료!`);
      onUpdate(); await loadData();
    } catch (err) { showErr(err.response?.data?.message || '납입 실패'); }
    finally { setPayLoading(false); }
  };

  // 납입/출금 등록
  const handleTxSubmit = async (e) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) { showErr('금액을 입력하세요.'); return; }
    try {
      setLoading(true);
      const dateIso = txDate ? `${txDate}:00` : new Date().toISOString().slice(0, 19);
      const saved = await createTransaction({
        accountId: account.accountId,
        amount: Number(txAmount),
        transactionType: txIsIncome ? 'INCOME' : 'EXPENSE',
        title: txTitle.trim() || (txIsIncome ? txCategory : '출금'),
        categoryId: txCategory,
        currency: account.currency || 'KRW',
        memo: '수기 입력',
        transactionDate: dateIso,
      });
      setActivityLog((prev) => [{
        id: saved?.transactionId || Date.now(), transactionId: saved?.transactionId,
        type: txIsIncome ? 'INCOME' : 'EXPENSE', transactionType: txIsIncome ? 'INCOME' : 'EXPENSE',
        title: txTitle.trim() || txCategory, amount: Number(txAmount),
        categoryId: txCategory, date: dateIso, transactionDate: dateIso,
      }, ...prev]);
      showMsg(`✨ ${fmt(txAmount)} 등록 완료!`);
      setTxAmount(''); setTxTitle('');
      onUpdate(); await loadData();
      setContentTab('TRANSACTIONS');
    } catch (err) { showErr(err.response?.data?.message || '등록 실패'); }
    finally { setLoading(false); }
  };

  // 수정 영역
  const openEditModal = (tx) => {
    setEditTarget(tx);
    setEditForm({
      title: tx.title || '',
      amount: String(Number(tx.amount) || ''),
      transactionType: tx.transactionType || tx.type || 'INCOME',
      categoryId: tx.categoryId || '저축 납입',
      transactionDate: tx.transactionDate ? new Date(tx.transactionDate).toISOString().slice(0, 16) : '',
      memo: tx.memo || '',
    });
    setEditModalOpen(true);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    const txId = editTarget.transactionId || editTarget.id;
    try {
      setLoading(true);
      const dateIso = editForm.transactionDate ? `${editForm.transactionDate}:00` : undefined;
      await updateTransaction(txId, {
        title: editForm.title, amount: Number(editForm.amount),
        transactionType: editForm.transactionType, categoryId: editForm.categoryId,
        transactionDate: dateIso, memo: editForm.memo,
      });
      showMsg('✏️ 수정 완료');
      setEditModalOpen(false);
      onUpdate(); await loadData();
    } catch (err) { showErr(err.response?.data?.message || '수정 실패'); }
    finally { setLoading(false); }
  };

  const handleDeleteTx = async (tx) => {
    if (!window.confirm(`"${tx.title}" 내역을 삭제할까요?`)) return;
    try {
      setLoading(true);
      await deleteTransaction(tx.transactionId || tx.id);
      setActivityLog((prev) => prev.filter((a) => (a.transactionId || a.id) !== (tx.transactionId || tx.id)));
      showMsg('삭제 완료');
      onUpdate(); await loadData();
    } catch (err) { showErr(err.response?.data?.message || '삭제 실패'); }
    finally { setLoading(false); }
  };

  // 거래 내역 필터/페이징
  const filtered = transactions.filter((tx) => {
    if (filterTab === 'INCOME' && tx.transactionType !== 'INCOME') return false;
    if (filterTab === 'EXPENSE' && tx.transactionType !== 'EXPENSE') return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const remainingTarget = Math.max(targetBal - bookBal, 0);
  const latestDeposit = activityLog.find((entry) => entry.type === 'INCOME');
  const latestDepositDate = latestDeposit?.date
    ? new Date(latestDeposit.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : '아직 납입 내역이 없습니다';

  return (
    <div className="ledger-account-detail ledger-account-detail--savings space-y-4 animate-in fade-in duration-300">

      {/* ── 헤더 */}
      <header className="ledger-account-detail__header">
        <div>
          <button type="button" onClick={onBackToDashboard} className="ledger-account-detail__back">← 대시보드로</button>
          <div className="ledger-account-detail__title-row"><h1>{PURPOSE_LABELS[account.accountPurpose] || '저축'} 계좌 상세</h1><span>{account.currency}</span></div>
          <p>납입 현황과 목표 달성률, 예상 이자를 한곳에서 관리합니다.</p>
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
              <div className="flex gap-2">
                {[{ label: '📥 입금', val: 'INCOME', cls: 'bg-emerald-600 text-white border-emerald-600' },
                  { label: '📤 출금', val: 'EXPENSE', cls: 'bg-rose-500 text-white border-rose-500' }].map(({ label, val, cls }) => (
                  <button key={val} type="button" onClick={() => setEditForm((f) => ({ ...f, transactionType: val, categoryId: (val === 'INCOME' ? SAVINGS_INCOME_CATEGORIES : SAVINGS_EXPENSE_CATEGORIES)[0].value }))}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${editForm.transactionType === val ? cls : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">제목</label>
                  <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} required
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#7766a7]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">금액</label>
                  <input type="number" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} required
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none font-bold focus:border-[#7766a7]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">카테고리</label>
                  <select value={editForm.categoryId} onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none">
                    {!(editForm.transactionType === 'INCOME' ? SAVINGS_INCOME_CATEGORIES : SAVINGS_EXPENSE_CATEGORIES).some(c=>c.value===editForm.categoryId)&&<option value={editForm.categoryId}>{editForm.categoryId}</option>}{(editForm.transactionType === 'INCOME' ? SAVINGS_INCOME_CATEGORIES : SAVINGS_EXPENSE_CATEGORIES).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">거래일시</label>
                  <input type="datetime-local" value={editForm.transactionDate} onChange={(e) => setEditForm((f) => ({ ...f, transactionDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none" />
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-800">
                ⚠️ 금액 수정 시 계좌 잔액이 자동 역보정 후 재반영됩니다.
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl">취소</button>
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-[#7766a7] hover:bg-[#58477f] text-white text-xs font-bold rounded-xl shadow-sm">
                  {loading ? '저장 중...' : '✏️ 수정 완료'}
                </button>
              </div>
            </form>
          </div>
        </InlineEditor>
      )}

      {message && <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold text-center">{message}</div>}
      {errorMsg && <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold text-center">{errorMsg}</div>}

      <section className="ledger-investment-style-summary ledger-investment-style-summary--savings">
      <AccountIdentityCard
        variant="savings"
        mark="적금"
        status={dDay === null ? '만기 미설정' : dDay >= 0 ? `만기 D-${dDay}` : '만기 도래'}
        statusTone={dDay !== null && dDay <= 30 ? 'warning' : 'neutral'}
        eyebrow="저축 계좌"
        accountName={account.accountName}
        bankName={account.bankName}
        accountNumber={account.accountNumberMasked}
        tags={[
          { label: PURPOSE_LABELS[account.accountPurpose] || account.accountPurpose },
          account.interestRate ? { label: `연 ${account.interestRate}% ${account.interestType === 'COMPOUND' ? '복리' : '단리'}` } : null,
          { label: account.currency || 'KRW', tone: 'blue' },
        ]}
        footerLabel="현재 잔액"
        footerValue={fmt(bookBal)}
        footerBadge={targetBal > 0 ? `목표 ${goalPct}%` : '목표 미설정'}
      />

      {/* ── 통계 카드 4개 (마지막: 납입 버튼) */}
      <div className="grid grid-cols-4 gap-3">
        {/* 이번 달 입금 */}
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-stone-500 font-bold">이번 달 입금</div>
          <div className="font-serif font-bold text-base text-emerald-700 mt-1">{fmt(accountStats.monthlyIncomeTotal)}</div>
        </div>
        {/* 이번 달 출금 */}
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-stone-500 font-bold">이번 달 출금</div>
          <div className="font-serif font-bold text-base text-stone-800 mt-1">{fmt(accountStats.monthlyExpenseTotal)}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-xs">
          <div className="text-[11px] text-stone-500 font-bold">이번 달 거래</div>
          <div className="font-serif font-bold text-base text-stone-800 mt-1">{accountStats.monthlyTransactionCount}건</div>
        </div>
        {/* 월 납입 버튼 카드 */}
        <div className={`rounded-2xl p-3.5 shadow-xs border flex flex-col justify-between ${
          alreadyPaidThisMonth
            ? 'bg-emerald-50 border-emerald-200'
            : monthlyAmt > 0
            ? 'bg-gradient-to-br from-[#f4f1fa] to-[#eeebf7] border-[#d8d0e8]'
            : 'bg-stone-50 border-stone-200'
        }`}>
          <div>
            <div className="text-[11px] text-stone-500 font-bold">{thisMonthLabel} 납입</div>
            <div className="font-serif font-bold text-base mt-1 text-stone-800">
              {monthlyAmt > 0 ? fmt(monthlyAmt) : <span className="text-stone-400 text-xs">미설정</span>}
            </div>
          </div>
          {monthlyAmt > 0 ? (
            <button
              type="button"
              onClick={handleQuickPay}
              disabled={alreadyPaidThisMonth || payLoading}
              className={`mt-2 w-full py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                alreadyPaidThisMonth
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default'
                  : 'bg-[#7766a7] hover:bg-[#58477f] text-white shadow-xs active:scale-95'
              }`}
            >
              {payLoading ? (
                <span className="animate-pulse">처리 중...</span>
              ) : alreadyPaidThisMonth ? (
                <><span className="text-base">✅</span> 납입 완료</>
              ) : (
                <><span>💳</span> 납부</>
              )}
            </button>
          ) : (
            <button type="button" onClick={() => onEditClick(account)}
              className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200 transition-all">
              ⚙️ 설정
            </button>
          )}
        </div>
      </div>
      </section>

      {/* ── 납입 폼 | 계좌 내 이력 */}
      <div className="ledger-investment-style-main ledger-investment-style-main--savings">
      <div className="ledger-investment-style-row grid grid-cols-12 gap-4">
        {/* 납입/출금 폼 */}
        <div hidden={contentTab !== 'FORM'} className="ledger-investment-style-primary col-span-7 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="ledger-unified-tab-header">
            <div className="investment-card-tabs" role="tablist" aria-label="적금 거래 관리">
              <button type="button" role="tab" aria-selected={contentTab === 'TRANSACTIONS'} className={contentTab === 'TRANSACTIONS' ? 'is-active' : ''} onClick={() => setContentTab('TRANSACTIONS')}>거래 내역</button>
              <button type="button" role="tab" aria-selected={contentTab === 'FORM'} className={contentTab === 'FORM' ? 'is-active' : ''} onClick={() => setContentTab('FORM')}>입출금 등록</button>
            </div>
          </div>
          <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
            <span>📝</span>
            <h3 className="font-serif font-bold text-sm text-stone-900">내역 등록</h3>
          </div>
          <form onSubmit={handleTxSubmit} className="space-y-2.5">
            <div className="flex gap-2">
              <button type="button" onClick={() => {
                setTxIsIncome(true);
                setTxCategory(SAVINGS_INCOME_CATEGORIES[0].value);
              }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${txIsIncome ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                📥 입금
              </button>
              <button type="button" onClick={() => {
                setTxIsIncome(false);
                setTxCategory(SAVINGS_EXPENSE_CATEGORIES[0].value);
              }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${!txIsIncome ? 'bg-rose-500 text-white border-rose-500' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                📤 출금
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">금액</label>
                <input type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0" required
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-emerald-500 font-bold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">메모</label>
                <input type="text" value={txTitle} onChange={(e) => setTxTitle(e.target.value)} placeholder="선택 입력"
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">{txIsIncome ? '입금 카테고리' : '출금 카테고리'}</label>
                <select value={txCategory} onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none">
                  {(txIsIncome ? SAVINGS_INCOME_CATEGORIES : SAVINGS_EXPENSE_CATEGORIES).map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">거래일시</label>
                <input type="datetime-local" value={txDate} onChange={(e) => setTxDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-0.5">
              <button type="button" onClick={() => { setTxAmount(''); setTxTitle(''); }}
                className="px-3 py-1.5 bg-stone-100 text-stone-600 text-xs font-bold rounded-xl hover:bg-stone-200">초기화</button>
              <button type="submit" disabled={loading}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all">
                📝 저장
              </button>
            </div>
          </form>
        </div>

        {/* 납입 계획 */}
        <div className="ledger-support-card col-span-5 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
          <div className="ledger-support-card__header">
            <div>
              <span className="ledger-support-card__eyebrow">SAVING PLAN</span>
              <h3>납입 계획</h3>
            </div>
            <span className={`ledger-support-card__status ${alreadyPaidThisMonth ? 'is-complete' : ''}`}>
              {alreadyPaidThisMonth ? '이번 달 완료' : '납입 예정'}
            </span>
          </div>
          <div className="ledger-support-card__hero">
            <span>월 납입 예정액</span>
            <strong>{monthlyAmt > 0 ? fmt(monthlyAmt) : '미설정'}</strong>
            <p>{monthlyAmt > 0 ? `${thisMonthLabel} 납입 계획` : '계좌 수정에서 월 납입액을 설정해 주세요.'}</p>
          </div>
          <div className="ledger-support-card__grid">
            <div><span>목표까지 남은 금액</span><strong>{targetBal > 0 ? fmt(remainingTarget) : '목표 미설정'}</strong></div>
            <div><span>목표 달성률</span><strong>{targetBal > 0 ? `${goalPct}%` : '-'}</strong></div>
          </div>
          <div className="ledger-support-card__progress" aria-label={`목표 달성률 ${goalPct}%`}>
            <span style={{ width: `${targetBal > 0 ? goalPct : 0}%` }} />
          </div>
          <div className="ledger-support-card__latest">
            <span>최근 납입</span>
            <strong>{latestDepositDate}</strong>
          </div>
        </div>
      </div>

      {/* ── 거래 내역(좌) + 예상 이자 정보(우) */}
      <div className="ledger-investment-style-row grid grid-cols-12 gap-4">

        {/* 거래 내역 테이블 */}
        <div hidden={contentTab !== 'TRANSACTIONS'} className="ledger-investment-style-primary col-span-8 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="ledger-unified-tab-header">
            <div className="investment-card-tabs" role="tablist" aria-label="적금 거래 관리">
              <button type="button" role="tab" aria-selected={contentTab === 'TRANSACTIONS'} className={contentTab === 'TRANSACTIONS' ? 'is-active' : ''} onClick={() => setContentTab('TRANSACTIONS')}>거래 내역</button>
              <button type="button" role="tab" aria-selected={contentTab === 'FORM'} className={contentTab === 'FORM' ? 'is-active' : ''} onClick={() => setContentTab('FORM')}>입출금 등록</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-sm text-stone-900">거래 내역</h3>
              <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                {['ALL', 'INCOME', 'EXPENSE'].map((t) => (
                  <button key={t} type="button" onClick={() => { setFilterTab(t); setCurrentPage(1); }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all ${filterTab === t ? 'bg-[#7766a7] text-white' : 'text-stone-600'}`}>
                    {t === 'ALL' ? '전체' : t === 'INCOME' ? '입금' : '출금'}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[11px] text-stone-400">{filtered.length}건</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-bold bg-stone-50/60 text-[11px]">
                <th className="py-2 px-2">날짜</th>
                <th className="py-2 px-2">제목</th>
                <th className="py-2 px-2">카테고리</th>
                <th className="py-2 px-2">사유 / 메모</th>
                <th className="py-2 px-2 text-right">금액</th>
                <th className="py-2 px-2 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {paged.length === 0
                ? <tr><td colSpan="6" className="py-6 text-center text-stone-400 text-xs">거래 내역이 없습니다.</td></tr>
                : paged.map((tx) => {
                    const isInc = tx.transactionType === 'INCOME';
                    const isTransfer = tx.transactionType === 'TRANSFER';
                    const transferIn = isTransfer && tx.transferDirection === 'IN';
                    return (
                      <tr key={tx.transactionId} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-2 px-2 text-stone-400 font-mono text-[10px]">
                          {tx.transactionDate ? new Date(tx.transactionDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-2 px-2 font-bold text-stone-900 text-[11px]">{tx.title}</td>
                        <td className="py-2 px-2 text-stone-400 text-[10px]">{tx.categoryId || '-'}</td>
                        <td className="py-2 px-2 text-stone-500 text-[10px] max-w-40 truncate" title={tx.memo || ''}>{tx.memo || '-'}</td>
                        <td className={`py-2 px-2 text-right font-serif font-bold text-[11px] ${transferIn || isInc ? 'text-emerald-700' : 'text-stone-700'}`}>
                          {isTransfer ? '↔ ' : ''}{transferIn || isInc ? '+' : '-'}{fmt(tx.amount)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {isTransfer ? <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded px-2 py-1">연결 거래</span> : <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => openEditModal(tx)}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100">수정</button>
                            <button type="button" onClick={() => handleDeleteTx(tx)}
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-200 rounded hover:bg-rose-100">삭제</button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>

          {/* 페이징 (컴팩트) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-1">
              <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}
                className="px-2 py-0.5 text-[10px] font-bold rounded border border-stone-200 bg-stone-50 disabled:opacity-30">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - currentPage) <= 2)
                .map((p) => (
                  <button key={p} type="button" onClick={() => setCurrentPage(p)}
                    className={`w-6 h-6 text-[10px] font-bold rounded border transition-all ${currentPage === p ? 'bg-[#7766a7] text-white border-[#7766a7]' : 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                    {p}
                  </button>
                ))}
              <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}
                className="px-2 py-0.5 text-[10px] font-bold rounded border border-stone-200 bg-stone-50 disabled:opacity-30">›</button>
            </div>
          )}
        </div>

        {/* 예상 이자 정보 (읽기전용, 컴팩트) */}
        <div className="col-span-4 bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-1.5 border-b border-stone-100 pb-2">
            <span className="text-sm">📈</span>
            <h3 className="font-serif font-bold text-sm text-stone-900">예상 이자</h3>
          </div>

          {interestResult && account.interestRate ? (
            <div className="space-y-2">
              {/* 이자율 & 타입 */}
              <div className="bg-gradient-to-br from-stone-50 to-[#f7f4ee] rounded-xl p-3 text-center border border-stone-200">
                <div className="text-[11px] text-stone-500 font-bold">적용 금리</div>
                <div className="font-serif font-bold text-2xl text-stone-900 mt-0.5">
                  {account.interestRate}<span className="text-sm">%</span>
                </div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  {account.interestType === 'COMPOUND' ? '복리' : '단리'} · {totalMonths}개월
                </div>
              </div>

              {/* 세부 정보 */}
              {[
                { label: '예상 만기 수령액', val: fmt(interestResult.maturityAmount), cls: 'text-emerald-700', bold: true },
                { label: '총 예상 이자', val: fmt(interestResult.totalInterest), cls: 'text-[#7766a7]', bold: false },
                { label: '월 평균 이자', val: fmt(interestResult.monthlyInterest), cls: 'text-stone-700', bold: false },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
                  <span className="text-[11px] text-stone-500 font-bold">{row.label}</span>
                  <span className={`font-serif font-bold text-xs ${row.cls}`}>{row.val}</span>
                </div>
              ))}

              {/* 만기일 */}
              {account.maturityDate && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-center">
                  <div className="text-[10px] text-amber-600 font-bold">만기일</div>
                  <div className="font-bold text-xs text-amber-900 mt-0.5">
                    {new Date(account.maturityDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  {dDay !== null && (
                    <div className="text-[10px] text-amber-600 font-bold mt-0.5">D-{dDay}</div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-stone-400 leading-relaxed">
                * 현재 잔액 기준 계산입니다. 실제 이자는 은행 규정에 따라 차이가 있을 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center space-y-2">
              <span className="text-3xl">📈</span>
              <p className="text-xs text-stone-400">
                계좌 수정에서<br />금리를 입력하면<br />예상 이자가 표시됩니다.
              </p>
              <button type="button" onClick={() => onEditClick(account)}
                className="px-3 py-1 text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-200">
                ⚙️ 금리 설정
              </button>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* ── 수정 영역 */}


    </div>
  );
}
