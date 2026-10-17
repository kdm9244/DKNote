import React, { useEffect, useMemo, useState } from 'react';
import { applyDebtMonthlyRepayment, createTransaction, deleteTransaction, getTransactionsByAccount } from '../../api/ledger';

const symbol = { KRW: '₩', USD: '$', JPY: '¥' };
const formatMoney = (value, currency = 'KRW') => {
  const digits = currency === 'KRW' ? 0 : 2;
  return `${symbol[currency] || currency} ${Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: digits })}`;
};
const localDateTimeValue = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const ACTIONS = {
  REPAYMENT: { label: '상환', description: '남은 부채를 줄입니다.', transactionType: 'INCOME', category: '부채 상환' },
  BORROWING: { label: '추가 대출', description: '대출 원금이 늘어납니다.', transactionType: 'EXPENSE', category: '추가 대출' },
  INTEREST: { label: '이자 반영', description: '미납 이자를 부채에 더합니다.', transactionType: 'EXPENSE', category: '대출 이자' },
};

export default function DebtAccountView({ account, onUpdate, onEditClick, onOpenReconcile, onOpenTransfer, onBackToDashboard }) {
  const [transactions, setTransactions] = useState([]);
  const [action, setAction] = useState('REPAYMENT');
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [transactionDate, setTransactionDate] = useState(localDateTimeValue());
  const [loading, setLoading] = useState(false);
  const [quickRepaymentLoading, setQuickRepaymentLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadTransactions = async () => {
    if (!account?.accountId) return;
    try {
      const result = await getTransactionsByAccount(account.accountId);
      setTransactions(Array.isArray(result) ? result : []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || '부채 거래 내역을 불러오지 못했습니다.');
    }
  };
  useEffect(() => { loadTransactions(); }, [account?.accountId, account?.balanceUpdatedAt]);

  const outstanding = Math.abs(Number(account?.cachedBookBalance || 0));
  const interestRate = Number(account?.interestRate || 0);
  const estimatedMonthlyInterest = outstanding * interestRate / 1200;
  const now = new Date();
  const monthly = useMemo(() => transactions.filter((item) => {
    if (!item.transactionDate) return false;
    const date = new Date(item.transactionDate);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }), [transactions]);
  const monthlyRepayment = monthly.filter((item) => item.transactionType === 'INCOME')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const plannedPayment = Number(account?.monthlyPayment || 0);
  const planProgress = plannedPayment > 0 ? Math.min(100, monthlyRepayment / plannedPayment * 100) : 0;
  const thisMonthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  const regularRepaymentTitle = `${thisMonthLabel} 정기 상환`;
  const alreadyAppliedMonthlyRepayment = monthly.some((item) => (
    item.transactionType === 'INCOME' && item.title === regularRepaymentTitle
  ));
  const quickRepaymentAmount = Math.min(plannedPayment, outstanding);

  const handleQuickMonthlyRepayment = async () => {
    if (!plannedPayment || !outstanding || alreadyAppliedMonthlyRepayment) return;
    try {
      setQuickRepaymentLoading(true);
      setError('');
      setMessage('');
      const result = await applyDebtMonthlyRepayment(account.accountId);
      setMessage(result.message || `${thisMonthLabel} 정기 상환이 반영되었습니다.`);
      await onUpdate();
      await loadTransactions();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.detail || '월 상환을 반영하지 못했습니다.');
    } finally {
      setQuickRepaymentLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('금액을 올바르게 입력해 주세요.');
      return;
    }
    if (action === 'REPAYMENT' && numericAmount > outstanding) {
      setError(`상환액은 현재 남은 부채 ${formatMoney(outstanding, account.currency)}보다 클 수 없습니다.`);
      return;
    }
    const config = ACTIONS[action];
    try {
      setLoading(true);
      await createTransaction({
        accountId: account.accountId,
        amount: numericAmount,
        transactionType: config.transactionType,
        title: title.trim() || config.label,
        categoryId: config.category,
        currency: account.currency || 'KRW',
        memo: memo.trim(),
        transactionDate: transactionDate ? `${transactionDate}:00` : undefined,
      });
      setAmount('');
      setTitle('');
      setMemo('');
      setMessage(`${config.label} ${formatMoney(numericAmount, account.currency)}이 반영되었습니다.`);
      await onUpdate();
      await loadTransactions();
    } catch (requestError) {
      setError(requestError.response?.data?.message || '부채 변동을 저장하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`“${item.title}” 기록을 삭제할까요? 남은 부채도 함께 복원됩니다.`)) return;
    try {
      setLoading(true);
      await deleteTransaction(item.transactionId);
      await onUpdate();
      await loadTransactions();
      setMessage('부채 기록을 삭제했습니다.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || '기록을 삭제하지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!account) return null;
  return <div className="ledger-account-detail ledger-debt-detail">
    <header className="ledger-account-detail__header">
      <div><button type="button" className="ledger-account-detail__back" onClick={onBackToDashboard}>← 대시보드로</button><div className="ledger-account-detail__title-row"><h1>부채 계좌 상세</h1><span>{account.currency}</span></div><p>남은 원금과 상환 기록, 금리와 만기를 관리합니다.</p></div>
      <div className="ledger-account-detail__actions"><button type="button" className="is-reconcile" onClick={onOpenReconcile}>잔액 대조</button><button type="button" onClick={() => onOpenTransfer(account)}>{account.accountPurpose === 'CREDIT_LINE' ? '한도 사용·상환' : '대출 상환'}</button><button type="button" onClick={() => onEditClick(account)}>계좌 수정</button></div>
    </header>

    {message && <div className="ledger-dashboard-success">{message}</div>}
    {error && <div className="ledger-dashboard-error">{error}</div>}

    <section className="ledger-debt-hero">
      <div className="ledger-debt-identity"><span className="ledger-debt-mark">DEBT</span><small>{account.accountPurpose === 'CREDIT_LINE' ? '마이너스통장' : '대출 계좌'}</small><h2>{account.accountName}</h2><p>{account.bankName || '금융기관 미등록'} · {account.accountNumberMasked || '계좌번호 미등록'}</p><strong>{formatMoney(outstanding, account.currency)}</strong><em>현재 남은 부채</em></div>
      <div className="ledger-debt-summary-grid">
        <div><span>연 금리</span><strong>{interestRate ? `${interestRate.toLocaleString('ko-KR')}%` : '미설정'}</strong><small>가중평균이 아닌 계좌 약정금리</small></div>
        <div><span>월 상환 계획</span><strong>{plannedPayment ? formatMoney(plannedPayment, account.currency) : '미설정'}</strong><small>계좌 수정에서 설정할 수 있습니다.</small></div>
        <div><span>예상 월 이자</span><strong>{formatMoney(estimatedMonthlyInterest, account.currency)}</strong><small>현재 잔액 × 연 금리 ÷ 12</small></div>
        <div><span>만기일</span><strong>{account.maturityDate ? new Date(`${account.maturityDate}T00:00:00`).toLocaleDateString('ko-KR') : '미설정'}</strong><small>{account.maturityDate ? '약정 만기 기준' : '계좌 수정에서 입력하세요.'}</small></div>
      </div>
    </section>

    <div className="ledger-debt-detail-grid">
      <section className="ledger-card ledger-debt-transaction-card">
        <header><div><span className="ledger-eyebrow">DEBT ACTIVITY</span><h2>부채 변동 등록</h2></div></header>
        <div className="ledger-debt-action-tabs">{Object.entries(ACTIONS).map(([key, item]) => <button type="button" key={key} className={action === key ? 'is-active' : ''} onClick={() => setAction(key)}><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>
        <form className="ledger-debt-form" onSubmit={handleSubmit}>
          <label><span>금액 *</span><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" /></label>
          <label><span>처리 일시 *</span><input type="datetime-local" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} /></label>
          <label><span>제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${ACTIONS[action].label} 기록`} /></label>
          <label><span>메모</span><input value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="상환 회차나 참고 내용을 입력하세요." /></label>
          <button type="submit" className="ledger-primary-btn" disabled={loading}>{loading ? '저장 중...' : `${ACTIONS[action].label} 반영`}</button>
        </form>
      </section>

      <aside className="ledger-card ledger-debt-plan-card"><header><div><span className="ledger-eyebrow">THIS MONTH</span><h2>{thisMonthLabel} 상환</h2></div></header><strong>{formatMoney(monthlyRepayment, account.currency)}</strong><span className="ledger-progress"><i style={{ width: `${planProgress}%` }} /></span><p>{plannedPayment ? `계획 ${formatMoney(plannedPayment, account.currency)}의 ${planProgress.toFixed(0)}%` : '월 상환 계획이 아직 설정되지 않았습니다.'}</p>
        <button
          type="button"
          className={`ledger-debt-quick-pay ${alreadyAppliedMonthlyRepayment ? 'is-complete' : ''}`}
          onClick={handleQuickMonthlyRepayment}
          disabled={quickRepaymentLoading || alreadyAppliedMonthlyRepayment || !plannedPayment || !outstanding}
        >
          {quickRepaymentLoading ? '상환 반영 중…'
            : alreadyAppliedMonthlyRepayment ? '✓ 이번 달 정기 상환 완료'
              : !outstanding ? '상환 완료'
                : !plannedPayment ? '월 상환 계획을 설정해 주세요'
                  : `${formatMoney(quickRepaymentAmount, account.currency)} 원클릭 상환`}
        </button>
        <small>{alreadyAppliedMonthlyRepayment ? '같은 달에는 정기 상환이 중복 등록되지 않습니다.' : '클릭하면 거래 내역과 남은 부채가 즉시 갱신됩니다.'}</small>
      </aside>
    </div>

    <section className="ledger-card ledger-debt-history-card">
      <header><div><span className="ledger-eyebrow">HISTORY</span><h2>부채 변동 내역</h2></div><span>{transactions.length}건</span></header>
      <div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>일시</th><th>구분</th><th>제목</th><th>금액</th><th>메모</th><th>관리</th></tr></thead><tbody>{transactions.map((item) => {
        const isRepayment = item.transactionType === 'INCOME' || (item.transactionType === 'TRANSFER' && item.transferDirection === 'IN');
        return <tr key={item.transactionId}><td>{new Date(item.transactionDate).toLocaleString('ko-KR')}</td><td><span className={`ledger-debt-kind ${isRepayment ? 'is-repayment' : 'is-borrowing'}`}>{isRepayment ? '상환' : (item.title || '').includes('이자') ? '이자' : '부채 증가'}</span></td><td><strong>{item.title}</strong></td><td className={isRepayment ? 'is-positive' : 'is-negative'}>{isRepayment ? '-' : '+'}{formatMoney(item.amount, item.currency)}</td><td>{item.memo || '-'}</td><td>{item.transferId ? <span className="ledger-table-linked">연결 거래</span> : <button type="button" className="ledger-table-delete" onClick={() => handleDelete(item)}>삭제</button>}</td></tr>;
      })}{!transactions.length && <tr><td colSpan="6"><div className="ledger-table-empty">아직 등록된 상환 또는 대출 기록이 없습니다.</div></td></tr>}</tbody></table></div>
    </section>
  </div>;
}
