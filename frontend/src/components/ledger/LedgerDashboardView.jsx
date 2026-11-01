import React, { useEffect, useState } from 'react';
import { getLedgerDashboard } from '../../api/ledger';
import { syncInvestmentPrices } from '../../api/investment';
import CompactLedgerOverview from './CompactLedgerOverview';
import { dateKey } from '../../services/ledgerPeriod';

const ASSET_META = {
  INDEX_ETF: { label: '지수 ETF', color: '#4686b4' },
  DOMESTIC_STOCK: { label: '국내 개별주', color: '#d59a4a' },
  FOREIGN_STOCK: { label: '해외 개별주', color: '#3d946f' },
  DIVIDEND_ASSET: { label: '배당주·ETF', color: '#b26952' },
  CASH: { label: '현금·예수금', color: '#9baab1' },
};

const currencySymbol = { KRW: '₩', USD: '$', JPY: '¥' };
const INVESTMENT_RECENT_LIMIT = 8;
const DEBT_RECENT_LIMIT = 5;
const INVESTMENT_ACCOUNT_LIMIT = 4;
const money = (value, currency = 'KRW', signed = false) => {
  const number = Number(value || 0);
  const sign = number < 0 ? '-' : signed && number > 0 ? '+' : '';
  const digits = currency === 'KRW' ? 0 : 2;
  return `${sign}${currencySymbol[currency] || currency} ${Math.abs(number).toLocaleString('ko-KR', { maximumFractionDigits: digits })}`;
};
const percent = (value) => `${Number(value || 0) > 0 ? '+' : ''}${Number(value || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}%`;
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (value) => {
  const [year, month] = value.split('-');
  return `${year}년 ${Number(month)}월`;
};
const moveMonth = (value, amount) => {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const dateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};
const donutBackground = (items) => {
  if (!items.length || items.every((item) => Number(item.ratio ?? item.percent) === 0)) return '#e8ecec';
  let start = 0;
  const parts = items.map((item) => {
    const end = start + Number(item.ratio ?? item.percent);
    const part = `${item.color} ${start}% ${end}%`;
    start = end;
    return part;
  });
  return `conic-gradient(${parts.join(', ')})`;
};

function AmountStack({ values, field, empty = '기록 없음', signed = false }) {
  if (!values?.length) return <span className="ledger-empty-value">{empty}</span>;
  return <div className="ledger-amount-stack">{values.map((item) => (
    <strong key={item.currency} className={signed ? Number(item[field]) >= 0 ? 'is-positive' : 'is-negative' : ''}>
      {money(item[field], item.currency, signed)}
    </strong>
  ))}</div>;
}

function DashboardHeader({ mode, onModeChange, month, onMonthChange, onOpenCreateView }) {
  const copy = mode === 'investment'
    ? { title: '투자 포트폴리오 대시보드', description: '모든 투자계좌의 보유 종목과 수익 현황을 통합해 확인합니다.' }
    : mode === 'debt'
      ? { title: '부채 관리 대시보드', description: '남은 부채와 월 상환액, 금리와 만기 현황을 한눈에 확인합니다.' }
      : { title: '자산 대시보드', description: '자산 현황과 이번 달 자금 흐름을 한눈에 확인하세요.' };
  return <div className="ledger-dashboard-header">
    <div>
      <div className="ledger-view-switch" role="tablist" aria-label="대시보드 보기 전환">
        <button type="button" role="tab" aria-selected={mode === 'overview'} className={mode === 'overview' ? 'is-active' : ''} onClick={() => onModeChange('overview')}>요약</button>
        <button type="button" role="tab" aria-selected={mode === 'investment'} className={mode === 'investment' ? 'is-active' : ''} onClick={() => onModeChange('investment')}>투자</button>
        <button type="button" role="tab" aria-selected={mode === 'debt'} className={mode === 'debt' ? 'is-active' : ''} onClick={() => onModeChange('debt')}>부채</button>
      </div>
      <h1>{copy.title}</h1>
      <p>{copy.description}</p>
    </div>
    <div className="ledger-dashboard-actions">
      {mode!=='overview'&&<div className="ledger-month-control">
        <button type="button" aria-label="이전 달" onClick={() => onMonthChange(moveMonth(month, -1))}>‹</button>
        <label><span>{monthLabel(month)}</span><input type="month" value={month} max={currentMonth()} onChange={(event) => { if (event.target.value) onMonthChange(event.target.value); }} /></label>
        <button type="button" aria-label="다음 달" disabled={month >= currentMonth()} onClick={() => onMonthChange(moveMonth(month, 1))}>›</button>
      </div>}
      <button type="button" className="ledger-primary-btn" onClick={onOpenCreateView}>+ 계좌 등록</button>
    </div>
  </div>;
}

