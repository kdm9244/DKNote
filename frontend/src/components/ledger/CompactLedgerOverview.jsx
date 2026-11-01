import { useEffect, useState } from 'react';
import { getLedgerDashboard } from '../../api/ledger';
import { summarizeAssets, convertAssetsToKrw } from '../../services/assetSummary';
import { useAssetRates } from '../../services/useAssetRates';
import { dateKey, ledgerMoney as money } from '../../services/ledgerPeriod';

export default function CompactLedgerOverview({accountsSummary,data,onNavigateAnalytics,onNavigateTransactions,onNavigateAccounts,onQuickExpense,onTransfer,onSettlement}) {
  const accounts = accountsSummary?.accounts || [];
  const assets = summarizeAssets(accounts,data.investment);
  const {rates,loading,refresh} = useAssetRates(assets.currencies);
  const converted = convertAssetsToKrw(assets,rates);
  const [previous,setPrevious] = useState(null);
  useEffect(()=>{
    let alive=true;
    const today=new Date(), prior=new Date(today.getFullYear(),today.getMonth()-1,1);
    const last=new Date(today.getFullYear(),today.getMonth(),0);
    prior.setDate(Math.min(today.getDate(),last.getDate()));
    const end=dateKey(prior);prior.setDate(1);
    getLedgerDashboard({from:dateKey(prior),to:end}).then(result=>{if(alive)setPrevious(result);}).catch(()=>{if(alive)setPrevious(null);});
    return()=>{alive=false;};
  },[data]);
  const currencies = [...new Set([...Object.keys(data.monthlyExpense || {}),...Object.keys(previous?.monthlyExpense || {}),'KRW'])];
  const cashAccounts=accounts.filter(a=>a.accountType==='CHECKING');
  const availableCash=convertAssetsToKrw(summarizeAssets(cashAccounts),rates);
  const investments=accounts.filter(a=>a.accountType==='INVESTMENT');
  return <div className="ledger-compact-overview">
    <button type="button" className="ledger-spending-hero" onClick={onNavigateAnalytics}>
      <span>이번 달 사용액</span>{currencies.map(currency=>{const amount=Number(data.monthlyExpense?.[currency] || 0),diff=amount-Number(previous?.monthlyExpense?.[currency] || 0);return <div key={currency}><strong>{money(amount,currency)}</strong>{previous&&<small>지난달 같은 기간보다 {money(Math.abs(diff),currency)} {diff>=0?'더 사용':'덜 사용'}</small>}</div>;})}<span className="ledger-hero-link">기간별 통계 보기 →</span>
    </button>
    <div className="ledger-compact-assets"><section className="ledger-kpi-card"><span>현재 총자산</span><strong>{converted.complete?money(converted.amount):loading?'환율 조회 중…':'환율 조회 필요'}</strong><details><summary>통화별 내역</summary>{assets.rows.map(row=><p key={row.currency}>{money(row.amount,row.currency)}</p>)}</details></section><section className="ledger-kpi-card"><span>생활 계좌 잔액</span><strong>{availableCash.complete?money(availableCash.cash):loading?'환율 조회 중…':'환율 조회 필요'}</strong><small>입출금 계좌 기준 · 원화 환산</small></section>{!loading&&!converted.complete&&<button type="button" onClick={refresh}>환율 다시 조회</button>}</div>
    <section className="ledger-card ledger-quick-actions"><header><h2>빠른 기록</h2></header><div><button type="button" className="ledger-primary-btn" disabled={!cashAccounts.length} onClick={onQuickExpense}>＋ 지출 입력</button><button type="button" className="ledger-secondary-btn" disabled={accounts.length<2} onClick={onTransfer}>↔ 계좌 이체</button><button type="button" className="ledger-secondary-btn" disabled={!investments.length} onClick={onSettlement}>투자 손익 정산</button></div>{!cashAccounts.length&&<p className="ledger-empty-copy">지출을 기록할 입출금 계좌를 등록하세요.</p>}{!investments.length&&<p className="ledger-empty-copy">투자 계좌를 등록하면 손익을 정산할 수 있습니다.</p>}<button type="button" className="investment-text-btn" onClick={onNavigateAccounts}>계좌 관리 →</button></section>
    <section className="ledger-card"><header><h2>이번 달 최근 거래</h2><button type="button" onClick={()=>onNavigateTransactions('ALL')}>전체 내역 →</button></header><div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>날짜</th><th>내역</th><th>계좌</th><th>금액</th></tr></thead><tbody>{(data.recentTransactions || []).slice(0,5).map(row=><tr key={row.transactionId}><td>{row.transactionDate.slice(5,10)}</td><td>{row.title}</td><td>{row.accountName}</td><td>{row.transactionType==='EXPENSE'?'−':row.transactionType==='INCOME'?'+':''}{money(row.amount,row.currency)}</td></tr>)}</tbody></table></div>{!data.recentTransactions?.length&&<p className="ledger-empty-copy">아직 이번 달에 기록한 거래가 없습니다.</p>}</section>
  </div>;
}
