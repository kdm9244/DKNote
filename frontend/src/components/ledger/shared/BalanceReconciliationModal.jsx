import React, { useEffect, useMemo, useState } from 'react';
import { reconcileAndAdjustBalance, reconcileBalance } from '../../../api/ledger';

const REASONS = [
  '누락된 입출금',
  '이자·수수료 반영',
  '초기 잔액 오류',
  '현금성 잔액 보정',
  '기타',
];

const currency = (value, code = 'KRW') => new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: code,
  maximumFractionDigits: code === 'KRW' ? 0 : 2,
}).format(Number(value || 0));

export default function BalanceReconciliationModal({ open, account, onClose, onCompleted }) {
  const [actualBalance, setActualBalance] = useState('');
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isDebt = account?.accountType === 'DEBT';
  const bookBalance = Number(account?.cachedBookBalance || 0);
  const displayBookBalance = isDebt ? Math.abs(bookBalance) : bookBalance;
  const normalizedActualBalance = isDebt ? -Math.abs(Number(actualBalance || 0)) : Number(actualBalance || 0);
  const difference = useMemo(() => normalizedActualBalance - bookBalance, [normalizedActualBalance, bookBalance]);
  const displayDifference = Number(actualBalance || 0) - displayBookBalance;

  useEffect(() => {
    if (!open || !account) return;
    const savedBalance = account.lastActualBalance ?? account.cachedBookBalance ?? 0;
    setActualBalance(String(account.accountType === 'DEBT' ? Math.abs(Number(savedBalance)) : savedBalance));
    setReason('');
    setMemo('');
    setError('');
  }, [open, account]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, onClose]);

  if (!open || !account) return null;

  const handleSave = async (adjust) => {
    if (actualBalance === '' || Number.isNaN(Number(actualBalance))) {
      setError('실제 잔액을 입력해 주세요.');
      return;
    }
    if (adjust && !reason) {
      setError('조정 이유를 선택해 주세요.');
      return;
    }
    if (adjust && reason === '기타' && !memo.trim()) {
      setError('기타 사유를 선택한 경우 상세 메모를 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');

    let result;
    try {
      result = adjust
        ? await reconcileAndAdjustBalance(account.accountId, { actualBalance: normalizedActualBalance, reason, memo })
        : await reconcileBalance(account.accountId, normalizedActualBalance);
    } catch (requestError) {
      const payload = requestError.response?.data;
      const serverMessage = typeof payload === 'string' ? payload : payload?.message;
      setError(serverMessage || (requestError.response
        ? `잔액 대조를 저장하지 못했습니다. (${requestError.response.status})`
        : '백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.'));
      setSaving(false);
      return;
    }

    try {
      await onCompleted?.(result, { adjusted: adjust, difference });
    } catch (refreshError) {
      // 서버 저장은 완료됐으므로 화면 갱신 실패를 저장 실패로 표시하지 않습니다.
      console.error('잔액 대조 저장 후 화면 갱신 실패', refreshError);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <div className="ledger-balance-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="balance-modal-title" className="ledger-balance-modal__panel">
        <header>
          <div><span>ACCOUNT CHECK</span><h2 id="balance-modal-title">{account.accountType === 'INVESTMENT' ? '예수금 잔액 대조' : isDebt ? '남은 부채 대조' : '계좌 잔액 대조'}</h2><p>{account.accountName} · {account.bankName || '금융기관'}</p></div>
          <button type="button" aria-label="닫기" onClick={onClose} disabled={saving}>×</button>
        </header>

        <div className="ledger-balance-modal__comparison">
          <div><span>{isDebt ? '장부상 남은 부채' : '장부 잔액'}</span><strong>{currency(displayBookBalance, account.currency)}</strong></div>
          <div className="is-input"><label htmlFor="actual-balance">{isDebt ? '실제 남은 부채' : '실제 잔액'}</label><input id="actual-balance" type="number" min={isDebt ? '0' : undefined} step="0.01" value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} autoFocus /></div>
          <div><span>차이</span><strong className={displayDifference === 0 ? 'is-match' : displayDifference > 0 ? 'is-plus' : 'is-minus'}>{displayDifference > 0 ? '+' : ''}{currency(displayDifference, account.currency)}</strong></div>
        </div>

        {difference !== 0 && <div className="ledger-balance-modal__reason">
          <label><span>조정 이유 *</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">이유를 선택하세요</option>{REASONS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label><span>상세 메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={500} placeholder="차이가 발생한 원인이나 확인 내용을 기록하세요." /></label>
        </div>}

        <div className="ledger-balance-modal__guide"><strong>저장 방식</strong><p>{isDebt ? '남은 부채를 양수로 입력하면 내부 장부에는 부채값으로 안전하게 반영됩니다. 조정 거래를 저장하면 부채 변동 내역에도 이유가 남습니다.' : '대조만 저장하면 실제 잔액 확인 기록만 남습니다. 조정 거래를 저장하면 차액이 입금 또는 출금으로 생성되어 거래 내역에서 이유와 함께 확인됩니다.'}</p></div>
        {error && <p className="ledger-balance-modal__error" role="alert">{error}</p>}

        <footer>
          <button type="button" onClick={onClose} disabled={saving}>취소</button>
          <button type="button" className="is-secondary" onClick={() => handleSave(false)} disabled={saving}>{saving ? '저장 중…' : '대조만 저장'}</button>
          {difference !== 0 && <button type="button" className="is-primary" onClick={() => handleSave(true)} disabled={saving || !reason || (reason === '기타' && !memo.trim())}>{saving ? '저장 중…' : '조정 거래 저장'}</button>}
        </footer>
      </section>
    </div>
  );
}
