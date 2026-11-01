import { useEffect, useState } from 'react';
import { getLedgerDashboard } from '../../api/ledger';
import { summarizeAssets, convertAssetsToKrw } from '../../services/assetSummary';
import { useAssetRates } from '../../services/useAssetRates';
import { dateKey, ledgerMoney as money } from '../../services/ledgerPeriod';
import '../../styles/ledger-overview.css';

const accountTypes = {
  CHECKING: {label:'입출금',color:'#347d72'},
  SAVINGS: {label:'저축·예금',color:'#7a83b6'},
  INVESTMENT: {label:'투자',color:'#d3a367'},
  FOREIGN_CURRENCY: {label:'외화',color:'#78a5be'},
  DEBT: {label:'부채',color:'#c8807c'},
};
const compactMoney = amount => new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:1}).format(amount);

function SpendingChart({rows,previousRows,currency,month}) {
  const [view,setView] = useState('cumulative');
  const [year,monthNumber] = month.split('-').map(Number);
  const daysInMonth = new Date(year,monthNumber,0).getDate();
  const elapsed = month===dateKey().slice(0,7) ? new Date().getDate() : daysInMonth;
  const values = (items,limit) => {
    const daily=Array.from({length:limit},()=>0);
    for(const row of items) {
      if(row.transactionType!=='EXPENSE'||row.currency!==currency)continue;
      const day=Number(row.transactionDate.slice(8,10));
      if(day>0&&day<=limit)daily[day-1]+=Number(row.amount || 0);
    }
    return daily.map((value,index)=>view==='daily'?value:daily.slice(0,index+1).reduce((sum,v)=>sum+v,0));
  };
  const current=values(rows,elapsed), prior=values(previousRows || [],elapsed);
  const max=Math.max(...current,...prior,1);
  const x=index=>48+(elapsed===1?0:index/(elapsed-1)*586), y=value=>158-value/max*130;
  const points=series=>series.map((value,index)=>x(index)+','+y(value)).join(' ');
  const line=current.map((value,index)=>(index?'L':'M')+x(index)+' '+y(value)).join(' ');
  const ticks=[...new Set([0,Math.floor((elapsed-1)/2),elapsed-1])];
  return <>
    <div className="overview-chart-tools"><div className="overview-chart-legend"><span><i/>이번 달</span><span><i/>지난달 같은 기간</span></div><div className="overview-segment" role="group" aria-label="지출 차트 표시">{[['cumulative','누적 지출'],['daily','일별 지출']].map(([value,label])=><button type="button" key={value} aria-pressed={view===value} onClick={()=>setView(value)}>{label}</button>)}</div></div>
    <svg className="overview-spending-chart" viewBox="0 0 660 190" role="img" aria-label={currency+' '+(view==='daily'?'일별':'누적')+' 지출 추이'}>
      {[0,.5,1].map(ratio=><g key={ratio}><line x1="48" x2="634" y1={y(max*ratio)} y2={y(max*ratio)} stroke="#e9eeef" strokeDasharray="3 4"/><text x="38" y={y(max*ratio)+4} textAnchor="end">{compactMoney(max*ratio)}</text></g>)}
      {previousRows&&view==='daily'&&<polyline points={points(prior)} fill="none" stroke="#bac7cf" strokeWidth="2" strokeDasharray="5 5"/>}
      {view==='cumulative'?<><path d={line+' L'+x(elapsed-1)+' 158 L48 158 Z'} fill="#e4f0ed"/>{previousRows&&<polyline points={points(prior)} fill="none" stroke="#bac7cf" strokeWidth="2" strokeDasharray="5 5"/>}<polyline points={points(current)} fill="none" stroke="#347d72" strokeWidth="2.5" strokeLinejoin="round"/>{current.map((value,index)=><circle key={index} cx={x(index)} cy={y(value)} r={elapsed<12?3:2} fill="#347d72"><title>{index+1}일 누적 {money(value,currency)}</title></circle>)}</>:current.map((value,index)=><rect key={index} x={x(index)-Math.min(8,220/elapsed)} y={y(value)} width={Math.min(16,440/elapsed)} height={158-y(value)} rx="2" fill="#4c9588"><title>{index+1}일 {money(value,currency)}</title></rect>)}
      {ticks.map(index=><text key={index} x={x(index)} y="180" textAnchor="middle">{monthNumber}월 {index+1}일</text>)}
    </svg>
    {!current.some(Boolean)&&<p className="overview-chart-empty">아직 이번 달에 기록한 지출이 없습니다.</p>}
  </>;
}

