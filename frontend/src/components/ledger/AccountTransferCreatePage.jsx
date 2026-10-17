import React, { useMemo, useState } from 'react';
import { createAccountTransfer } from '../../api/ledger';
import '../../styles/account-transfer.css';

const symbol = { KRW: '₩', USD: '$', JPY: '¥' };
const typeLabel = { CHECKING: '입출금', SAVINGS: '저축', INVESTMENT: '투자', DEBT: '부채' };
const money = (value, currency = 'KRW') => `${symbol[currency] || currency}${Number(value || 0).toLocaleString('ko-KR', {
  maximumFractionDigits: currency === 'KRW' ? 0 : 2,
})}`;
const localDateTime = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function AccountOption({ account, selected, onClick, role }) {
  const isDebt = account.accountType === 'DEBT';
  const accountTypeName = account.accountPurpose === 'CREDIT_LINE' ? '마이너스통장' : typeLabel[account.accountType];
  return <button type="button" className={`transfer-account-option ${selected ? 'is-selected' : ''}`} onClick={onClick}>
    <span className="transfer-account-mark">{account.accountName?.slice(0, 1) || '계'}</span>
    <span><strong>{account.accountName}</strong><small>{account.bankName || '금융기관 미등록'} · {accountTypeName}</small></span>
    <span><small>{isDebt ? '현재 남은 부채' : role === 'source' ? '출금 가능 잔액' : '현재 잔액'}</small><strong>{money(isDebt ? Math.abs(Number(account.cachedBookBalance || 0)) : account.cachedBookBalance, account.currency)}</strong></span>
  </button>;
}

