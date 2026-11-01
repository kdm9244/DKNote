import { useState } from 'react';
import InlineEditor from '../../workspace/InlineEditor';
import { settleInvestmentProfit, editInvestmentSettlement, cancelInvestmentSettlement } from '../../../api/investment';
import { messageOf } from '../../../api/workspace';
import { dateKey, ledgerMoney as money } from '../../../services/ledgerPeriod';

export default function InvestmentSettlementEditor({account,holdings=[],transaction,onClose,onSaved}) {
  const hasPositions = holdings.some(h=>h.assetClass!=='CASH' && Number(h.quantity)!==0);
  const [mode,setMode] = useState(transaction || hasPositions ? 'manual' : 'balance');
  const [amount,setAmount] = useState(transaction ? String(transaction.realizedProfitLoss) : '');
  const [date,setDate] = useState(transaction?.tradeDate.slice(0,10) || dateKey);
  const [memo,setMemo] = useState(transaction?.memo || ''), [confirmed,setConfirmed] = useState(false);
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
        const data={expectedBalance:balance,date:mode==='balance'?dateKey():date,cashFlowsRecorded:confirmed,memo,requestId,version:transaction?.version,
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
  return <InlineEditor title={transaction?'투자 손익 정산 수정':'투자 손익 정산'} busy={busy} onClose={onClose}>
    <form className="ws-modal-body" onSubmit={e=>{e.preventDefault();submit();}}>
      <p><strong>{account.accountName}</strong> · 현재 예수금 {money(balance,account.currency)}</p>
      <p className="ws-muted">매매를 하나씩 입력하지 않고, 수수료·세금 차감 후 아직 기록하지 않은 순손익만 반영합니다.</p>
      {!transaction&&<div className="ws-tabs"><button type="button" disabled={busy||hasPositions||completed} className={mode==='balance'?'active':''} onClick={()=>{setMode('balance');setAmount('');setDate(dateKey());}}>최종 예수금으로 계산</button><button type="button" disabled={busy||completed} className={mode==='manual'?'active':''} onClick={()=>{setMode('manual');setAmount('');}}>순손익 직접 입력</button></div>}
      {hasPositions&&!transaction&&<p className="ws-muted">보유 종목이 있어 예수금 차이로 자동 계산할 수 없습니다. 증권사에서 확인한 미기록 실현 순손익을 입력하세요.</p>}
      <fieldset disabled={busy||completed}>
        <div className="ws-form-grid"><label className="ws-field">정산 날짜<input required type="date" value={date} max={dateKey()} readOnly={!!transaction||mode==='balance'} onChange={e=>setDate(e.target.value)}/></label><label className="ws-field">{mode==='balance'?'최종 예수금':'정산 순손익'} ({account.currency})<input required type="number" step="0.01" min={mode==='balance'?'0':undefined} value={amount} onChange={e=>setAmount(e.target.value)} placeholder={mode==='balance'?'거래를 마친 실제 예수금':'수익은 양수, 손실은 음수'}/></label></div>
        {profit!==null&&<div className="ledger-settlement-preview" role="status"><span>이번 정산 순손익 <strong>{money(profit,account.currency)}</strong></span>{transaction&&<span>예수금 변경액 <strong>{money(delta,account.currency)}</strong></span>}<span>저장 후 예수금 <strong>{money(balance+delta,account.currency)}</strong></span></div>}
        <label className="ws-field">메모<textarea value={memo} maxLength={500} onChange={e=>setMemo(e.target.value)}/></label>
        <label className="ledger-settlement-confirm"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> 입출금은 모두 기록했으며, 기존 매매·정산과 중복되지 않는 손익입니다.</label>
      </fieldset>
      {!valid&&amount!==''&&<p className="ws-alert">금액을 확인하세요. 정산 후 예수금은 음수가 될 수 없습니다.</p>}
      {error&&<p className="ws-alert" role="alert">{error}</p>}
      <div className="ws-actions"><button className="ws-button primary" disabled={busy||completed||!valid||!confirmed||(!transaction&&profit===0)}>{busy?'처리 중…':transaction?'정산 수정 저장':'손익 정산 저장'}</button><button type="button" className="ws-button" disabled={busy} onClick={onClose}>닫기</button>{transaction&&<button type="button" className="ws-button danger" disabled={busy||completed} onClick={()=>submit(true)}>정산 취소</button>}</div>
    </form>
  </InlineEditor>;
}
