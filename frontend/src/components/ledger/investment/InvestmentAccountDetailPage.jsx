import InlineEditor from "../../workspace/InlineEditor";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInvestmentNote,
  getInvestmentDetail,
  getInvestmentPriceProviderStatus,
  getInvestmentTransactions,
  syncInvestmentPrices,
  updateInvestmentTargetAllocations,
} from '../../../api/investment';
import '../../../styles/investment-account.css';
import AccountIdentityCard from '../shared/AccountIdentityCard';

const ASSET_CLASS_META = {
  INDEX_ETF: { label: '지수 ETF', color: '#3f7fb0' },
  DOMESTIC_STOCK: { label: '개별주(국내)', color: '#d59a4a' },
  FOREIGN_STOCK: { label: '개별주(해외)', color: '#3f956a' },
  DIVIDEND_ASSET: { label: '배당주/ETF', color: '#ad6c55' },
  CASH: { label: '현금/예수금', color: '#9aa8b0' },
};

const TRADE_META = {
  BUY: { label: '매수', className: 'buy' },
  SELL: { label: '매도', className: 'sell' },
  DIVIDEND: { label: '배당', className: 'dividend' },
  DEPOSIT: { label: '입금', className: 'cash' },
  WITHDRAWAL: { label: '출금', className: 'cash' },
};

const TRANSACTION_TABS = [
  { label: '전체', value: '' },
  { label: '매수', value: 'BUY' },
  { label: '매도', value: 'SELL' },
  { label: '배당', value: 'DIVIDEND' },
  { label: '입출금', value: 'CASH' },
];

const number = (value) => Number(value ?? 0);
const formatNumber = (value, maximumFractionDigits = 2) => number(value).toLocaleString('ko-KR', { maximumFractionDigits });
const formatPercent = (value, signed = false) => `${signed && number(value) > 0 ? '+' : ''}${formatNumber(value)}%`;

function formatCurrency(value, currency) {
  if (value === null || value === undefined) return '-';
  const code = currency || 'KRW';
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: code === 'KRW' ? 0 : 2,
    }).format(number(value));
  } catch {
    return `${formatNumber(value)} ${code}`;
  }
}

const formatSignedCurrency = (value, code) => `${number(value) >= 0 ? '+' : '-'}${formatCurrency(Math.abs(number(value)), code)}`;
const formatCompactCurrency = (value, code) => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency: code || 'KRW', notation: 'compact', maximumFractionDigits: 1,
}).format(number(value));

function DualCurrencyValue({ value, accountCurrency, localValue, localCurrency, signed = false }) {
  const format = signed ? formatSignedCurrency : formatCurrency;
  return <span className="investment-dual-money"><strong>{format(value, accountCurrency)}</strong>{localCurrency && localCurrency !== accountCurrency && <small>{format(localValue, localCurrency)} · 현지통화</small>}</span>;
}

function formatDate(value, withTime = false) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.response?.data?.detail || fallback;
}