export default function CompactLedgerOverview({accountsSummary,data,onSelectAccount,onNavigateAnalytics,onNavigateTransactions,onNavigateAccounts,onQuickExpense,onTransfer,onSettlement}) {
  const accounts=(accountsSummary?.accounts || []).filter(a=>a.isActive!==false&&a.active!==false);
  const assets=summarizeAssets(accounts,data.investment);
  const {rates,loading,refresh}=useAssetRates(assets.currencies);
  const converted=convertAssetsToKrw(assets,rates);
  const cashAccounts=accounts.filter(a=>a.accountType==='CHECKING');
  const availableCash=convertAssetsToKrw(summarizeAssets(cashAccounts),rates);
  const investments=accounts.filter(a=>a.accountType==='INVESTMENT');
  const [previous,setPrevious]=useState(null), [comparisonError,setComparisonError]=useState(false);
  const [selectedCurrency,setSelectedCurrency]=useState('KRW');
  useEffect(()=>{
    let alive=true;setPrevious(null);setComparisonError(false);
    const today=new Date(), prior=new Date(today.getFullYear(),today.getMonth()-1,1);
    const last=new Date(today.getFullYear(),today.getMonth(),0);
    prior.setDate(Math.min(today.getDate(),last.getDate()));
    const end=dateKey(prior);prior.setDate(1);
    getLedgerDashboard({from:dateKey(prior),to:end}).then(result=>{if(alive)setPrevious(result);}).catch(()=>{if(alive)setComparisonError(true);});
    return()=>{alive=false;};
  },[data]);
  const currencies=[...new Set(['KRW',...Object.keys(data.monthlyExpense || {}),...Object.keys(data.monthlyIncome || {}),...Object.keys(previous?.monthlyExpense || {})])];
  const currency=currencies.includes(selectedCurrency)?selectedCurrency:'KRW';
  const expense=Number(data.monthlyExpense?.[currency] || 0), income=Number(data.monthlyIncome?.[currency] || 0), net=income-expense;
  const priorExpense=Number(previous?.monthlyExpense?.[currency] || 0), diff=expense-priorExpense;
  const categories=(data.categorySpending || []).filter(row=>row.currency===currency);
  const allocation=Object.entries(accountTypes).filter(([type])=>type!=='DEBT').map(([type,meta])=>({
    type,...meta,amount:accounts.filter(a=>a.accountType===type).reduce((sum,a)=>sum+Number(a.cachedBookBalance || 0)*(a.currency==='KRW'?1:rates[a.currency]?.rate || 0),0)+(type==='INVESTMENT'?converted.market:0),
  })).filter(row=>row.amount>0);
  const positiveAssets=allocation.reduce((sum,row)=>sum+row.amount,0);
  let angle=0;
  const gradient=allocation.map(row=>{const start=angle;angle+=row.amount/(positiveAssets || 1)*100;return row.color+' '+start+'% '+angle+'%';}).join(',');
  const assetAmount=value=>converted.complete?money(value):loading?'환율 조회 중…':'환율 확인 필요';
  const recent=(data.recentTransactions || []).slice(0,6);
  const visibleAccounts=[...accounts].sort((a,b)=>Number(a.displayOrder || 0)-Number(b.displayOrder || 0)).slice(0,5);
  return <div className="ledger-compact-overview overview-workbench">
    <div className="overview-commandbar"><div><span className="overview-live-dot"/><strong>{data.month?.replace('-','년 ')}월</strong><span>오늘까지 기록 · 자산은 현재 잔액</span></div><div className="overview-command-actions"><label>거래 통화<select aria-label="대시보드 거래 통화" value={currency} onChange={e=>setSelectedCurrency(e.target.value)}>{currencies.map(code=><option key={code}>{code}</option>)}</select></label><button type="button" className="overview-action" disabled={accounts.length<2} onClick={onTransfer}>↔ 계좌 이체</button><button type="button" className="overview-action" disabled={!investments.length} onClick={onSettlement}>투자 손익 정산</button><button type="button" className="overview-action is-primary" disabled={!cashAccounts.length} onClick={onQuickExpense}>＋ 지출 입력</button></div></div>

    <div className="overview-metrics">
      <section className="overview-metric is-assets"><div><span>총자산</span><span className="overview-metric-unit">KRW 환산</span></div><strong>{assetAmount(converted.amount)}</strong><small>현금성 자산 + 투자 평가금액</small></section>
      <button type="button" className="overview-metric" onClick={onNavigateAnalytics}><div><span>이번 달 사용액</span><span className="overview-metric-arrow">↗</span></div><strong>{money(expense,currency)}</strong><small className={previous&&diff>0?'is-warning':''}>{previous?(diff===0?'지난달 같은 기간과 동일':money(Math.abs(diff),currency)+(diff>0?' 더 사용':' 덜 사용')):comparisonError?'지난달 비교 조회 실패':'지난달과 비교 중…'}</small></button>
      <button type="button" className="overview-metric" onClick={onNavigateAnalytics}><div><span>이번 달 수지</span><span className="overview-metric-arrow">↗</span></div><strong className={net<0?'overview-negative':'overview-positive'}>{net>0?'+':''}{money(net,currency)}</strong><small>수입 {money(income,currency)} − 지출</small></button>
      <section className="overview-metric"><div><span>순자산</span><span className="overview-metric-unit">KRW 환산</span></div><strong>{assetAmount(converted.net)}</strong><small>총자산 − 부채 {converted.complete?money(converted.debt):'환율 확인 필요'}</small></section>
    </div>

    <div className="overview-panel-grid">
      <section className="overview-panel overview-flow"><header><div><h2>지출 흐름</h2><p>이번 달 지출을 지난달 같은 기간과 비교합니다.</p></div><button type="button" onClick={onNavigateAnalytics}>기간별 통계 ↗</button></header><SpendingChart rows={data.recentTransactions || []} previousRows={previous?.recentTransactions} currency={currency} month={data.month || dateKey().slice(0,7)}/><div className="overview-top-categories"><span>많이 쓴 곳</span>{categories.slice(0,3).map((row,index)=><button type="button" key={row.category} onClick={onNavigateAnalytics}><i>{index+1}</i><span>{row.category}</span><strong>{money(row.amount,currency)}</strong></button>)}{!categories.length&&<small>지출을 기록하면 카테고리별로 표시됩니다.</small>}</div></section>

      <section className="overview-panel overview-allocation"><header><div><h2>자산 구성</h2><p>현재 평가액 · 원화 환산</p></div><button type="button" onClick={onNavigateAccounts}>계좌 관리 ↗</button></header>{converted.complete?<><div className="overview-donut" role="img" aria-label={allocation.map(row=>row.label+' '+money(row.amount)).join(', ') || '등록된 자산 없음'} style={{background:gradient?'conic-gradient('+gradient+')':'#edf1f3'}}><div><span>투자 평가액</span><strong>{money(converted.market)}</strong></div></div><div className="overview-allocation-legend">{allocation.map(row=><div key={row.type}><i style={{background:row.color}}/><span>{row.label}</span><strong>{money(row.amount)}</strong><small>{(row.amount/(positiveAssets || 1)*100).toFixed(0)}%</small></div>)}</div>{!allocation.length&&<p className="overview-empty">계좌를 등록하면 자산 구성을 확인할 수 있습니다.</p>}</>:<div className="overview-rate-state"><p>{loading?'환율을 조회하고 있습니다.':'외화 환율을 확인하지 못했습니다.'}</p><button type="button" onClick={refresh}>환율 다시 조회</button></div>}</section>

      <section className="overview-panel overview-transactions"><header><div><h2>최근 거래</h2><p>이번 달 생활비·입출금 내역</p></div><button type="button" onClick={()=>onNavigateTransactions('ALL')}>전체 내역 ↗</button></header><div className="overview-table-wrap"><table className="overview-transaction-table"><thead><tr><th>날짜</th><th>거래 내역</th><th>계좌</th><th>금액</th></tr></thead><tbody>{recent.map(row=><tr key={row.transactionId}><td>{row.transactionDate.slice(5,10).replace('-','.')}</td><td><span className={'overview-transaction-mark '+(row.transactionType==='INCOME'?'is-in':'')}>{row.transactionType==='INCOME'?'↙':'↗'}</span><span><strong>{row.title}</strong><small>{row.category}</small></span></td><td>{row.accountName}</td><td className={row.transactionType==='INCOME'?'overview-positive':''}>{row.transactionType==='EXPENSE'?'−':row.transactionType==='INCOME'?'+':''}{money(row.amount,row.currency)}</td></tr>)}</tbody></table></div>{!recent.length&&<div className="overview-empty"><strong>아직 이번 달 거래가 없습니다.</strong><p>지출을 기록하면 흐름과 사용 내역이 함께 채워집니다.</p><button type="button" disabled={!cashAccounts.length} onClick={onQuickExpense}>첫 지출 기록하기</button></div>}</section>

      <section className="overview-panel overview-accounts"><header><div><h2>계좌 현황 <span>{accounts.length}</span></h2><p>생활 계좌 잔액 {availableCash.complete?money(availableCash.cash):'환율 확인 필요'}</p></div><button type="button" onClick={onNavigateAccounts}>전체 보기 ↗</button></header><div className="overview-account-list">{visibleAccounts.map(account=>{const meta=accountTypes[account.accountType] || {label:'계좌',color:'#82909c'};return <button type="button" key={account.accountId} onClick={()=>onSelectAccount?.(account)}><span className="overview-account-icon" style={{color:meta.color,background:meta.color+'14'}}>{meta.label.slice(0,1)}</span><span><strong>{account.accountName}</strong><small>{account.bankName || meta.label} · {account.currency}</small></span><span><strong>{money(account.accountType==='DEBT'?Math.abs(Number(account.cachedBookBalance || 0)):account.cachedBookBalance,account.currency)}</strong><small>{account.accountType==='INVESTMENT'?'예수금':account.accountType==='DEBT'?'남은 부채':meta.label}</small></span></button>;})}</div>{!accounts.length&&<p className="overview-empty">계좌를 등록해 자산 관리를 시작하세요.</p>}<details className="overview-native-totals"><summary>통화별 자산 합계</summary>{assets.rows.map(row=><p key={row.currency}><span>{row.currency}</span><strong>{money(row.amount,row.currency)}</strong></p>)}</details></section>
    </div>
  </div>;
}
