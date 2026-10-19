import {useEffect,useState} from 'react';
import api from '../../../api/client';
import {messageOf} from '../../../api/workspace';
import '../../../styles/tax-management.css';
const today=()=>new Intl.DateTimeFormat('en-CA').format(new Date());
export default function TaxResidenceSettings(){
 const [rows,setRows]=useState([]),[country,setCountry]=useState('JP'),[date,setDate]=useState(today),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=()=>{setLoading(true);setError('');api.get('/api/ledger/taxes/residences').then(r=>setRows(r.data)).catch(e=>setError(messageOf(e))).finally(()=>setLoading(false));};
 useEffect(()=>{let active=true;api.get('/api/ledger/taxes/residences').then(r=>{if(active)setRows(r.data);}).catch(e=>{if(active)setError(messageOf(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 return <section className="investment-card tax-residence-settings"><h2>세법상 거주지</h2><p className="ws-muted">적용 시작일을 기준으로 매도 시 세금 처리 방식을 선택합니다. 기존 거래에 저장된 기준은 유지합니다.</p>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{const {data}=await api.put('/api/ledger/taxes/residences',{country,effectiveFrom:date,version:rows.find(r=>r.effectiveFrom===date)?.version??null});setRows(r=>[...r.filter(x=>x.id!==data.id),data].sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom)));setNotice('거주지 적용 이력을 저장했습니다.');}catch(e){setError(messageOf(e));}finally{setBusy(false);}}}>
   <label>세법상 거주 국가<select aria-label="세법상 거주 국가" disabled={busy||loading} value={country} onChange={e=>setCountry(e.target.value)}><option value="JP">일본</option><option value="KR">한국</option></select></label>
   <label>적용 시작일<input type="date" aria-label="적용 시작일" required min="1900-01-01" max="2200-12-31" disabled={busy||loading} value={date} onChange={e=>setDate(e.target.value)}/></label><button className="ws-button" disabled={busy||loading||Boolean(error)}>거주지 저장</button></form>
  {loading?<p role="status">설정을 불러오는 중…</p>:<ul>{rows.map(r=><li key={r.id}><span>{r.effectiveFrom}부터 · {r.country==='JP'?'일본':'한국'}</span><button type="button" className="ws-button" disabled={busy} onClick={()=>{setCountry(r.country);setDate(r.effectiveFrom);setNotice('');}}>이력 수정</button></li>)}</ul>}
  {error&&<p role="alert">{error} <button className="ws-button" onClick={load}>다시 불러오기</button></p>}{notice&&<p role="status">{notice}</p>}</section>;
}