function SectionCard({ title, action, className = '', children }) {
  return (
    <section className={`investment-card ${className}`}>
      <header className="investment-card__header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function RecentAssetTrendCard({ points, accountCurrency }) {
  if (!points?.length) return <SectionCard title="최근 자산 추이"><div className="investment-empty is-compact">아직 자산 추이 데이터가 없습니다.</div></SectionCard>;

  const width = 360;
  const height = 142;
  const padding = 9;
  const values = points.map((point) => number(point.totalAssetValue));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const divisor = Math.max(values.length - 1, 1);
  const coordinates = values.map((value, index) => ({
    x: padding + (index * (width - padding * 2)) / divisor,
    y: height - padding - ((value - min) / range) * (height - padding * 2),
  }));
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const first = values[0];
  const last = values.at(-1);
  const changeRate = first ? ((last - first) / first) * 100 : 0;
  const changeAmount = last - first;
  const lastPoint = coordinates.at(-1);

  return (
    <SectionCard title="최근 자산 추이" action={<span className="investment-period-label">최근 7일</span>} className="investment-recent-trend-card">
      <div className="investment-trend is-expanded" aria-label="최근 자산 추이">
        <div className="investment-trend__summary">
          <div><span>현재 자산</span><strong>{formatCurrency(last, accountCurrency)}</strong></div>
          <div className={changeRate < 0 ? 'is-negative' : 'is-positive'}><span>7일 변동</span><strong>{formatSignedCurrency(changeAmount, accountCurrency)}</strong><small>{formatPercent(changeRate, true)}</small></div>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="자산 가치 변화 그래프">
          <defs>
            <linearGradient id="investmentTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f956a" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#3f956a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`${padding},${height - padding} ${polyline} ${lastPoint.x},${height - padding}`} fill="url(#investmentTrendFill)" />
          <polyline points={polyline} fill="none" stroke="#3f956a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#fff" stroke="#3f956a" strokeWidth="3" />
        </svg>
        <div className="investment-trend__days">
          <span>{formatDate(points[0].date)}</span>
          <span>{formatDate(points.at(-1).date)}</span>
        </div>
      </div>
    </SectionCard>
  );
}

function AllocationSummaryDonut({ allocation = [], totalAssetValue, accountCurrency }) {
  const decorated = allocation.map((item) => ({ ...item, ...ASSET_CLASS_META[item.assetClass] }));
  let cursor = 0;
  const slices = decorated.map((item) => {
    const start = cursor;
    cursor += Math.max(number(item.ratio), 0);
    return `${item.color} ${start}% ${cursor}%`;
  }).join(', ');

  return (
    <section className="investment-summary-allocation" aria-label="자산 배분">
      <div className="investment-summary-allocation__title"><span>자산 배분</span><strong>{accountCurrency} 기준</strong></div>
      <div className="investment-summary-allocation__body">
        <div className="investment-summary-donut" style={{ background: cursor > 0 ? `conic-gradient(${slices})` : '#ece9e3' }}>
          <div><span>총 자산</span><strong>{formatCompactCurrency(totalAssetValue, accountCurrency)}</strong></div>
        </div>
        <div className="investment-summary-legend">
          {decorated.map((item) => <div key={item.assetClass}><i style={{ backgroundColor: item.color }} /><span>{item.label}</span><strong>{formatPercent(item.ratio)}</strong></div>)}
        </div>
      </div>
    </section>
  );
}

function AccountSummaryCard({ data }) {
  const { account, profile, summary } = data;
  const baseCurrency = account.currency;
  const metrics = [
    { label: '총 평가금액', value: formatCurrency(summary.totalAssetValue, baseCurrency), primary: true },
    { label: '투자 원금', value: formatCurrency(summary.investedPrincipal, baseCurrency) },
    { label: '평가손익', value: formatSignedCurrency(summary.evaluationProfitLoss, baseCurrency), tone: number(summary.evaluationProfitLoss) >= 0 ? 'positive' : 'negative' },
    { label: '수익률', value: formatPercent(summary.returnRate, true), tone: number(summary.returnRate) >= 0 ? 'positive' : 'negative' },
    { label: '예수금', value: formatCurrency(summary.cashBalance, baseCurrency) },
    { label: '이번 달 배당', value: formatCurrency(summary.monthlyDividend, baseCurrency), tone: 'accent' },
  ];

  return (
    <section className="investment-summary-card ledger-account-detail__overview">
      <AccountIdentityCard
        variant="investment"
        mark="투자"
        status={`자동 동기화 ${profile.autoSyncEnabled ? 'ON' : 'OFF'}`}
        statusTone={profile.autoSyncEnabled ? 'success' : 'neutral'}
        eyebrow="투자 계좌"
        accountName={account.accountName}
        bankName={account.bankName}
        accountNumber={account.accountNumberMasked}
        tags={[
          { label: '투자' },
          profile.primary ? { label: '대표 계좌' } : null,
          profile.syncProvider ? { label: profile.syncProvider, tone: 'blue' } : null,
        ]}
        footerLabel="마지막 동기화"
        footerValue={formatDate(profile.lastSyncedAt, true)}
        footerBadge={profile.syncStatus || '대기'}
      />

      <div className="investment-summary-content">
        <div className="investment-metric-grid">
          {metrics.map((metric) => (
            <div key={metric.label} className={`investment-metric ${metric.primary ? 'is-primary' : ''}`}>
              <span>{metric.label}</span>
              <strong className={metric.tone ? `is-${metric.tone}` : ''}>{metric.value}</strong>
            </div>
          ))}
        </div>
        <AllocationSummaryDonut allocation={data.allocations} totalAssetValue={summary.totalAssetValue} accountCurrency={baseCurrency} />
      </div>
    </section>
  );
}

function HoldingsTable({ holdings, summary, accountCurrency }) {
  return (
    <SectionCard title="보유 종목" className="investment-holdings">
      <div className="investment-table-wrap">
        <table className="investment-table">
          <thead><tr><th>종목명</th><th>수량</th><th>평균매입가</th><th>현재가</th><th>평가금액</th><th>평가손익</th><th>수익률</th><th>비중</th></tr></thead>
          <tbody>
            {holdings.map((item) => (
              <tr key={item.investmentId || item.assetClass}>
                <td><div className="investment-security"><span>{item.symbolName?.slice(0, 1) || '₩'}</span><div><strong>{item.symbolName}</strong><small>{item.tickerCode} · {item.market || item.currency}</small></div></div></td>
                <td>{item.quantity === null ? '-' : formatNumber(item.quantity, 6)}</td>
                <td>{item.assetClass === 'CASH' ? '-' : formatCurrency(item.averageBuyPrice, item.currency)}</td>
                <td>{item.assetClass === 'CASH' ? '-' : formatCurrency(item.currentPrice, item.currency)}</td>
                <td className="is-strong"><DualCurrencyValue value={item.evaluationAmount} accountCurrency={accountCurrency} localValue={item.evaluationAmountLocal} localCurrency={item.currency} /></td>
                <td className={number(item.profitLoss) >= 0 ? 'is-positive' : 'is-negative'}>{item.assetClass === 'CASH' ? '-' : <DualCurrencyValue value={item.profitLoss} accountCurrency={accountCurrency} localValue={item.profitLossLocal} localCurrency={item.currency} signed />}</td>
                <td className={number(item.returnRate) >= 0 ? 'is-positive' : 'is-negative'}>{item.assetClass === 'CASH' ? '-' : formatPercent(item.returnRate, true)}</td>
                <td><div className="investment-weight"><i><span style={{ width: `${Math.min(number(item.weight), 100)}%` }} /></i>{formatPercent(item.weight)}</div></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan="4">합계</td><td>{formatCurrency(summary.totalAssetValue, accountCurrency)}</td><td className={number(summary.evaluationProfitLoss) >= 0 ? 'is-positive' : 'is-negative'}>{formatSignedCurrency(summary.evaluationProfitLoss, accountCurrency)}</td><td className={number(summary.returnRate) >= 0 ? 'is-positive' : 'is-negative'}>{formatPercent(summary.returnRate, true)}</td><td>{holdings.length ? '100%' : '0%'}</td></tr></tfoot>
        </table>
        {!holdings.length && <div className="investment-empty">등록된 보유 종목이 없습니다.</div>}
      </div>
    </SectionCard>
  );
}

function TargetAllocationCard({ targets }) {
  return (
    <SectionCard title="목표 비중 vs 현재 비중">
      <div className="investment-target-list">
        <div className="investment-target-head"><span>자산군</span><span>목표</span><span>현재</span><span>차이</span></div>
        {targets.map((item) => {
          const meta = ASSET_CLASS_META[item.assetClass];
          const diff = number(item.difference);
          return <div className="investment-target-row" key={item.assetClass}>
            <div className="investment-target-row__labels"><strong>{meta?.label || item.assetClass}</strong><span>{formatPercent(item.targetRatio)}</span><span>{formatPercent(item.currentRatio)}</span><em className={Math.abs(diff) >= 2 ? 'is-warning' : ''}>{formatPercent(diff, true)}</em></div>
            <div className="investment-target-track"><span style={{ width: `${Math.min(number(item.currentRatio), 100)}%` }} /><i style={{ left: `${Math.min(number(item.targetRatio), 100)}%` }} /></div>
          </div>;
        })}
      </div>
    </SectionCard>
  );
}

function TargetAllocationEditor({ accountId, targets, onClose, onSaved }) {
  const [draft, setDraft] = useState(() => Object.keys(ASSET_CLASS_META).map((assetClass) => ({
    assetClass,
    targetRatio: String(targets.find((item) => item.assetClass === assetClass)?.targetRatio ?? 0),
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = draft.reduce((sum, item) => sum + number(item.targetRatio), 0);
  const totalIsValid = Math.abs(total - 100) < 0.001;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!totalIsValid) {
      setError('목표 비중의 합계를 100%로 맞춰 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateInvestmentTargetAllocations(accountId, draft.map((item) => ({
        assetClass: item.assetClass,
        targetRatio: number(item.targetRatio),
      })));
      onSaved(updated);
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '목표 비중을 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineEditor title="목표 비중 설정" busy={saving} onClose={onClose}>
      <section className="investment-modal">
        <form onSubmit={handleSubmit}>
          <div className="investment-target-form">
            {draft.map((item, index) => {
              const meta = ASSET_CLASS_META[item.assetClass];
              return (
                <label key={item.assetClass}>
                  <span><i style={{ backgroundColor: meta.color }} />{meta.label}</span>
                  <div><input type="number" min="0" max="100" step="0.1" value={item.targetRatio} onChange={(event) => setDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, targetRatio: event.target.value } : entry))} /><em>%</em></div>
                </label>
              );
            })}
          </div>
          <div className={`investment-target-total ${totalIsValid ? 'is-valid' : 'is-invalid'}`}>
            <span>목표 비중 합계</span><strong>{formatNumber(total, 1)}%</strong>
          </div>
          {error && <p className="investment-modal__error" role="alert">{error}</p>}
          <footer className="investment-modal__actions">
            <button type="button" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="is-primary" disabled={saving || !totalIsValid}>{saving ? '저장 중…' : '목표 비중 저장'}</button>
          </footer>
        </form>
      </section>
    </InlineEditor>
  );
}

function InvestmentNoteEditor({ accountId, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', content: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError('메모 제목을 입력해 주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const note = await createInvestmentNote(accountId, {
        title: form.title.trim(),
        content: form.content.trim(),
        pinned: form.pinned,
      });
      onSaved(note);
      onClose();
    } catch (requestError) {
      setError(getErrorMessage(requestError, '투자 메모를 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineEditor title="투자 메모 등록" busy={saving} onClose={onClose}>
      <section className="investment-modal">
        <form onSubmit={handleSubmit}>
          <div className="investment-note-form">
            <label><span>제목</span><input type="text" maxLength="100" autoFocus placeholder="예: 다음 달 ETF 추가 매수" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label><span>내용</span><textarea rows="5" maxLength="1000" placeholder="투자 계획, 판단 근거, 확인할 내용을 기록해 보세요." value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /></label>
            <label className="investment-note-form__pin"><input type="checkbox" checked={form.pinned} onChange={(event) => setForm((current) => ({ ...current, pinned: event.target.checked }))} /><span><strong>중요 메모로 고정</strong><small>메모 목록 상단에서 쉽게 확인할 수 있습니다.</small></span></label>
          </div>
          {error && <p className="investment-modal__error" role="alert">{error}</p>}
          <footer className="investment-modal__actions">
            <button type="button" onClick={onClose} disabled={saving}>취소</button>
            <button type="submit" className="is-primary" disabled={saving || !form.title.trim()}>{saving ? '저장 중…' : '메모 저장'}</button>
          </footer>
        </form>
      </section>
    </InlineEditor>
  );
}

function TransactionHistoryCard({ accountId, holdings, accountCurrency }) {
  const [activeFilter, setActiveFilter] = useState('');
  const [dateDraft, setDateDraft] = useState({ from: '', to: '' });
  const [filters, setFilters] = useState({ from: '', to: '' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const holdingNames = useMemo(() => new Map(holdings.filter((item) => item.investmentId).map((item) => [item.investmentId, item.symbolName])), [holdings]);

  useEffect(() => {
    let alive = true;
    const requestType = activeFilter === 'CASH' ? undefined : activeFilter || undefined;
    setLoading(true);
    getInvestmentTransactions(accountId, { ...filters, type: requestType })
      .then((page) => {
        if (!alive) return;
        const content = page.content || [];
        setTransactions(activeFilter === 'CASH' ? content.filter((tx) => ['DEPOSIT', 'WITHDRAWAL'].includes(tx.tradeType)) : content);
        setError('');
      })
      .catch((requestError) => alive && setError(getErrorMessage(requestError, '거래 내역을 불러오지 못했습니다.')))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [accountId, activeFilter, filters]);

  return (
    <SectionCard title="투자 거래 내역" className="investment-transactions">
      <div className="investment-transaction-toolbar">
        <div className="investment-filter-tabs">{TRANSACTION_TABS.map((tab) => <button type="button" key={tab.label} onClick={() => setActiveFilter(tab.value)} className={activeFilter === tab.value ? 'is-active' : ''}>{tab.label}</button>)}</div>
        <form className="investment-filter-actions" onSubmit={(event) => { event.preventDefault(); setFilters(dateDraft); }}>
          <input type="date" aria-label="조회 시작일" value={dateDraft.from} onChange={(event) => setDateDraft((current) => ({ ...current, from: event.target.value }))} />
          <span>~</span>
          <input type="date" aria-label="조회 종료일" value={dateDraft.to} onChange={(event) => setDateDraft((current) => ({ ...current, to: event.target.value }))} />
          <button type="submit">조회</button>
        </form>
      </div>
      <div className="investment-table-wrap">
        <table className="investment-table is-transaction">
          <thead><tr><th>날짜</th><th>구분</th><th>종목/거래처</th><th>수량</th><th>단가</th><th>금액</th><th>수수료</th><th>메모</th></tr></thead>
          <tbody>{transactions.map((tx) => {
            const tradeMeta = TRADE_META[tx.tradeType] || { label: tx.tradeType, className: 'cash' };
            const name = holdingNames.get(tx.investmentId) || (tx.tradeType === 'DEPOSIT' ? '예수금 입금' : tx.tradeType === 'WITHDRAWAL' ? '예수금 출금' : '-');
            return <tr key={tx.investmentTransactionId}><td>{formatDate(tx.tradeDate)}</td><td><span className={`investment-type-badge is-${tradeMeta.className}`}>{tradeMeta.label}</span></td><td className="is-strong">{name}</td><td>{tx.quantity === null ? '-' : formatNumber(tx.quantity, 6)}</td><td>{formatCurrency(tx.unitPrice, tx.currency)}</td><td className="is-strong"><DualCurrencyValue value={Math.abs(number(tx.netAmount))} accountCurrency={accountCurrency} localValue={tx.grossAmount} localCurrency={tx.currency} /></td><td>{formatCurrency(tx.feeAmount, tx.currency)}</td><td>{tx.memo || '-'}</td></tr>;
          })}</tbody>
        </table>
        {loading && <div className="investment-empty">거래 내역을 불러오는 중입니다.</div>}
        {!loading && error && <div className="investment-empty is-error">{error}</div>}
        {!loading && !error && transactions.length === 0 && <div className="investment-empty">선택한 조건의 거래가 없습니다.</div>}
      </div>
    </SectionCard>
  );
}

function PerformanceSummaryCard({ performance, accountCurrency }) {
  const items = [
    { label: '이번 달 수익률', value: formatPercent(performance.monthlyReturnRate, true), amount: performance.monthlyReturnRate },
    { label: '연환산 수익률', value: formatPercent(performance.annualizedReturnRate, true), amount: performance.annualizedReturnRate },
    { label: '실현 손익', value: formatSignedCurrency(performance.realizedProfitLoss, accountCurrency), amount: performance.realizedProfitLoss },
    { label: '미실현 손익', value: formatSignedCurrency(performance.unrealizedProfitLoss, accountCurrency), amount: performance.unrealizedProfitLoss },
    { label: '배당 수령액', value: formatCurrency(performance.dividendIncome, accountCurrency), amount: performance.dividendIncome },
  ];
  return (
    <SectionCard title="성과 요약" action={<span className="investment-period-label">이번 달</span>}>
      <div className="investment-performance-list">
        {items.map((item, index) => <div key={item.label} className={index === 0 ? 'is-featured' : ''}><span>{item.label}</span><strong className={number(item.amount) >= 0 ? 'is-positive' : 'is-negative'}>{item.value}</strong></div>)}
      </div>
    </SectionCard>
  );
}

function RebalancingAlertCard({ alerts, notes }) {
  const orderedNotes = [...notes].sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)));
  return (
    <SectionCard title="투자 메모 / 리밸런싱 알림">
      <div className="investment-insight-scroll">
        <div className="investment-insight-section-title"><strong>자동 알림</strong><span>{alerts.length}개</span></div>
        <div className="investment-alert-list">
          {alerts.map((alert) => <article key={alert.assetClass} className="is-warning"><div className="investment-alert-icon">!</div><div><strong>{alert.title}</strong><p>{alert.description}</p><span>{ASSET_CLASS_META[alert.assetClass]?.label} · 목표 대비 {formatPercent(alert.difference, true)}</span></div></article>)}
          {!alerts.length && <div className="investment-empty is-compact">현재 리밸런싱이 필요한 자산군이 없습니다.</div>}
        </div>
        <div className="investment-insight-section-title is-note"><strong>내 메모</strong><span>{notes.length}개</span></div>
        <div className="investment-note-list">
          {orderedNotes.map((note) => <article key={note.noteId} className="investment-note-box"><div><span>{note.title}</span>{note.pinned && <em>고정</em>}</div><p>{note.content || '내용 없이 등록된 메모입니다.'}</p><small>{formatDate(note.updatedAt, true)}</small></article>)}
          {!notes.length && <div className="investment-empty is-compact">직접 작성한 투자 메모가 없습니다.</div>}
        </div>
      </div>
    </SectionCard>
  );
}

function PortfolioActivityCard({ accountId, holdings, summary, accountCurrency }) {
  const [activeTab, setActiveTab] = useState('HOLDINGS');
  const holdingCount = holdings.filter((item) => item.assetClass !== 'CASH').length;
  return (
    <section className="investment-card investment-activity-card">
      <header className="investment-card__header investment-tabbed-card-header">
        <div className="investment-card-tabs" role="tablist" aria-label="투자 자산과 거래 내역">
          <button type="button" role="tab" aria-selected={activeTab === 'HOLDINGS'} className={activeTab === 'HOLDINGS' ? 'is-active' : ''} onClick={() => setActiveTab('HOLDINGS')}>보유 종목 <em>{holdingCount}</em></button>
          <button type="button" role="tab" aria-selected={activeTab === 'TRANSACTIONS'} className={activeTab === 'TRANSACTIONS' ? 'is-active' : ''} onClick={() => setActiveTab('TRANSACTIONS')}>거래 내역</button>
        </div>
        <span className="investment-tab-hint">탭을 눌러 현재 자산과 과거 기록을 전환합니다.</span>
      </header>
      <div className="investment-embedded-panel" hidden={activeTab !== 'HOLDINGS'}><HoldingsTable holdings={holdings} summary={summary} accountCurrency={accountCurrency} /></div>
      <div className="investment-embedded-panel" hidden={activeTab !== 'TRANSACTIONS'}><TransactionHistoryCard accountId={accountId} holdings={holdings} accountCurrency={accountCurrency} /></div>
    </section>
  );
}

function InvestmentInsightCard({ accountId, performance, alerts, notes, accountCurrency, onNoteCreated }) {
  const [activeTab, setActiveTab] = useState('PERFORMANCE');
  const [modalOpen, setModalOpen] = useState(false);
  const alertCount = alerts.length + notes.length;
  return (
    <>
      <section className="investment-card investment-insight-card">
        <header className="investment-card__header investment-tabbed-card-header">
          <div>
            <p className="investment-insight-eyebrow">투자 인사이트</p>
            <div className="investment-card-tabs is-compact" role="tablist" aria-label="성과와 투자 메모">
              <button type="button" role="tab" aria-selected={activeTab === 'PERFORMANCE'} className={activeTab === 'PERFORMANCE' ? 'is-active' : ''} onClick={() => setActiveTab('PERFORMANCE')}>성과 요약</button>
              <button type="button" role="tab" aria-selected={activeTab === 'NOTES'} className={activeTab === 'NOTES' ? 'is-active' : ''} onClick={() => setActiveTab('NOTES')}>알림·메모 {alertCount > 0 && <em>{alertCount}</em>}</button>
            </div>
          </div>
          {activeTab === 'NOTES' && <button type="button" className="investment-text-btn is-framed" onClick={() => setModalOpen(true)}>＋ 메모 등록</button>}
        </header>
        <div className="investment-embedded-panel" hidden={activeTab !== 'PERFORMANCE'}><PerformanceSummaryCard performance={performance} accountCurrency={accountCurrency} /></div>
        <div className="investment-embedded-panel" hidden={activeTab !== 'NOTES'}><RebalancingAlertCard alerts={alerts} notes={notes} /></div>
      </section>
      {modalOpen && <InvestmentNoteEditor accountId={accountId} onClose={() => setModalOpen(false)} onSaved={onNoteCreated} />}
    </>
  );
}

function AllocationStrategyCard({ accountId, recentTrend, targets, accountCurrency, onTargetsUpdated }) {
  const [activeTab, setActiveTab] = useState('TARGET');
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <section className="investment-card investment-allocation-strategy-card">
        <header className="investment-card__header investment-tabbed-card-header">
          <div className="investment-card-tabs is-compact" role="tablist" aria-label="자산 추이와 목표 비중">
            <button type="button" role="tab" aria-selected={activeTab === 'TARGET'} className={activeTab === 'TARGET' ? 'is-active' : ''} onClick={() => setActiveTab('TARGET')}>목표 비중</button>
            <button type="button" role="tab" aria-selected={activeTab === 'TREND'} className={activeTab === 'TREND' ? 'is-active' : ''} onClick={() => setActiveTab('TREND')}>최근 자산 추이</button>
          </div>
          {activeTab === 'TARGET' && <button type="button" className="investment-text-btn is-framed" onClick={() => setModalOpen(true)}>목표 설정</button>}
        </header>
        <div className="investment-embedded-panel" hidden={activeTab !== 'TREND'}><RecentAssetTrendCard points={recentTrend} accountCurrency={accountCurrency} /></div>
        <div className="investment-embedded-panel" hidden={activeTab !== 'TARGET'}><TargetAllocationCard targets={targets} /></div>
      </section>
      {modalOpen && <TargetAllocationEditor accountId={accountId} targets={targets} onClose={() => setModalOpen(false)} onSaved={onTargetsUpdated} />}
    </>
  );
}

export default function InvestmentAccountDetailPage({ account, onBackToDashboard, onEditAccount, onAddTransaction, onOpenReconcile, onOpenTransfer }) {
  const [detail, setDetail] = useState(null);
  const [provider, setProvider] = useState({ configured: false, provider: '' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDetail = useCallback(async () => {
    if (!account?.accountId) return;
    setLoading(true);
    try {
      const [detailData, providerStatus] = await Promise.all([
        getInvestmentDetail(account.accountId),
        getInvestmentPriceProviderStatus(),
      ]);
      setDetail(detailData);
      setProvider(providerStatus);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, '투자 계좌 정보를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [account?.accountId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncInvestmentPrices(account.accountId);
      await loadDetail();
      showNotice('최신 시세로 동기화했습니다.');
    } catch (requestError) {
      setError(getErrorMessage(requestError, '시세 동기화에 실패했습니다.'));
    } finally {
      setSyncing(false);
    }
  };

  const handleTargetsUpdated = (targetAllocations) => {
    setDetail((current) => ({ ...current, targetAllocations }));
    showNotice('목표 비중을 저장했습니다.');
  };

  const handleNoteCreated = (note) => {
    setDetail((current) => ({ ...current, notes: [note, ...current.notes] }));
    showNotice('투자 메모를 저장했습니다.');
  };

  if (!account?.accountId) return <div className="investment-state"><h2>투자 계좌를 선택해 주세요.</h2><button type="button" onClick={onBackToDashboard}>대시보드로</button></div>;
  if (loading && !detail) return <div className="investment-state"><div className="investment-spinner" /><h2>투자 계좌를 불러오는 중입니다.</h2></div>;
  if (error && !detail) return <div className="investment-state is-error"><h2>{error}</h2><button type="button" onClick={loadDetail}>다시 시도</button></div>;

  return (
    <div className="investment-page ledger-account-detail ledger-account-detail--investment">
      {notice && <div className="investment-toast" role="status">{notice}</div>}
      <header className="investment-page-header ledger-account-detail__header">
        <div>
          <button type="button" className="investment-back-btn ledger-account-detail__back" onClick={onBackToDashboard}>← 대시보드로</button>
          <div className="investment-title-row ledger-account-detail__title-row"><h1>투자 계좌 상세</h1><span>{detail.account.currency}</span></div>
          <p>보유 자산의 평가 현황과 투자 성과를 확인합니다.</p>
        </div>
        <div className="investment-page-actions ledger-account-detail__actions">
          <button type="button" className="is-transfer" onClick={() => onOpenTransfer?.(detail.account)}>↔ 이체</button>
          <button type="button" onClick={() => onEditAccount?.(detail.account)} disabled={!onEditAccount}>계좌 수정</button>
          <button type="button" className="is-reconcile" onClick={onOpenReconcile}>잔액 대조</button>
          <button type="button" className="is-primary" onClick={() => onAddTransaction?.(detail.account)} disabled={!onAddTransaction}>＋ 거래 추가</button>
          <button type="button" onClick={handleSync} disabled={syncing || !provider.configured}>{syncing ? '동기화 중…' : '시세 동기화'}</button>
        </div>
      </header>

      {error && <div className="investment-inline-error" role="alert">{error}<button type="button" onClick={() => setError('')}>닫기</button></div>}
      <AccountSummaryCard data={detail} />

      <div className="investment-middle-grid">
        <PortfolioActivityCard accountId={account.accountId} holdings={detail.holdings} summary={detail.summary} accountCurrency={detail.account.currency} />
        <div className="investment-side-stack"><InvestmentInsightCard accountId={account.accountId} performance={detail.performance} alerts={detail.alerts} notes={detail.notes} accountCurrency={detail.account.currency} onNoteCreated={handleNoteCreated} /><AllocationStrategyCard accountId={account.accountId} recentTrend={detail.recentTrend} targets={detail.targetAllocations} accountCurrency={detail.account.currency} onTargetsUpdated={handleTargetsUpdated} /></div>
      </div>
    </div>
  );
}
