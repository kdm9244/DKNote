import {useState} from 'react';
import {updateAccount} from '../../../api/ledger';
import {messageOf} from '../../../api/workspace';
import '../../../styles/tax-management.css';
const types={GENERAL:'일반계좌',SPECIFIC_NO_WITHHOLDING:'특정계좌 · 원천징수 없음',SPECIFIC_WITHHOLDING:'특정계좌 · 원천징수 있음',NISA:'NISA'};
export function BrokerageTaxFields({country,type,onChange,disabled=false}){
 return <div className="brokerage-tax-fields"><label>계좌 국가<select aria-label="계좌 국가" required disabled={disabled} value={country||''} onChange={e=>onChange(e.target.value,'GENERAL')}><option value="">선택하세요</option><option value="KR">한국</option><option value="JP">일본</option></select></label>
  <label>증권계좌 유형<select aria-label="증권계좌 유형" required disabled={disabled||!country} value={type&&type!=='UNSET'?type:''} onChange={e=>onChange(country,e.target.value)}><option value="">선택하세요</option>{Object.entries(types).filter(([k])=>country==='JP'||k==='GENERAL').map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label></div>;
}
export default function BrokerageTaxEditor({account,onSaved}){
 const [country,setCountry]=useState(account.brokerageCountry||''),[type,setType]=useState(account.brokerageTaxType||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 return <form className="brokerage-tax-editor" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{const saved=await updateAccount(account.accountId,{...account,brokerageCountry:country,brokerageTaxType:type});setNotice('계좌 과세 설정을 저장했습니다.');await onSaved?.(saved);}catch(e){setError(messageOf(e));}finally{setBusy(false);}}}>
  <BrokerageTaxFields country={country} type={type} disabled={busy} onChange={(c,t)=>{setCountry(c);setType(t);setNotice('');}}/>
  <p className="ws-muted">매도할 때 이 설정과 매도일의 세법상 거주지를 자동 적용합니다. 이미 등록한 거래의 기준은 유지합니다.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<button className="ws-button" disabled={busy||!country||!type||type==='UNSET'}>계좌 과세 설정 저장</button></form>;
}