export default function AccountTransferCreatePage({ accounts = [], initialSourceAccount, onCancel, onSaved }) {
  const eligible = useMemo(() => accounts.filter((item) => (
    item.accountType !== 'FOREIGN_CURRENCY' && item.isActive !== false
  )), [accounts]);
  const sourceEligible = useMemo(() => eligible.filter((item) => (
    item.accountType !== 'DEBT' || item.accountPurpose === 'CREDIT_LINE'
  )), [eligible]);
  const initialIsRegularDebt = initialSourceAccount?.accountType === 'DEBT'
    && initialSourceAccount?.accountPurpose !== 'CREDIT_LINE';
  const [form, setForm] = useState({
    sourceAccountId: initialIsRegularDebt ? '' : initialSourceAccount?.accountId || '',
    destinationAccountId: initialIsRegularDebt ? initialSourceAccount?.accountId : '', amount: '', feeAmount: '0',
    transferredAt: localDateTime(), memo: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const source = sourceEligible.find((item) => item.accountId === form.sourceAccountId);
  const destination = eligible.find((item) => item.accountId === form.destinationAccountId);
  const destinations = source ? eligible.filter((item) => (
    item.accountId !== source.accountId && item.currency === source.currency
      && !(source.accountType === 'DEBT' && item.accountType === 'DEBT')
  )) : [];
  const amount = Number(form.amount || 0);
  const fee = Number(form.feeAmount || 0);
  const sourceAfter = Number(source?.cachedBookBalance || 0) - amount - fee;
  const destinationAfter = Number(destination?.cachedBookBalance || 0) + amount;
  const isCreditLineUse = source?.accountType === 'DEBT' && source?.accountPurpose === 'CREDIT_LINE';
  const isDebtRepayment = destination?.accountType === 'DEBT';
  const sourceCanCover = isCreditLineUse || sourceAfter >= 0;
  const repaymentWithinOutstanding = !isDebtRepayment || amount <= Math.abs(Number(destination.cachedBookBalance || 0));
  const canSubmit = source && destination && amount > 0 && fee >= 0 && sourceCanCover && repaymentWithinOutstanding;

  const selectSource = (accountId) => {
    const next = sourceEligible.find((item) => item.accountId === accountId);
    setForm((current) => ({
      ...current,
      sourceAccountId: accountId,
      destinationAccountId: current.destinationAccountId === accountId
        || (destination && (destination.currency !== next?.currency
          || (destination.accountType === 'DEBT' && next?.accountType === 'DEBT'))) ? '' : current.destinationAccountId,
    }));
    setError('');
  };

  const swap = () => {
    if (!source || !destination) return;
    setForm((current) => ({
      ...current,
      sourceAccountId: destination.accountId,
      destinationAccountId: source.accountId,
    }));
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!source || !destination) return setError('출금 계좌와 입금 계좌를 선택해 주세요.');
    if (amount <= 0) return setError('이체 금액을 입력해 주세요.');
    if (!sourceCanCover) return setError('출금 계좌의 잔액이 부족합니다.');
    if (!repaymentWithinOutstanding) return setError(`상환 금액은 남은 부채 ${money(Math.abs(Number(destination.cachedBookBalance || 0)), destination.currency)}보다 클 수 없습니다.`);
    try {
      setSaving(true);
      setError('');
      const result = await createAccountTransfer({
        sourceAccountId: source.accountId,
        destinationAccountId: destination.accountId,
        amount,
        feeAmount: fee,
        transferredAt: form.transferredAt ? `${form.transferredAt}:00` : null,
        memo: form.memo.trim() || null,
      });
      onSaved?.(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.detail || '이체를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="account-transfer-page">
    <header className="account-transfer-header">
      <div><button type="button" onClick={onCancel}>← 계좌 목록으로</button><span>ACCOUNT TRANSFER</span><h1>계좌 이체</h1><p>일반 계좌이체와 대출 상환·대출금 입금을 양쪽 거래내역에 함께 기록합니다.</p></div>
      <button type="submit" form="account-transfer-form" className="is-primary" disabled={saving || !canSubmit}>{saving ? '처리 중…' : isDebtRepayment ? '대출 상환 저장' : isCreditLineUse ? '마이너스통장 사용 저장' : '이체 저장'}</button>
    </header>

    <form id="account-transfer-form" className="account-transfer-layout" onSubmit={submit}>
      <main className="account-transfer-form-card">
        <section>
          <div className="transfer-section-heading"><span>1</span><div><h2>출금 계좌</h2><p>일반 대출은 출금할 수 없으며 마이너스통장만 한도 사용이 가능합니다.</p></div></div>
          <div className="transfer-account-grid">{sourceEligible.map((account) => <AccountOption key={account.accountId} account={account} role="source" selected={source?.accountId === account.accountId} onClick={() => selectSource(account.accountId)} />)}</div>
        </section>

        <div className="transfer-swap-row"><button type="button" onClick={swap} disabled={!source || !destination}>⇅ 출금·입금 계좌 바꾸기</button></div>

        <section>
          <div className="transfer-section-heading"><span>2</span><div><h2>입금 계좌</h2><p>{source ? `${source.currency} 통화가 같은 계좌만 표시됩니다. 부채 계좌로 보내면 대출 상환입니다.` : '출금 계좌를 먼저 선택하세요.'}</p></div></div>
          <div className="transfer-account-grid">{destinations.map((account) => <AccountOption key={account.accountId} account={account} role="destination" selected={destination?.accountId === account.accountId} onClick={() => setForm((current) => ({ ...current, destinationAccountId: account.accountId }))} />)}{source && !destinations.length && <div className="transfer-empty">같은 통화로 이체할 수 있는 다른 계좌가 없습니다.</div>}</div>
        </section>

        <section>
          <div className="transfer-section-heading"><span>3</span><div><h2>이체 정보</h2><p>금액과 기록 정보를 입력하세요.</p></div></div>
          <div className="transfer-field-grid">
            <label><span>이체 금액 *</span><div className="transfer-money-input"><input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0" /><em>{source?.currency || '통화'}</em></div></label>
            <label><span>이체 수수료</span><div className="transfer-money-input"><input type="number" min="0" step="0.01" value={form.feeAmount} onChange={(event) => setForm({ ...form, feeAmount: event.target.value })} /><em>{source?.currency || '통화'}</em></div></label>
            <label><span>이체 일시 *</span><input type="datetime-local" value={form.transferredAt} max={localDateTime()} onChange={(event) => setForm({ ...form, transferredAt: event.target.value })} /></label>
            <label className="is-full"><span>메모</span><textarea rows="3" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="이체 목적이나 참고 내용을 기록하세요." /></label>
          </div>
        </section>
        {error && <div className="transfer-error" role="alert">{error}</div>}
      </main>

      <aside className="account-transfer-preview">
        <span className="transfer-preview-eyebrow">TRANSFER PREVIEW</span><h2>이체 후 예상</h2>
        <div className="transfer-route"><div><small>출금</small><strong>{source?.accountName || '계좌 선택'}</strong></div><span>→</span><div><small>입금</small><strong>{destination?.accountName || '계좌 선택'}</strong></div></div>
        <div className="transfer-preview-amount"><span>보낼 금액</span><strong>{money(amount, source?.currency)}</strong>{fee > 0 && <small>수수료 {money(fee, source?.currency)} 별도</small>}</div>
        <div className="transfer-balance-preview"><div><span>{source?.accountName || '출금 계좌'} {isCreditLineUse ? '사용 중인 한도' : '잔액'}</span><strong>{money(isCreditLineUse ? Math.abs(sourceAfter) : sourceAfter, source?.currency)}</strong><small>{source ? `${money(source.accountType === 'DEBT' ? Math.abs(Number(source.cachedBookBalance || 0)) : source.cachedBookBalance, source.currency)} → ${money(isCreditLineUse ? Math.abs(sourceAfter) : sourceAfter, source.currency)}` : '-'}</small></div><div><span>{destination?.accountName || '입금 계좌'} {isDebtRepayment ? '남은 부채' : '잔액'}</span><strong>{money(isDebtRepayment ? Math.abs(destinationAfter) : destinationAfter, destination?.currency)}</strong><small>{destination ? `${money(destination.accountType === 'DEBT' ? Math.abs(Number(destination.cachedBookBalance || 0)) : destination.cachedBookBalance, destination.currency)} → ${money(isDebtRepayment ? Math.abs(destinationAfter) : destinationAfter, destination.currency)}` : '-'}</small></div></div>
        <div className="transfer-zero-note"><strong>{isDebtRepayment ? '대출 상환' : isCreditLineUse ? '마이너스통장 한도 사용' : '총자산 변동'} {fee > 0 ? `· 수수료 -${money(fee, source?.currency)}` : '· 수수료 없음'}</strong><p>{isDebtRepayment ? '출금 계좌 잔액과 남은 부채가 함께 줄고, 상환 거래가 양쪽에 기록됩니다.' : isCreditLineUse ? '사용 중인 마이너스통장 금액과 입금 계좌 잔액이 함께 늘어납니다.' : '계좌 간 이동 금액은 월 수입·지출에서 제외됩니다. 수수료만 실제 지출로 기록됩니다.'}</p></div>
        <button type="submit" disabled={saving || !canSubmit}>{saving ? '처리 중…' : isDebtRepayment ? '대출 상환 저장하기' : isCreditLineUse ? '마이너스통장 사용 저장하기' : '이체 저장하기'}</button>
      </aside>
    </form>
  </div>;
}