function InvestmentDashboard({ data, accounts, onSelectAccount, onNavigateAccounts, onNavigateTransactions, onSyncPrices, syncingPrices }) {
  const overview = data.investment || {};
  const totals = overview.totals || [];
  const currencies = totals.map((item) => item.currency);
  const [currency, setCurrency] = useState(currencies[0] || 'KRW');
  const currencyKey = currencies.join('|');
  useEffect(() => { const available=currencyKey?currencyKey.split('|'):[];if(available.length&&!available.includes(currency))setCurrency(available[0]); }, [currencyKey,currency]);
  const selectedTotal = totals.find((item) => item.currency === currency);
  const allocations = (overview.allocations || []).filter((item) => item.currency === currency).map((item) => ({ ...item, ...ASSET_META[item.assetClass] }));
  const openAccount = (accountId) => { const account = accounts.find((item) => item.accountId === accountId); if (account) onSelectAccount(account); };
  const selectedMonthLabel = monthLabel(data.month);

  if (!overview.accountCount) return <section className="ledger-investment-empty"><span>📈</span><h2>투자계좌를 등록하면 포트폴리오가 여기에 모입니다.</h2><p>계좌별 평가금액, 수익률, 보유종목과 자산 배분을 한 화면에서 확인할 수 있습니다.</p></section>;

  return <>
    <div className="ledger-kpi-grid ledger-investment-kpis">
      <div className="ledger-kpi-card"><div className="ledger-kpi-label-row"><span>현재 투자자산</span><button type="button" onClick={onSyncPrices} disabled={syncingPrices}>{syncingPrices ? '동기화 중…' : '↻ 전체 동기화'}</button></div><AmountStack values={totals} field="totalAsset" /><small>월 선택과 관계없는 현재 평가액 · {overview.accountCount}개 계좌</small></div>
      <div className="ledger-kpi-card"><span>투자 원금</span><AmountStack values={totals} field="investedPrincipal" /><small>보유종목 매입원가</small></div>
      <div className="ledger-kpi-card is-income"><span>평가손익</span><AmountStack values={totals} field="unrealizedProfitLoss" signed /><small>{totals.map((item) => `${item.currency} ${percent(item.returnRate)}`).join(' · ') || '수익률 계산 대기'}</small></div>
      <div className="ledger-kpi-card is-net"><span>{selectedMonthLabel} 배당</span><AmountStack values={totals} field="monthlyDividend" /><small>선택한 달의 세금·수수료 반영 순수령액</small></div>
    </div>

    <div className="ledger-dashboard-grid ledger-investment-dashboard-grid">
      <div className="ledger-grid-left">
        <section className="ledger-card ledger-holdings-card"><header><div><span className="ledger-eyebrow">PORTFOLIO</span><h2>통합 보유 종목</h2></div><span>{overview.holdingCount}종목</span></header>
          <div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>종목</th><th>계좌</th><th>현재가</th><th>평가금액</th><th>평가손익</th><th>수익률</th></tr></thead><tbody>{overview.holdings?.map((item) => <tr key={item.investmentId} onClick={() => openAccount(item.accountId)}><td><strong>{item.symbolName}</strong><small>{item.tickerCode} · {item.market}</small></td><td>{item.accountName}</td><td>{money(item.currentPrice, item.quoteCurrency)}</td><td><strong>{money(item.marketValue, item.accountCurrency)}</strong></td><td className={Number(item.profitLoss) >= 0 ? 'is-positive' : 'is-negative'}>{money(item.profitLoss, item.accountCurrency, true)}</td><td className={Number(item.returnRate) >= 0 ? 'is-positive' : 'is-negative'}>{percent(item.returnRate)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="ledger-card ledger-investment-activity-card"><header><div><span className="ledger-eyebrow">MONTHLY ACTIVITY</span><h2>{selectedMonthLabel} 최근 투자 거래</h2></div><div className="ledger-card-header-actions"><span>최근 8건</span><button type="button" onClick={() => onNavigateTransactions('INVESTMENT')}>전체보기</button></div></header>
          <div className="ledger-table-scroll"><table className="ledger-table ledger-investment-activity-table"><thead><tr><th>일시</th><th>구분</th><th>종목</th><th>계좌</th><th>거래 금액</th></tr></thead><tbody>
            {overview.recentTrades?.slice(0, INVESTMENT_RECENT_LIMIT).map((item) => <tr key={item.transactionId} onClick={() => openAccount(item.accountId)}><td>{dateTime(item.tradeDate)}</td><td><span className={`ledger-trade-badge is-${item.tradeType.toLowerCase()}`}>{item.tradeType === 'PROFIT_SETTLEMENT' ? '손익 정산' : item.tradeType === 'BUY' ? '매수' : item.tradeType === 'SELL' ? '매도' : item.tradeType === 'DIVIDEND' ? '배당' : item.tradeType === 'DEPOSIT' ? '입금' : '출금'}</span></td><td><strong>{item.symbolName}</strong></td><td>{item.accountName}</td><td className={Number(item.netAmount) >= 0 ? 'is-positive' : 'is-negative'}><strong>{money(item.netAmount, item.accountCurrency, true)}</strong></td></tr>)}
            {!overview.recentTrades?.length && <tr><td colSpan="5"><div className="ledger-table-empty">{selectedMonthLabel}에 등록된 투자 거래가 없습니다.</div></td></tr>}
          </tbody></table></div>
        </section>
      </div>

      <div className="ledger-grid-right">
        <section className="ledger-card ledger-allocation-card"><header><div><span className="ledger-eyebrow">ALLOCATION</span><h2>통합 자산 배분</h2></div><select value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((item) => <option key={item}>{item}</option>)}</select></header><div className="ledger-donut-layout is-compact"><div className="ledger-css-donut" style={{ background: donutBackground(allocations) }}><div><span>총 자산</span><strong>{money(selectedTotal?.totalAsset, currency)}</strong></div></div><div className="ledger-donut-legend">{allocations.map((item) => <div key={item.assetClass}><span className="ledger-color-dot" style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{money(item.amount, currency)}</strong><em>{Number(item.ratio).toFixed(1)}%</em></div>)}</div></div></section>

        <section className="ledger-card ledger-investment-accounts is-compact"><header><div><span className="ledger-eyebrow">ACCOUNTS</span><h2>투자계좌별 현황</h2></div><div className="ledger-card-header-actions"><span>최대 4개</span><button type="button" onClick={onNavigateAccounts}>전체보기</button></div></header><div className="ledger-investment-account-grid">{overview.accounts?.slice(0, INVESTMENT_ACCOUNT_LIMIT).map((item) => <button type="button" key={item.accountId} onClick={() => openAccount(item.accountId)}><span><strong>{item.accountName}</strong><small>{item.bankName || '금융기관 미등록'} · {item.currency}</small></span><span><strong>{money(item.totalAsset, item.currency)}</strong><small className={Number(item.unrealizedProfitLoss) >= 0 ? 'is-positive' : 'is-negative'}>{money(item.unrealizedProfitLoss, item.currency, true)} · {percent(item.returnRate)}</small></span><em>{item.holdingCount}종목 →</em></button>)}</div></section>

      </div>
    </div>
  </>;
}

function DebtDashboard({ data, accounts, onSelectAccount, onOpenCreateView, onNavigateAccounts, onNavigateTransactions }) {
  const overview = data.debt || {};
  const totals = overview.totals || [];
  const selectedMonthLabel = monthLabel(data.month);
  const openAccount = (accountId) => {
    const account = accounts.find((item) => item.accountId === accountId);
    if (account) onSelectAccount(account);
  };

  if (!overview.accountCount) return <section className="ledger-investment-empty ledger-debt-empty">
    <span>🧾</span>
    <h2>등록된 부채 계좌가 없습니다.</h2>
    <p>대출이나 마이너스통장을 등록하면 남은 원금, 월 상환액, 금리와 만기를 관리할 수 있습니다.</p>
    <button type="button" className="ledger-primary-btn" onClick={onOpenCreateView}>+ 부채 계좌 등록</button>
  </section>;

  return <>
    <div className="ledger-kpi-grid ledger-debt-kpis">
      <div className="ledger-kpi-card is-debt"><span>현재 남은 부채</span><AmountStack values={totals} field="outstandingDebt" /><small>{overview.accountCount}개 부채 계좌 합계</small></div>
      <div className="ledger-kpi-card is-income"><span>{selectedMonthLabel} 상환</span><AmountStack values={totals} field="monthlyRepayment" /><small>선택한 달에 실제로 줄인 부채</small></div>
      <div className="ledger-kpi-card"><span>월 상환 계획</span><AmountStack values={totals} field="plannedMonthlyPayment" /><small>계좌 등록 시 설정한 예정 상환액</small></div>
      <div className="ledger-kpi-card is-expense"><span>예상 월 이자</span><AmountStack values={totals} field="estimatedMonthlyInterest" /><small>현재 잔액과 연 금리로 계산한 참고값</small></div>
    </div>

    <div className="ledger-dashboard-grid ledger-debt-dashboard-grid">
      <div className="ledger-grid-left">
        <section className="ledger-card ledger-debt-accounts-card">
          <header><div><span className="ledger-eyebrow">LIABILITIES</span><h2>부채 계좌 현황</h2></div><div className="ledger-card-header-actions"><button type="button" onClick={onNavigateAccounts}>전체보기</button><button type="button" onClick={onOpenCreateView}>+ 부채 추가</button></div></header>
          <div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>계좌</th><th>구분</th><th>남은 부채</th><th>금리</th><th>월 상환 계획</th><th>만기</th></tr></thead><tbody>
            {overview.accounts?.slice(0, 10).map((item) => <tr key={item.accountId} onClick={() => openAccount(item.accountId)}>
              <td><strong>{item.accountName}</strong><small>{item.bankName || '금융기관 미등록'}</small></td>
              <td>{item.accountPurpose === 'CREDIT_LINE' ? '마이너스통장' : '대출'}</td>
              <td><strong>{money(item.outstandingDebt, item.currency)}</strong></td>
              <td>{item.interestRate == null ? '-' : `${Number(item.interestRate).toLocaleString('ko-KR')}%`}</td>
              <td>{item.monthlyPayment == null ? '-' : money(item.monthlyPayment, item.currency)}</td>
              <td>{item.maturityDate ? new Date(`${item.maturityDate}T00:00:00`).toLocaleDateString('ko-KR') : '-'}</td>
            </tr>)}
          </tbody></table></div>
        </section>

        <section className="ledger-card ledger-recent-card">
          <header><div><span className="ledger-eyebrow">MONTHLY ACTIVITY</span><h2>{selectedMonthLabel} 최근 부채 변동</h2></div><div className="ledger-card-header-actions"><span>최근 5건</span><button type="button" onClick={() => onNavigateTransactions('DEBT')}>전체보기</button></div></header>
          <div className="ledger-activity-list">{overview.recentTransactions?.slice(0, DEBT_RECENT_LIMIT).map((item) => {
            const isRepayment = item.transactionType === 'INCOME';
            return <button type="button" key={item.transactionId} onClick={() => openAccount(item.accountId)}>
              <span className={`ledger-activity-icon ${isRepayment ? 'is-income' : 'is-expense'}`}>{isRepayment ? '↓' : '↑'}</span>
              <span><strong>{item.title}</strong><small>{item.accountName} · {isRepayment ? '부채 상환' : '추가 대출·이자'} · {dateTime(item.transactionDate)}</small></span>
              <em className={isRepayment ? 'is-positive' : 'is-negative'}>{isRepayment ? '-' : '+'}{money(item.amount, item.currency)}</em>
            </button>;
          })}{!overview.recentTransactions?.length && <p className="ledger-empty-copy">{selectedMonthLabel}에 등록된 부채 변동이 없습니다.</p>}</div>
        </section>
      </div>

      <div className="ledger-grid-right">
        <section className="ledger-card ledger-debt-health-card"><header><div><span className="ledger-eyebrow">PAYOFF PLAN</span><h2>상환 상태</h2></div></header>
          <div className="ledger-debt-health-list">{totals.map((item) => {
            const plan = Number(item.plannedMonthlyPayment || 0);
            const paid = Number(item.monthlyRepayment || 0);
            const progress = plan > 0 ? Math.min(100, paid / plan * 100) : 0;
            return <div key={item.currency}><div><span>{item.currency}</span><strong>{plan ? `${progress.toFixed(0)}%` : '계획 미설정'}</strong></div><span className="ledger-progress"><i style={{ width: `${progress}%` }} /></span><small>상환 {money(paid, item.currency)} / 계획 {money(plan, item.currency)}</small></div>;
          })}</div>
        </section>

        <section className="ledger-card ledger-debt-rate-card"><header><div><span className="ledger-eyebrow">RATE CHECK</span><h2>금리 점검</h2></div></header>
          <div className="ledger-check-grid">{totals.map((item) => <div key={item.currency}><span>{item.currency} 가중평균 금리</span><strong>{Number(item.weightedAverageRate || 0).toFixed(2)}%</strong><small>예상 월 이자 {money(item.estimatedMonthlyInterest, item.currency)}</small></div>)}</div>
          <p className="ledger-debt-note">예상 이자는 단순 월 환산 참고값입니다. 실제 원리금균등·원금균등 상환액은 금융기관 명세와 다를 수 있습니다.</p>
        </section>
      </div>
    </div>
  </>;
}

export default function LedgerDashboardView({ accountsSummary, onOpenCreateView, onSelectAccount, onNavigateAccounts, onNavigateTransactions, onNavigateAnalytics, onQuickExpense, onTransfer, onSettlement }) {
  const [mode, setMode] = useState('overview');
  const [month, setMonth] = useState(currentMonth());
  const changeMode = next => {setMode(next);if(next==='overview')setMonth(currentMonth());};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getLedgerDashboard(mode==='overview'?{from:currentMonth()+'-01',to:dateKey()}:month).then((response) => { if (alive) { setData(response); setError(''); } })
      .catch((requestError) => { if (alive) setError(requestError.response?.data?.message || requestError.response?.data?.detail || '대시보드 정보를 불러오지 못했습니다.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month, mode, accountsSummary?.accounts]);

  const handleSyncInvestmentPrices = async () => {
    const investmentAccounts = (accountsSummary?.accounts || []).filter((account) => account.accountType === 'INVESTMENT');
    if (!investmentAccounts.length || syncingPrices) return;
    setSyncingPrices(true);
    setSyncFeedback(null);
    let successCount = 0;
    const failedAccounts = [];
    for (const account of investmentAccounts) {
      try {
        await syncInvestmentPrices(account.accountId);
        successCount += 1;
      } catch {
        failedAccounts.push(account.accountName);
      }
    }
    try {
      const refreshed = await getLedgerDashboard(month);
      setData(refreshed);
    } catch (requestError) {
      setError(requestError.response?.data?.message || '동기화 후 대시보드를 갱신하지 못했습니다.');
    }
    setSyncFeedback(failedAccounts.length
      ? { type: 'warning', message: `${successCount}개 계좌 동기화 완료 · 실패: ${failedAccounts.join(', ')}` }
      : { type: 'success', message: `${successCount}개 투자계좌의 최신 시세를 반영했습니다.` });
    setSyncingPrices(false);
  };

  return <div className={`ledger-dashboard-page${mode==='overview'?' is-overview':''}`}>
    <DashboardHeader mode={mode} onModeChange={changeMode} month={month} onMonthChange={setMonth} onOpenCreateView={onOpenCreateView} />
    {syncFeedback && <div className={`ledger-sync-feedback is-${syncFeedback.type}`}>{syncFeedback.message}<button type="button" aria-label="알림 닫기" onClick={() => setSyncFeedback(null)}>×</button></div>}
    {loading && <div className="ledger-dashboard-loading">실제 자산과 거래 내역을 계산하고 있습니다.</div>}
    {!loading && error && <div className="ledger-dashboard-error">{error}</div>}
    {!loading && !error && data && (mode === 'overview'
      ? <CompactLedgerOverview onSelectAccount={onSelectAccount} accountsSummary={accountsSummary} data={data} onNavigateAccounts={onNavigateAccounts} onNavigateTransactions={onNavigateTransactions} onNavigateAnalytics={onNavigateAnalytics} onQuickExpense={onQuickExpense} onTransfer={onTransfer} onSettlement={onSettlement} />
      : mode === 'investment'
        ? <InvestmentDashboard data={data} accounts={accountsSummary?.accounts || []} onSelectAccount={onSelectAccount} onNavigateAccounts={onNavigateAccounts} onNavigateTransactions={onNavigateTransactions} onSyncPrices={handleSyncInvestmentPrices} syncingPrices={syncingPrices} />
        : <DebtDashboard data={data} accounts={accountsSummary?.accounts || []} onSelectAccount={onSelectAccount} onOpenCreateView={onOpenCreateView} onNavigateAccounts={onNavigateAccounts} onNavigateTransactions={onNavigateTransactions} />)}
  </div>;
}
