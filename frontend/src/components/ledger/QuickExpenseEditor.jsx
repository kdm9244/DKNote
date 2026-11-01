import { useState } from 'react';
import InlineEditor from '../workspace/InlineEditor';
import { createTransaction } from '../../api/ledger';
import { messageOf } from '../../api/workspace';
import { dateKey } from '../../services/ledgerPeriod';

export default function QuickExpenseEditor({accounts,onClose,onSaved}) {
  const available=accounts.filter(a=>a.accountType==='CHECKING');
  const [accountId,setAccountId]=useState(available[0]?.accountId || '');
  const [amount,setAmount]=useState(''),[title,setTitle]=useState(''),[category,setCategory]=useState('식비 · 카페'),[date,setDate]=useState(dateKey);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[completed,setCompleted]=useState(false);
  const account=available.find(a=>a.accountId===accountId);
  return <InlineEditor title="지출 빠른 입력" busy={busy} onClose={onClose}><form className="ws-modal-body" onSubmit={async e=>{
    e.preventDefault();if(busy||completed||!account)return;setBusy(true);setError('');
    try{await createTransaction({accountId,title:title.trim(),amount:Number(amount),transactionType:'EXPENSE',categoryId:category,transactionDate:date+'T12:00:00',currency:account.currency,memo:'빠른 지출 입력'});setCompleted(true);}catch(e){setError(messageOf(e));setBusy(false);return;}
    try{await onSaved();onClose();}catch{setError('저장은 완료됐습니다. 새로고침해 결과를 확인하세요.');}finally{setBusy(false);}
  }}><fieldset disabled={busy||completed}><div className="ws-form-grid"><label className="ws-field">계좌<select required value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="" disabled>계좌 선택</option>{available.map(a=><option key={a.accountId} value={a.accountId}>{a.accountName} · {a.currency}</option>)}</select></label><label className="ws-field">금액 ({account?.currency || 'KRW'})<input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label className="ws-field">사용 내역<input required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="ws-field">카테고리<select value={category} onChange={e=>setCategory(e.target.value)}>{['식비 · 카페','생활비','교통','주거 · 통신','의료 · 건강','문화 · 여가','여행 · 숙박','기타'].map(c=><option key={c}>{c}</option>)}</select></label><label className="ws-field">사용 날짜<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div></fieldset>{error&&<p role="alert" className="ws-alert">{error}</p>}<div className="ws-actions"><button className="ws-button primary" disabled={busy||completed||!account||!title.trim()}>{busy?'저장 중…':'지출 저장'}</button><button type="button" className="ws-button" disabled={busy} onClick={onClose}>취소</button></div></form></InlineEditor>;
}
