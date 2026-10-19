import {useEffect,useState} from 'react';
import api from '../../../api/client';
import {getInvestmentAnnualSummary} from '../../../api/investment';
import {getAccounts} from '../../../api/ledger';
import {messageOf} from '../../../api/workspace';
import InvestmentAnnualSummary from './InvestmentAnnualSummary';
import '../../../styles/tax-management.css';

const countries={UNSET:'미설정',KR:'한국',JP:'일본',OTHER:'기타'};
const residences={UNSET:'미설정',KR:'한국',JP:'일본',REVIEW:'거주지 확인 필요'};
const types={UNSET:'미설정',GENERAL:'일반계좌',SPECIFIC_WITHHOLDING:'특정계좌 · 원천징수 있음',SPECIFIC_NO_WITHHOLDING:'특정계좌 · 원천징수 없음',NISA:'NISA'};
const statuses={UNCHECKED:'미확인',REVIEW:'신고 검토 중',FILED:'신고 완료',PAID:'납부 완료'};
const money=(n,c)=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:c||'KRW',maximumFractionDigits:2}).format(Number(n||0));
const empty={accountCountry:'UNSET',accountType:'UNSET',filingStatus:'UNCHECKED',paymentCurrency:'JPY',confirmedProfit:'',additionalTax:'',refund:'',memo:''};
function taxGuidance(residence,record,type){
 if(!['KR','JP'].includes(residence)||!record?.accountCountry||record.accountCountry==='UNSET'||!type||type==='UNSET')return '설정 확인 필요';
 if(residence==='KR')return '국내·해외주식 및 배당 과세 확인';
 if(record.accountCountry!=='JP')return '해외 계좌 · 신고 기준 확인';
 if(type==='NISA')return '비과세 요건·배당 수령 방식 확인';
 if(type==='SPECIFIC_WITHHOLDING')return '원천징수·계좌 간 손익통산 확인';
 return '연간보고서로 신고 여부 검토';
}
export default function TaxManagementView({accounts,initialAccountId='',compact=false}){
 const [year,setYear]=useState(new Date().getFullYear()),[accountId,setAccountId]=useState(initialAccountId),[records,setRecords]=useState([]),[summaries,setSummaries]=useState({}),[failures,setFailures]=useState([]),[residence,setResidence]=useState('UNSET'),[draft,setDraft]=useState(empty),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(false),[notice,setNotice]=useState(''),[revision,setRevision]=useState(0);
 const [allAccounts,setAllAccounts]=useState(accounts),[accountError,setAccountError]=useState('');
 useEffect(()=>{if(compact){setAllAccounts(accounts);return;}let active=true;setAccountError('');getAccounts(true).then(data=>{if(active)setAllAccounts(data.accounts);}).catch(e=>{if(active)setAccountError(messageOf(e));});return()=>{active=false;};},[compact,accounts,revision]);
 const investmentAccounts=allAccounts.filter(a=>a.accountType==='INVESTMENT');
 const account=investmentAccounts.find(a=>a.accountId===accountId);
 const yearRecord=records.find(r=>!r.accountId),record=records.find(r=>r.accountId===accountId);
 const ids=investmentAccounts.map(a=>a.accountId).join(',');
 useEffect(()=>{let active=true;setLoading(true);setLoadError(false);setError('');setNotice('');setSummaries({});setFailures([]);
  Promise.all([api.get(`/api/ledger/taxes/${year}`),Promise.allSettled(ids?ids.split(',').map(async id=>[id,await getInvestmentAnnualSummary(id,year)]):[])]).then(([response,results])=>{if(!active)return;setRecords(response.data);setResidence(response.data.find(r=>!r.accountId)?.residence||'UNSET');setSummaries(Object.fromEntries(results.filter(r=>r.status==='fulfilled').map(r=>r.value)));setFailures(results.flatMap((r,i)=>r.status==='rejected'?[ids.split(',')[i]]:[]));}).catch(e=>{if(active){setError(messageOf(e));setLoadError(true);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[year,ids,revision]);
 useEffect(()=>{setDraft({...empty,...record,paymentCurrency:record?.paymentCurrency||summaries[accountId]?.baseCurrency||'JPY',accountType:record?.accountType||summaries[accountId]?.taxAccountType||'UNSET',confirmedProfit:record?.confirmedProfit??'',additionalTax:record?.additionalTax??'',refund:record?.refund??'',memo:record?.memo||''});},[record,accountId,summaries]);
 const save=async scope=>{setBusy(true);setError('');setNotice('');try{
  const body=scope==='year'?{residence,version:yearRecord?.version??null}:{...draft,residence,version:record?.version??null,confirmedProfit:draft.confirmedProfit===''?null:draft.confirmedProfit,additionalTax:draft.additionalTax===''?null:draft.additionalTax,refund:draft.refund===''?null:draft.refund};
  const {data}=await api.put(`/api/ledger/taxes/${year}${scope==='year'?'':`/accounts/${accountId}`}`,body);
  setRecords(current=>[...current.filter(r=>r.id!==data.id),data]);setNotice('저장했습니다.');
 }catch(e){setError(messageOf(e));}finally{setBusy(false);}};
 const field=(name,value)=>setDraft(d=>({...d,[name]:value}));
 return <div className={`tax-management${compact?' is-compact':''}`}>
  {!compact&&<header className="tax-heading"><div><h1>세금 관리</h1><p>연간 실현손익과 납부 내역</p></div><button className="ws-button" onClick={()=>setRevision(r=>r+1)} disabled={loading||busy}>새로고침</button></header>}
  <section className="investment-card tax-controls"><label>연도<select aria-label="연도" value={year} disabled={busy} onChange={e=>setYear(Number(e.target.value))}>{Array.from(new Set([year,...Array.from({length:12},(_,i)=>new Date().getFullYear()-i)])).sort((a,b)=>b-a).map(y=><option key={y}>{y}</option>)}</select></label>
   <label>계좌<select aria-label="계좌" value={accountId} disabled={busy||compact} onChange={e=>setAccountId(e.target.value)}><option value="">전체 투자계좌</option>{investmentAccounts.map(a=><option key={a.accountId} value={a.accountId}>{a.accountName}</option>)}</select></label>
   <form onSubmit={e=>{e.preventDefault();save('year');}}><label>세법상 거주지<select aria-label="세법상 거주지" value={residence} disabled={loading||busy} onChange={e=>setResidence(e.target.value)}>{Object.entries(residences).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="ws-button" disabled={loading||busy||Boolean(error)||residence===(yearRecord?.residence||'UNSET')}>신고 기준 저장</button></form>
  </section>
  {accountError&&<p className="ws-alert" role="alert">계좌 목록을 모두 불러오지 못했습니다. {accountError}</p>}
  {error&&<p className="ws-alert" role="alert">{error} <button className="ws-button" onClick={()=>setRevision(r=>r+1)}>다시 불러오기</button></p>}{notice&&<p role="status">{notice}</p>}
  {loading?<p role="status">세금 내역을 불러오는 중…</p>:!loadError&&<>
   {!investmentAccounts.length&&<section className="investment-card">등록된 투자계좌가 없습니다. 계좌 메뉴에서 투자계좌를 등록하세요.</section>}
   {failures.length>0&&<p role="alert">일부 계좌의 거래 집계를 불러오지 못했습니다. 새로고침 후 다시 확인하세요.</p>}
   {!compact&&!accountId&&<section className="investment-card tax-comparison" aria-label="계좌별 연간 비교"><div className="tax-table-wrap"><table><thead><tr>{['계좌','세금 차감 전 실현손익','배당 · 통화별','납부 세금 · 통화별','확인 사항','기록 상태'].map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{investmentAccounts.map(a=>{const s=summaries[a.accountId],r=records.find(r=>r.accountId===a.accountId);return <tr key={a.accountId}><th><button onClick={()=>setAccountId(a.accountId)}>{a.accountName}{a.isActive===false?' (비활성)':''} →</button></th><td>{s?money(s.realizedBeforeTax,s.baseCurrency):'집계 실패'}</td><td>{s?.currencies.map(c=><div key={c.currency}>{money(c.dividends,c.currency)}</div>)}</td><td>{s?.currencies.map(c=><div key={c.currency}>{money(c.taxes,c.currency)}</div>)}</td><td>{taxGuidance(yearRecord?.residence,r,r?.accountType||s?.taxAccountType)}</td><td>{statuses[r?.filingStatus]||'미확인'}</td></tr>;})}</tbody></table></div><p className="ws-muted">입력된 거래 기준 · 평가이익 제외 · 서로 다른 통화와 계좌의 손익은 자동 합산하지 않습니다.</p></section>}
   {account&&<>
    <form className="investment-card tax-account-settings" onSubmit={e=>{e.preventDefault();save('account');}}><h2>{account.accountName} · {year}년 과세 설정</h2><fieldset className="tax-settings-grid" disabled={busy}>
     <label>계좌 개설 국가<select aria-label="계좌 개설 국가" value={draft.accountCountry} onChange={e=>setDraft(d=>({...d,accountCountry:e.target.value,accountType:e.target.value==='KR'&&!['GENERAL','UNSET'].includes(d.accountType)?'UNSET':d.accountType}))}>{Object.entries(countries).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>과세 계좌 유형<select aria-label="과세 계좌 유형" value={draft.accountType} onChange={e=>field('accountType',e.target.value)}>{Object.entries(types).filter(([k])=>draft.accountCountry!=='KR'||['UNSET','GENERAL'].includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>신고·납부 기록<select aria-label="신고·납부 기록" value={draft.filingStatus} onChange={e=>field('filingStatus',e.target.value)}>{Object.entries(statuses).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
     <label>납부·환급 통화<select aria-label="납부·환급 통화" value={draft.paymentCurrency} onChange={e=>field('paymentCurrency',e.target.value)}>{['JPY','KRW','USD'].map(c=><option key={c}>{c}</option>)}</select></label>
     {[['confirmedProfit','연간보고서 확인 실현손익'],['additionalTax','추가 납부액'],['refund','환급액']].map(([k,title])=><label key={k}>{title} ({k==='confirmedProfit'?account.currency:draft.paymentCurrency})<input type="number" step="0.0001" min={k==='confirmedProfit'?undefined:0} value={draft[k]} onChange={e=>field(k,e.target.value)} placeholder="미입력"/></label>)}
     <label className="tax-memo">확인 메모<textarea maxLength={1000} value={draft.memo} onChange={e=>field('memo',e.target.value)} placeholder="증권사 보고서와 신고·납부 확인 내용을 기록하세요."/></label></fieldset>
     <p className="tax-guidance">{taxGuidance(yearRecord?.residence,draft,draft.accountType)}</p><p className="ws-muted">확인 금액과 완료 상태는 직접 기록합니다. 거래 수정 후에는 다시 대조하세요. 실제 신고·납부를 자동 처리하지 않습니다.</p>
     {draft.confirmedProfit!==''&&summaries[accountId]&&<p>거래 집계와 확인 실현손익 차이: {money(Number(draft.confirmedProfit)-Number(summaries[accountId].realizedBeforeTax),account.currency)}</p>}
     <button className="ws-button primary" disabled={busy}>계좌 설정 저장</button>
    </form>
    {!compact&&!failures.includes(accountId)&&<InvestmentAnnualSummary key={`${accountId}-${year}`} accountId={accountId} initialYear={year} hideType/>}
   </>}
   {!compact&&<details className="investment-card tax-help"><summary>한국·일본 신고 기준 안내</summary><p>한국: 국내주식·해외주식·배당에 따라 과세 방식이 다릅니다. 일본: 특정계좌의 원천징수 여부와 손익통산·이월공제에 따라 신고 검토가 필요합니다. NISA 손실은 과세 계좌와 손익통산할 수 없습니다. 해외 계좌는 거주지와 소득 발생 국가의 기준을 함께 확인하세요.</p><a href="https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?cntntsId=8800&mi=12274" target="_blank" rel="noreferrer">한국 국세청 안내 ↗</a> · <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm" target="_blank" rel="noreferrer">일본 특정계좌 안내 ↗</a> · <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1535.htm" target="_blank" rel="noreferrer">NISA 안내 ↗</a><p>추가 납부세액 자동 계산은 제공하지 않습니다. 세법상 손익과 거래기록상 손익이 다를 수 있습니다.</p></details>}
  </>}
 </div>;
}
