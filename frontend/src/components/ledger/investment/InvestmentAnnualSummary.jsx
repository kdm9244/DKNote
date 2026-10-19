import { useEffect, useState } from 'react';
import { getInvestmentAnnualSummary,setInvestmentTaxAccountType } from '../../../api/investment';
import { messageOf } from '../../../api/workspace';
import { TAX_KINDS } from './taxLabels';
import '../../../styles/investment-annual.css';

const TYPES={UNSET:'미설정',GENERAL:'일반계좌',SPECIFIC_WITHHOLDING:'특정계좌 · 원천징수 있음',SPECIFIC_NO_WITHHOLDING:'특정계좌 · 원천징수 없음',NISA:'NISA'};
const money=(value,code)=>new Intl.NumberFormat('ko-KR',{style:'currency',currency:code||'JPY',maximumFractionDigits:2}).format(Number(value||0));
const csvCell=value=>{let s=String(value??'');if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
function download(data){
  const rows=[['일자','종목','시장','거래','통화','수량','단가','거래금액','수수료','세금구분','세금','계좌통화','계좌통화입출금','세후실현손익','메모'],...data.trades.map(({symbolName,market,transaction:t})=>[t.tradeDate,symbolName,market,t.tradeType,t.currency,t.quantity,t.unitPrice,t.grossAmount,t.feeAmount,TAX_KINDS[t.taxKind]||'미분류',t.taxAmount,data.baseCurrency,t.netAmount,t.tradeType==='SELL'?t.realizedProfitLoss:'',t.memo])];
  const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=`투자내역-${data.year}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function InvestmentAnnualSummary({accountId,revision=0,initialYear=new Date().getFullYear(),hideType=false}) {
  const [year,setYear]=useState(initialYear),[yearDraft,setYearDraft]=useState(String(initialYear));
  const [data,setData]=useState(null),[type,setType]=useState('UNSET'),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{let active=true;setLoading(true);setError('');getInvestmentAnnualSummary(accountId,year).then(next=>{if(active){setData(next);setType(next.taxAccountType||'UNSET');}}).catch(e=>{if(active)setError(messageOf(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[accountId,year,revision]);
  return <section className="investment-card investment-annual" aria-label="연간 투자 정리">
    <header className="investment-card__header"><h2>연간 투자 정리</h2><button type="button" className="ws-button" disabled={loading||!data?.trades.length||Boolean(error)} onClick={()=>download(data)}>CSV 내려받기</button></header>
    <div className="investment-annual-tools">{!hideType&&<form onSubmit={e=>{e.preventDefault();setYear(Number(yearDraft));}}><label>조회 연도<input type="number" min="1900" max="2200" required value={yearDraft} onChange={e=>setYearDraft(e.target.value)}/></label><button className="ws-button">연도 조회</button></form>}
      {!hideType&&<div><label>과세 계좌 유형<select aria-label="과세 계좌 유형" disabled={busy||loading} value={type} onChange={e=>setType(e.target.value)}>{Object.entries(TYPES).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label><button type="button" className="ws-button" disabled={busy||loading||type===data?.taxAccountType} onClick={async()=>{setBusy(true);setError('');setNotice('');try{await setInvestmentTaxAccountType(accountId,type);setData(d=>({...d,taxAccountType:type}));setNotice('계좌 유형을 저장했습니다.');}catch(e){setError(messageOf(e));}finally{setBusy(false);}}}>유형 저장</button></div>}
    </div>
    {error&&<p className="ws-alert" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <p className="ws-muted">1월 1일~12월 31일의 입력 거래 전체를 집계합니다. 수수료·실제 납부 세금을 구분해 증권사 연간거래보고서와 비교하세요.</p>
    {!hideType&&type==='NISA'&&<p className="ws-muted">NISA를 선택해도 기존 세금 기록을 지우지 않습니다. 입력된 세금이 있다면 거래별로 확인하세요.</p>}
    {loading?<p role="status">연간 내역을 불러오는 중…</p>:data&&!error&&<>
      <div className="investment-annual-profit"><div><span>세금 차감 전 실현손익</span><strong>{money(data.realizedBeforeTax,data.baseCurrency)}</strong></div><div><span>세후 실현손익</span><strong>{money(data.realizedAfterTax,data.baseCurrency)}</strong></div><small>계좌 통화 기준 · 기존 이동평균 원가 방식의 거래기록상 손익 · 배당은 아래 별도 표시</small></div>
      {!data.trades.length&&<p>이 연도에 등록된 투자 거래가 없습니다.</p>}
      <div className="investment-annual-currencies">{data.currencies.map(c=><article key={c.currency}><h3>{c.currency} 거래 합계</h3><dl>{[['매수금액',c.purchases],['매도금액',c.sales],['배당금액',c.dividends],['수수료',c.fees],['납부 세금 합계',c.taxes],...Object.entries(TAX_KINDS).map(([key,title])=>[title,c.taxBreakdown[key]||0])].map(([title,value])=><div key={title}><dt>{title}</dt><dd>{money(value,c.currency)}</dd></div>)}</dl></article>)}</div>
      <p className="ws-muted">통화별 금액은 합산하지 않습니다. 입력되지 않은 거래·세금과 증권사의 연말 정산·환급 내역은 포함되지 않습니다. <a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm" target="_blank" rel="noreferrer">일본 특정계좌 안내 ↗</a></p>
    </>}
  </section>;
}
