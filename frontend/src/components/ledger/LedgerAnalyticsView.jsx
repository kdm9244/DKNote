import { useEffect, useState } from 'react';
import { getLedgerDashboard } from '../../api/ledger';
import { getInvestmentActivities } from '../../api/investment';
import { useAssetRates } from '../../services/useAssetRates';
import { convertLedgerTotals, summarizeLedgerCategories } from '../../services/ledgerCurrencySummary';
import { dateKey, periodRange, shiftPeriod, previousRange, ledgerMoney as money } from '../../services/ledgerPeriod';

export default function LedgerAnalyticsView() {
  const [mode,setMode] = useState('monthly'), [anchor,setAnchor] = useState(dateKey);
  const [custom,setCustom] = useState(()=>periodRange('monthly'));
  const [selection,setCurrency] = useState('ALL'), [data,setData] = useState(null), [previous,setPrevious] = useState(null);
  const [investment,setInvestment] = useState([]), [busy,setBusy] = useState(true), [error,setError] = useState('');
  const [investmentError,setInvestmentError] = useState(''), [revision,setRevision] = useState(0), [page,setPage] = useState(1);
  const [investmentLoading,setInvestmentLoading] = useState(true);
  const range = mode === 'custom' ? custom : periodRange(mode,anchor);
  const valid = !!range.from && !!range.to && range.from <= range.to;
  useEffect(()=>{
    if (!valid) { setBusy(false); return; }
    let alive = true;
    setBusy(true); setError(''); setInvestmentError(''); setInvestmentLoading(true); setPage(1);
    const selected = {from:range.from,to:range.to};
    Promise.all([getLedgerDashboard(selected), getLedgerDashboard(previousRange(selected))])
      .then(([current,last])=>{if(alive){setData(current);setPrevious(last);}})
      .catch(e=>{if(alive)setError(e.response?.data?.message || e.response?.data?.detail || '통계를 불러오지 못했습니다.');})
      .finally(()=>{if(alive)setBusy(false);});
    getInvestmentActivities({...selected,to:shiftPeriod('daily',selected.to,1)}).then(rows=>{if(alive)setInvestment(rows);})
      .catch(()=>{if(alive){setInvestment([]);setInvestmentError('투자 손익을 불러오지 못했습니다. 다시 조회해 주세요.');}})
      .finally(()=>{if(alive)setInvestmentLoading(false);});
    return ()=>{alive=false;};
  },[range.from,range.to,valid,revision]);
  const currencies = [...new Set(['KRW',...Object.keys(data?.monthlyExpense || {}),...Object.keys(data?.monthlyIncome || {}),...Object.keys(previous?.monthlyExpense || {}),...Object.keys(previous?.monthlyIncome || {}),...(data?.recentTransactions || []).map(t=>t.currency),...investment.map(t=>t.accountCurrency)].filter(Boolean))];
  const currency=selection==='ALL'||currencies.includes(selection)?selection:'ALL';
  const {rates,loading:ratesLoading,refresh:refreshRates}=useAssetRates(currencies);
  const allCurrencies=currency==='ALL', displayCurrency=allCurrencies?'KRW':currency;
  const profits={};
  for(const tx of investment)if(['SELL','PROFIT_SETTLEMENT'].includes(tx.tradeType))profits[tx.accountCurrency]=(profits[tx.accountCurrency] || 0)+Number(tx.realizedProfitLoss || 0);
  const expenseTotal=convertLedgerTotals(data?.monthlyExpense,rates), incomeTotal=convertLedgerTotals(data?.monthlyIncome,rates);
  const priorTotal=convertLedgerTotals(previous?.monthlyExpense,rates), profitTotal=convertLedgerTotals(profits,rates);
  const expense=allCurrencies?expenseTotal.amount:Number(data?.monthlyExpense?.[currency] || 0);
  const income=allCurrencies?incomeTotal.amount:Number(data?.monthlyIncome?.[currency] || 0);
  const priorExpense=allCurrencies?priorTotal.amount:Number(previous?.monthlyExpense?.[currency] || 0);
  const profit=allCurrencies?profitTotal.amount:Number(profits[currency] || 0);
  const missing=[...new Set([...expenseTotal.missing,...incomeTotal.missing,...priorTotal.missing,...profitTotal.missing])];
  const combinedCategories=allCurrencies?summarizeLedgerCategories(data?.categorySpending || [],rates):null;
  const categories=allCurrencies?(combinedCategories || data?.categorySpending || []):(data?.categorySpending || []).filter(row=>row.currency===currency);
  const rows=(data?.recentTransactions || []).filter(row=>allCurrencies||row.currency===currency);
  const formatAmount=value=>value===null?(ratesLoading?'환율 조회 중…':'환율 확인 필요'):money(value,displayCurrency);
  return <div className="ledger-dashboard-page ledger-analytics-page">
    <header className="ledger-dashboard-header"><div><h1>사용 내역 통계</h1><p>기간별 수입과 사용액을 확인하세요.</p></div><select aria-label="통계 통화" value={currency} onChange={e=>{setCurrency(e.target.value);setPage(1);}}><option value="ALL">전체 통화 · 원화 환산</option>{currencies.map(code=><option key={code}>{code}</option>)}</select></header>
    <section className="ledger-card ledger-period-picker" aria-label="조회 기간">
      <div className="ledger-view-switch" role="group" aria-label="기간 단위">{[['daily','일간'],['weekly','주간'],['monthly','월간'],['custom','직접 선택']].map(([value,title])=><button key={value} type="button" aria-pressed={mode===value} className={mode===value?'is-active':''} onClick={()=>{if(value==='custom')setCustom(range);setMode(value);}}>{title}</button>)}</div>
      {mode==='custom' ? <div className="ledger-period-dates"><label>시작일<input type="date" value={custom.from} max={custom.to} onChange={e=>setCustom(c=>({...c,from:e.target.value}))}/></label><label>종료일<input type="date" value={custom.to} min={custom.from} onChange={e=>setCustom(c=>({...c,to:e.target.value}))}/></label></div> : <div className="ledger-period-dates"><button type="button" className="ledger-secondary-btn" aria-label="이전 기간" onClick={()=>setAnchor(shiftPeriod(mode,anchor,-1))}>‹</button><label>{mode==='monthly'?'조회 월':'기준 날짜'}<input type={mode==='monthly'?'month':'date'} value={mode==='monthly'?anchor.slice(0,7):anchor} onChange={e=>{if(e.target.value)setAnchor(mode==='monthly'?e.target.value+'-01':e.target.value);}}/></label><button type="button" className="ledger-secondary-btn" aria-label="다음 기간" onClick={()=>setAnchor(shiftPeriod(mode,anchor,1))}>›</button></div>}
      <div className="ledger-period-caption"><strong>{valid?`${range.from} ~ ${range.to}`:'조회 날짜를 확인하세요.'}</strong><button type="button" className="ledger-secondary-btn" onClick={()=>{setAnchor(dateKey());if(mode==='custom')setCustom(periodRange('monthly'));}}>이번 기간</button></div>
    </section>
    {busy && <p role="status">통계를 계산하고 있습니다.</p>}
    {error && <p className="ws-alert" role="alert">{error} <button type="button" onClick={()=>setRevision(r=>r+1)}>다시 조회</button></p>}
    {!busy && !error && valid && data && <>
      <div className="ledger-kpi-grid"><div className="ledger-kpi-card is-expense"><span>기간 사용액</span><strong>{formatAmount(expense)}</strong><small>{expense===null||priorExpense===null?'환율 확인 후 이전 기간과 비교합니다.':'직전 동일 일수 대비 '+money(Math.abs(expense-priorExpense),displayCurrency)+(expense>=priorExpense?' 증가':' 감소')}</small></div><div className="ledger-kpi-card"><span>기간 수입</span><strong>{formatAmount(income)}</strong></div><div className="ledger-kpi-card"><span>수입 − 사용액</span><strong>{formatAmount(income===null||expense===null?null:income-expense)}</strong></div><div className="ledger-kpi-card"><span>투자 실현 손익</span><strong>{investmentLoading?'조회 중…':investmentError?'조회 실패':formatAmount(profit)}</strong><small>매도 손익 + 손익 정산</small></div></div>
      {investmentError && <p role="alert" className="ws-alert">{investmentError} <button type="button" onClick={()=>setRevision(r=>r+1)}>다시 조회</button></p>}
      {allCurrencies&&<>
        <p className="ledger-currency-note">전체 통화 합계는 현재 조회한 환율로 원화 환산한 참고 금액입니다. 거래일 당시 환율과는 다를 수 있습니다.</p>
        {!ratesLoading&&missing.length>0&&<p className="ws-alert" role="alert">{missing.join(', ')} 환율을 확인하지 못해 해당 합계를 표시하지 않습니다. 아래 통화별 금액과 전체 거래는 확인할 수 있습니다. <button type="button" onClick={refreshRates}>환율 다시 조회</button></p>}
        <section className="ledger-card ledger-currency-breakdown"><header><h2>통화별 내역</h2><details><summary>적용 환율</summary><p>1 KRW = 1원</p>{Object.entries(rates).map(([code,quote])=><p key={code}>1 {code} = {quote.rate.toLocaleString('ko-KR',{maximumFractionDigits:4})}원 · {quote.provider}</p>)}<button type="button" onClick={refreshRates}>환율 새로고침</button></details></header><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>통화</th><th>사용액</th><th>수입</th><th>수지</th><th>투자 손익</th></tr></thead><tbody>{currencies.map(code=><tr key={code}><td><strong>{code}</strong></td><td>{money(data.monthlyExpense?.[code],code)}</td><td>{money(data.monthlyIncome?.[code],code)}</td><td>{money(Number(data.monthlyIncome?.[code] || 0)-Number(data.monthlyExpense?.[code] || 0),code)}</td><td>{investmentLoading?'조회 중…':investmentError?'조회 실패':money(profits[code],code)}</td></tr>)}</tbody></table></div></section>
      </>}
      <p className="ledger-empty-copy">계좌 이체·투자 매수·예수금 입출금·잔액 조정은 사용액에서 제외합니다. 거래 목록의 금액은 원래 통화로 표시합니다.</p>
      <section className="ledger-card"><header><h2>카테고리별 사용액</h2>{allCurrencies&&<span>{combinedCategories?'전체 통화 · 원화 환산':'환율 확인 전 · 통화별 표시'}</span>}</header><div className="ledger-category-list">{categories.map(row=><div key={row.currency+'-'+row.category}><div><strong>{row.category}</strong><em>{money(row.amount,row.currency)} · {Number(row.ratio).toFixed(1)}%</em></div><span className="ledger-progress"><i style={{width:`${Math.min(100,Number(row.ratio))}%`,backgroundColor:'#477266'}}/></span></div>)}</div>{!categories.length&&<p className="ledger-empty-copy">이 기간에 지출이 없습니다.</p>}</section>
      <section className="ledger-card"><header><h2>기간 내 거래</h2><span>{allCurrencies?'전체 통화 · ':''}{rows.length}건</span></header><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>날짜</th><th>거래</th><th>계좌</th><th>금액</th></tr></thead><tbody>{rows.slice((page-1)*10,page*10).map(row=><tr key={row.transactionId}><td>{row.transactionDate.slice(0,10)}</td><td>{row.title}<small>{row.category}</small></td><td>{row.accountName}</td><td>{row.transactionType==='EXPENSE'?'−':row.transactionType==='INCOME'?'+':''}{money(row.amount,row.currency)} <small>{row.currency}</small></td></tr>)}</tbody></table></div>{!rows.length&&<p className="ledger-empty-copy">이 기간에 거래가 없습니다.</p>}{rows.length>10&&<div className="ws-pagination"><button type="button" disabled={page===1} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} / {Math.ceil(rows.length/10)}</span><button type="button" disabled={page*10>=rows.length} onClick={()=>setPage(p=>p+1)}>다음</button></div>}</section>
    </>}
  </div>;
}
