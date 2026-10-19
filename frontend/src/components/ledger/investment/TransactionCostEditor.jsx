import { useState } from 'react';
import InlineEditor from '../../workspace/InlineEditor';
import { correctInvestmentCosts } from '../../../api/investment';
import { messageOf } from '../../../api/workspace';
import { TAX_KINDS } from './taxLabels';

export default function TransactionCostEditor({accountId,transaction,onClose,onSaved}) {
  const [form,setForm]=useState({feeAmount:String(transaction.feeAmount??0),taxAmount:String(transaction.taxAmount??0),taxKind:transaction.taxKind||'UNCLASSIFIED',memo:transaction.memo||''});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  return <InlineEditor title="거래 비용 수정" busy={busy} onClose={onClose}><form className="ws-modal-body investment-cost-editor" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await correctInvestmentCosts(accountId,transaction.investmentTransactionId,{...form,feeAmount:Number(form.feeAmount),taxAmount:Number(form.taxAmount),version:transaction.version??0});await onSaved();onClose();}catch(e){setError(messageOf(e));}finally{setBusy(false);}}}>
    <p>{transaction.tradeDate.slice(0,10)} · {transaction.currency} 기준</p>
    <p className="ws-muted">수정한 차액은 예수금에 반영되며, 매수 비용은 이후 매도 실현손익도 다시 계산합니다.</p>
    <div className="ws-form-grid"><label className="ws-field">수수료<input required type="number" min="0" step="0.01" value={form.feeAmount} disabled={busy} onChange={e=>set('feeAmount',e.target.value)}/></label><label className="ws-field">세금<input required type="number" min="0" step="0.01" value={form.taxAmount} disabled={busy} onChange={e=>set('taxAmount',e.target.value)}/></label></div>
    <label className="ws-field">세금 구분<select value={form.taxKind} disabled={busy} onChange={e=>set('taxKind',e.target.value)}>{Object.entries(TAX_KINDS).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label>
    <label className="ws-field">메모<textarea maxLength={2000} value={form.memo} disabled={busy} onChange={e=>set('memo',e.target.value)}/></label>
    {error&&<p className="ws-alert" role="alert">{error}</p>}
    <div className="ws-actions"><button className="ws-button primary" disabled={busy}>{busy?'저장 중…':'수정 저장'}</button><button type="button" className="ws-button" disabled={busy} onClick={onClose}>취소</button></div>
  </form></InlineEditor>;
}
