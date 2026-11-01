import { useState } from 'react';
import InlineEditor from '../../workspace/InlineEditor';
import { settleInvestmentProfit, editInvestmentSettlement, cancelInvestmentSettlement } from '../../../api/investment';
import { messageOf } from '../../../api/workspace';
import { dateKey, ledgerMoney as money } from '../../../services/ledgerPeriod';
import '../../../styles/investment-settlement.css';

export default function InvestmentSettlementEditor({account,holdings=[],transaction,onClose,onSaved}) {
  const hasPositions = holdings.some(h=>h.assetClass!=='CASH' && Number(h.quantity)!==0);
  const [mode,setMode] = useState(transaction ? 'manual' : 'balance');
  const [amount,setAmount] = useState(transaction ? String(transaction.realizedProfitLoss) : '');
  const [date,setDate] = useState(transaction?.tradeDate.slice(0,10) || dateKey);
  const [memo,setMemo] = useState(transaction?.memo || ''), [confirmed,setConfirmed] = useState(false);
  const [holdingsUnchanged,setHoldingsUnchanged] = useState(false);
  const [requestId] = useState(()=>crypto.randomUUID());
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [completed,setCompleted] = useState(false);
  const balance = Number(account.cachedBookBalance || 0);
  const profit = amount==='' ? null : mode==='balance' ? Math.round((Number(amount)-balance)*100)/100 : Number(amount);
  const delta = profit===null ? 0 : profit-Number(transaction?.netAmount || 0);
  const valid = profit!==null && Number.isFinite(profit) && balance+delta>=0 && (mode!=='balance'||Number(amount)>=0);
  const submit = async (cancel=false) => {
    if(busy||completed)return;
    if(cancel&&!window.confirm('이 손익 정산을 취소하고 예수금과 손익을 되돌릴까요?'))return;
    setBusy(true);setError('');
    try {
      if(cancel) await cancelInvestmentSettlement(account.accountId,transaction.investmentTransactionId,transaction.version,balance);
      else {
        const data={expectedBalance:balance,holdingsUnchanged,date:mode==='balance'?dateKey():date,cashFlowsRecorded:confirmed,memo,requestId,version:transaction?.version,
          ...(mode==='balance'?{finalCashBalance:Number(amount)}:{profitLoss:profit})};
        if(transaction)await editInvestmentSettlement(account.accountId,transaction.investmentTransactionId,data);
        else await settleInvestmentProfit(account.accountId,data);
      }
      setCompleted(true);
    } catch(e) {setError(messageOf(e));setBusy(false);return;}
    // A completed write must not become retryable when refreshing the screen fails.
    try {await onSaved();onClose();} catch {setError('저장은 완료됐습니다. 화면을 새로고침해 결과를 확인하세요.');}
    finally {setBusy(false);}
  };
  const needsPositionCheck=mode==='balance'&&hasPositions&&!transaction;
  const ready=confirmed&&(!needsPositionCheck||holdingsUnchanged);
  const resultBalance=profit===null?null:Math.round((balance+delta)*100)/100;
  const amountChanged=value=>{setAmount(value);setConfirmed(false);setHoldingsUnchanged(false);};
  const switchMode=next=>{setMode(next);setAmount('');setConfirmed(false);setHoldingsUnchanged(false);if(next==='balance')setDate(dateKey());};
  return <InlineEditor title={transaction?'투자 손익 정산 수정':'투자 손익 정산'} busy={busy} onClose={onClose}>
    <form className="ws-modal-body investment-settlement-form" onSubmit={e=>{e.preventDefault();if(ready&&valid)submit();}}>
      <div className="settlement-account-heading"><div><strong>{account.accountName}</strong><span>{account.currency} · {transaction?'기존 정산 수정':'거래 종료 후 현금 정산'}</span></div><span className="settlement-account-badge">예수금 연동</span></div>
      {!transaction&&<div className="settlement-mode-tabs" role="group" aria-label="정산 계산 방식"><button type="button" aria-pressed={mode==='balance'} disabled={busy||completed} onClick={()=>switchMode('balance')}><strong>최종 예수금으로 계산</strong><span>실제 현금 잔액에 자동으로 맞추기</span></button><button type="button" aria-pressed={mode==='manual'} disabled={busy||completed} onClick={()=>switchMode('manual')}><strong>순손익 직접 입력</strong><span>확인한 수익·손실만 추가 반영</span></button></div>}
      <fieldset disabled={busy||completed} className="settlement-fields">
        <div className="settlement-main-grid">
          <div className="settlement-input-column">
            <label className="settlement-amount-field">{mode==='balance'?'최종 예수금':'정산 순손익'} ({account.currency})<div><input required autoFocus type="number" step="0.01" min={mode==='balance'?'0':undefined} value={amount} onChange={e=>amountChanged(e.target.value)} placeholder={mode==='balance'?'증권사에 표시된 현금 잔액':'수익은 양수, 손실은 음수'}/><span>{account.currency}</span></div></label>
            <p className="settlement-input-hint">{mode==='balance'?'수수료·세금이 차감된 현금 잔액을 입력하세요. 차액은 손익으로 기록하고 예수금도 입력한 금액으로 맞춥니다.':'입력한 순손익만큼 현금 잔액도 함께 변경됩니다.'}</p>
            <div className="settlement-secondary-grid"><label>정산 날짜<input aria-label="정산 날짜" required type="date" value={date} min={account.initialBalanceDate} max={dateKey()} readOnly={!!transaction||mode==='balance'} onChange={e=>setDate(e.target.value)}/><small>{mode==='balance'?'현재 잔액 기준 · 오늘 정산':transaction?'기존 정산 날짜 유지':'실현 손익 발생일'}</small></label><label><span>메모 <span className="settlement-optional">선택</span></span><textarea aria-label="메모" rows="2" value={memo} maxLength={500} onChange={e=>setMemo(e.target.value)} placeholder="정산 내용을 남겨두세요."/></label></div>
          </div>
          <aside className="settlement-result" aria-label="정산 후 잔액 미리보기" aria-live="polite">
            <div><span>현재 장부 예수금</span><strong>{money(balance,account.currency)}</strong></div>
            <div className="settlement-result-delta"><span>{transaction?'수정으로 반영할 차액':mode==='balance'?'자동 계산 순손익':'반영할 순손익'}</span><strong className={delta<0?'is-loss':delta>0?'is-profit':''}>{profit===null?'—':(delta>0?'+':'')+money(delta,account.currency)}</strong></div>
            {transaction&&<div className="settlement-original-profit"><span>수정 후 정산 순손익</span><strong>{profit===null?'—':money(profit,account.currency)}</strong></div>}
            <div className="settlement-result-total"><span>저장 후 예수금</span><strong>{resultBalance===null?'—':money(resultBalance,account.currency)}</strong><small>{mode==='balance'&&profit!==null?'입력한 실제 현금 잔액과 일치':'현금 잔액과 투자 손익에 함께 반영'}</small></div>
          </aside>
        </div>
        <div className="settlement-checks"><label><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>입출금·매매대금은 장부에 반영했고, 이번 차액은 미기록 투자 손익입니다.</span></label>{needsPositionCheck&&<label><input required type="checkbox" checked={holdingsUnchanged} onChange={e=>setHoldingsUnchanged(e.target.checked)}/><span>보유 종목의 수량·매입원가가 장부와 같습니다.<small>미기록 매수·매도가 있으면 먼저 거래를 반영하거나 순손익 직접 입력을 사용하세요.</small></span></label>}</div>
      </fieldset>
      {!valid&&amount!==''&&<p className="ws-alert" role="alert">금액을 확인하세요. 정산 후 예수금은 음수가 될 수 없습니다.</p>}
      {valid&&profit===0&&!transaction&&<p className="settlement-matched" role="status">현재 장부 잔액과 같습니다. 추가로 정산할 손익이 없습니다.</p>}
      {error&&<p className="ws-alert" role="alert">{error}</p>}
      <footer className="settlement-footer"><span>{mode==='balance'?'저장하면 실제 현금 잔액으로 맞춰집니다.':'저장하면 순손익과 현금 잔액이 함께 바뀝니다.'}</span><div>{transaction&&<button type="button" className="ws-button danger" disabled={busy||completed} onClick={()=>submit(true)}>정산 취소</button>}<button type="button" className="ws-button" disabled={busy} onClick={onClose}>닫기</button><button className="ws-button primary" disabled={busy||completed||!valid||!ready||(!transaction&&profit===0)}>{busy?'처리 중…':transaction?'정산 수정 저장':'손익 정산 저장'}</button></div></footer>
    </form>
  </InlineEditor>;
}
