import InlineEditor from "../workspace/InlineEditor";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  archiveInvestmentPlan,
  createInvestmentPlan,
  getInvestmentPlans,
  updateInvestmentPlan,
} from '../../api/ledger';
import { getInvestmentDetail, searchInvestmentSymbols } from '../../api/investment';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  title: '', investmentAccountId: '', sourceAccountId: '', monthlyAmount: '', targetAmount: '',
  startDate: today(), targetDate: '', executionDay: 25, status: 'ACTIVE', memo: '', items: [],
});
const currency = (value, code = 'KRW') => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency: code, maximumFractionDigits: code === 'KRW' ? 0 : 2,
}).format(Number(value || 0));
const number = (value) => Number(value || 0);
const formatRatio = (value) => number(value).toLocaleString('ko-KR', { maximumFractionDigits: 3 });
const errorText = (error) => error?.response?.data?.message || error?.response?.data?.detail || error?.message || '요청을 처리하지 못했습니다.';

export default function InvestmentPlanningPanel({ accounts = [], month, onOpenTrade }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalPlan, setModalPlan] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [market, setMarket] = useState('KR');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const investmentAccounts = useMemo(() => accounts.filter((item) => item.accountType === 'INVESTMENT' && item.isActive !== false), [accounts]);
  const selectedAccount = investmentAccounts.find((item) => item.accountId === form.investmentAccountId);
  const sourceAccounts = accounts.filter((item) => item.isActive !== false
    && !['INVESTMENT', 'DEBT', 'FOREIGN_CURRENCY'].includes(item.accountType)
    && item.currency === selectedAccount?.currency);
  const ratioTotal = form.items.reduce((sum, item) => sum + number(item.targetRatio), 0);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlans(await getInvestmentPlans(month)); setError(''); }
    catch (requestError) { setError(errorText(requestError)); }
    finally { setLoading(false); }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const loadAccount = async (accountId) => {
    if (!accountId) { setDetail(null); return; }
    setDetailLoading(true);
    try { setDetail(await getInvestmentDetail(accountId)); }
    catch (requestError) { setError(errorText(requestError)); setDetail(null); }
    finally { setDetailLoading(false); }
  };

  const openModal = (plan = null) => {
    setModalPlan(plan || 'new');
    const next = plan ? {
      title: plan.title, investmentAccountId: plan.investmentAccountId,
      sourceAccountId: plan.sourceAccountId || '', monthlyAmount: plan.monthlyAmount,
      targetAmount: plan.targetAmount, startDate: plan.startDate, targetDate: plan.targetDate || '',
      executionDay: plan.executionDay, status: plan.status, memo: plan.memo || '',
      items: plan.items.map((item) => ({ ...item })),
    } : { ...emptyForm(), investmentAccountId: investmentAccounts[0]?.accountId || '' };
    setForm(next);
    setQuery(''); setResults([]);
    const account = investmentAccounts.find((item) => item.accountId === next.investmentAccountId);
    setMarket(account?.currency === 'USD' ? 'US' : account?.currency === 'JPY' ? 'JP' : 'KR');
    loadAccount(next.investmentAccountId);
  };

  const selectAccount = (accountId) => {
    const account = investmentAccounts.find((item) => item.accountId === accountId);
    setForm((current) => ({ ...current, investmentAccountId: accountId, sourceAccountId: '', items: [] }));
    setMarket(account?.currency === 'USD' ? 'US' : account?.currency === 'JPY' ? 'JP' : 'KR');
    setResults([]); setQuery(''); loadAccount(accountId);
  };

  const normalizeSymbol = (symbol) => ({
    investmentId: symbol.investmentId || null,
    tickerCode: symbol.tickerCode,
    symbolName: symbol.symbolName,
    market: symbol.market,
    quoteCurrency: symbol.currency,
    assetClass: symbol.assetClass || (symbol.currency === 'KRW' ? 'DOMESTIC_STOCK' : 'FOREIGN_STOCK'),
    targetRatio: 0,
    referencePrice: number(symbol.currentPrice || symbol.openingPrice),
    exchangeRate: symbol.currency === selectedAccount?.currency ? 1 : number(symbol.exchangeRate),
    priceQuotedAt: symbol.priceUpdatedAt || null,
  });
  const addSymbol = (symbol) => {
    if (form.items.some((item) => item.tickerCode === symbol.tickerCode)) return;
    setForm((current) => ({ ...current, items: [...current.items, normalizeSymbol(symbol)] }));
    setResults([]); setQuery('');
  };

  const search = async () => {
    if (!form.investmentAccountId || query.trim().length < 2) return;
    setSearching(true);
    try { setResults(await searchInvestmentSymbols(form.investmentAccountId, query.trim(), market)); setError(''); }
    catch (requestError) { setError(errorText(requestError)); }
    finally { setSearching(false); }
  };

  const updateItem = (index, field, value) => setForm((current) => ({
    ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const updateTargetRatio = (index, value) => {
    if (value === '') { updateItem(index, 'targetRatio', ''); return; }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    updateItem(index, 'targetRatio', Math.min(100, Math.max(0, Math.round(parsed))));
  };
  const removeItem = (index) => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));

  const save = async (event) => {
    event.preventDefault();
    if (!form.items.length) { setError('투자할 종목을 한 개 이상 추가해 주세요.'); return; }
    if (Math.abs(ratioTotal - 100) > 0.01) { setError('종목별 목표 비중의 합계를 100%로 맞춰 주세요.'); return; }
    if (form.items.some((item) => item.quoteCurrency !== selectedAccount?.currency && number(item.exchangeRate) <= 0)) {
      setError('계좌 통화와 다른 종목에는 계획 계산용 환율을 입력해 주세요.'); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form, sourceAccountId: form.sourceAccountId || null,
        monthlyAmount: number(form.monthlyAmount), targetAmount: number(form.targetAmount),
        executionDay: number(form.executionDay), targetDate: form.targetDate || null,
        items: form.items.map((item) => ({
          investmentId: item.investmentId || null, tickerCode: item.tickerCode, symbolName: item.symbolName,
          market: item.market, quoteCurrency: item.quoteCurrency, assetClass: item.assetClass,
          targetRatio: number(item.targetRatio), referencePrice: number(item.referencePrice),
          exchangeRate: item.quoteCurrency === selectedAccount?.currency ? 1 : number(item.exchangeRate),
          priceQuotedAt: item.priceQuotedAt || null,
        })),
      };
      if (modalPlan === 'new') await createInvestmentPlan(payload, month);
      else await updateInvestmentPlan(modalPlan.investmentPlanId, payload, month);
      setModalPlan(null); await load();
    } catch (requestError) { setError(errorText(requestError)); }
    finally { setSaving(false); }
  };

  const archive = async (plan) => {
    if (!window.confirm(`'${plan.title}' 투자 계획을 보관할까요? 기존 투자 거래는 유지됩니다.`)) return;
    try { await archiveInvestmentPlan(plan.investmentPlanId); await load(); }
    catch (requestError) { setError(errorText(requestError)); }
  };

  if (!investmentAccounts.length) return <div className="planning-panel investment-plan-empty"><span>↗</span><h2>투자계좌가 먼저 필요합니다.</h2><p>계좌 메뉴에서 투자계좌를 등록한 뒤 월 투자 계획을 만들 수 있습니다.</p></div>;
  if (loading) return <div className="planning-panel investment-plan-empty"><p>투자 계획을 불러오는 중입니다.</p></div>;

  return <>
    <div className="planning-panel investment-plan-panel">
      <div className="planning-panel-title"><div><h2>정기 투자 계획</h2><p>실제 주문은 하지 않으며 저장된 매수 거래를 기준으로 실행률을 계산합니다.</p></div><button className="planning-primary-button" onClick={() => openModal()}>+ 투자 계획</button></div>
      {error && !modalPlan && <div className="planning-error">{error}</div>}
    {modalPlan && <InlineEditor title={modalPlan === 'new' ? '투자 계획 만들기' : '투자 계획 수정'} busy={saving} onClose={()=>setModalPlan(null)}>
      <form className="planning-modal investment-plan-modal" onSubmit={save}>
        {error && <div className="planning-error">{error}</div>}
        <div className="investment-plan-form-grid">
          <label className="is-wide"><span>계획 이름 *</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 장기 ETF 적립" /></label>
          <label><span>투자계좌 *</span><select required value={form.investmentAccountId} onChange={(event) => selectAccount(event.target.value)}><option value="">선택</option>{investmentAccounts.map((item) => <option key={item.accountId} value={item.accountId}>{item.accountName} · {item.currency}</option>)}</select></label>
          <label><span>출금 준비 계좌</span><select value={form.sourceAccountId} onChange={(event) => setForm({ ...form, sourceAccountId: event.target.value })}><option value="">지정하지 않음</option>{sourceAccounts.map((item) => <option key={item.accountId} value={item.accountId}>{item.accountName}</option>)}</select></label>
          <label><span>월 투자금 *</span><input required type="number" min="1" value={form.monthlyAmount} onChange={(event) => setForm({ ...form, monthlyAmount: event.target.value })} /></label>
          <label><span>목표 투자 원금 *</span><input required type="number" min="1" value={form.targetAmount} onChange={(event) => setForm({ ...form, targetAmount: event.target.value })} /></label>
          <label><span>시작일 *</span><input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label>
          <label><span>목표일</span><input type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></label>
          <label><span>매월 예정일</span><input type="number" min="1" max="31" value={form.executionDay} onChange={(event) => setForm({ ...form, executionDay: event.target.value })} /></label>
          <label><span>상태</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="ACTIVE">진행 중</option><option value="PAUSED">일시 중지</option></select></label>
        </div>

        <section className="investment-plan-symbol-section">
          <div className="investment-plan-section-title"><div><h3>계획 종목</h3><p>비중은 정수로 입력합니다. 30을 입력하면 월 투자금의 정확히 30%로 계산됩니다.</p></div><strong className={Math.abs(ratioTotal - 100) <= .01 ? 'is-complete' : ''}>비중 합계 {formatRatio(ratioTotal)}%</strong></div>
          {detailLoading ? <div className="investment-plan-search-state">투자계좌 종목을 불러오는 중입니다.</div> : <>
            {detail?.holdings?.some((item) => item.assetClass !== 'CASH') && <div className="investment-plan-holdings"><span>보유 종목 빠른 추가</span><div>{detail.holdings.filter((item) => item.assetClass !== 'CASH').map((item) => <button type="button" key={item.investmentId} disabled={form.items.some((row) => row.tickerCode === item.tickerCode)} onClick={() => addSymbol(item)}>{item.symbolName}<small>{item.tickerCode}</small></button>)}</div></div>}
            <div className="investment-plan-search"><div className="investment-plan-market-tabs">{[['KR', '한국'], ['US', '미국'], ['JP', '일본']].map(([value, label]) => <button type="button" key={value} className={market === value ? 'is-active' : ''} onClick={() => { setMarket(value); setResults([]); }}>{label}</button>)}</div><div className="investment-plan-search-input"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), search())} placeholder="종목명 또는 종목 코드" /><button type="button" onClick={search} disabled={searching}>{searching ? '검색 중' : '검색'}</button></div></div>
            {!!results.length && <div className="investment-plan-search-results">{results.map((item) => <button type="button" key={`${item.market}-${item.tickerCode}`} onClick={() => addSymbol(item)}><span><strong>{item.symbolName}</strong><small>{item.tickerCode} · {item.market} · {item.currency}</small></span><strong>{item.currentPrice ? currency(item.currentPrice, item.currency) : '가격 미확인'}</strong></button>)}</div>}
          </>}
          <div className="investment-plan-item-editor">{form.items.map((item, index) => {
            const planned = number(form.monthlyAmount) * number(item.targetRatio) / 100;
            const basePrice = number(item.referencePrice) * (item.quoteCurrency === selectedAccount?.currency ? 1 : number(item.exchangeRate));
            return <div key={`${item.tickerCode}-${index}`}><span><strong>{item.symbolName}</strong><small>{item.tickerCode} · {item.quoteCurrency}</small></span><label><span>목표 비중</span><div><input type="number" min="1" max="100" step="1" inputMode="numeric" value={item.targetRatio} onChange={(event) => updateTargetRatio(index, event.target.value)} /><em>%</em></div></label><label><span>참고 현재가</span><input type="number" min="0" value={item.referencePrice} onChange={(event) => updateItem(index, 'referencePrice', event.target.value)} /></label>{item.quoteCurrency !== selectedAccount?.currency && <label><span>{item.quoteCurrency}/{selectedAccount?.currency} 환율</span><input type="number" min="0.000001" step="0.000001" value={item.exchangeRate} onChange={(event) => updateItem(index, 'exchangeRate', event.target.value)} /></label>}<span className="investment-plan-estimate"><small>{formatRatio(item.targetRatio)}% · {currency(planned, selectedAccount?.currency)}</small><strong>예상 수량 {basePrice > 0 ? (planned / basePrice).toLocaleString('ko-KR', { maximumFractionDigits: 6 }) : 0}주</strong></span><button type="button" onClick={() => removeItem(index)}>×</button></div>;
          })}</div>
        </section>
        <label className="planning-memo-field"><span>계획 메모</span><textarea value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} placeholder="투자 원칙이나 매수 기준을 기록하세요." /></label>
        <div className="planning-modal-actions"><button type="button" onClick={() => setModalPlan(null)}>취소</button><button className="is-primary" disabled={saving}>{saving ? '저장 중' : '투자 계획 저장'}</button></div>
      </form>
    </InlineEditor>}
      <div className="investment-plan-grid">
        {plans.map((plan) => <article className="investment-plan-card" key={plan.investmentPlanId}>
          <header><div><span className={`investment-plan-status is-${plan.status.toLowerCase()}`}>{plan.status === 'ACTIVE' ? '진행 중' : '일시 중지'}</span><h3>{plan.title}</h3><p>{plan.investmentAccountName} · {plan.accountCurrency}</p></div><div><button onClick={() => openModal(plan)}>수정</button><button onClick={() => archive(plan)}>보관</button></div></header>
          <div className="investment-plan-kpis"><div><span>이번 달</span><strong>{currency(plan.monthlyActualAmount, plan.accountCurrency)}</strong><small>/ {currency(plan.monthlyAmount, plan.accountCurrency)}</small></div><div><span>누적 투자 원금</span><strong>{currency(plan.cumulativeInvestedAmount, plan.accountCurrency)}</strong><small>/ {currency(plan.targetAmount, plan.accountCurrency)}</small></div></div>
          <div className="investment-plan-progress"><div><span>이번 달 실행률</span><b>{number(plan.monthlyExecutionRate).toFixed(1)}%</b></div><span><i style={{ width: `${Math.min(100, number(plan.monthlyExecutionRate))}%` }} /></span></div>
          <div className="investment-plan-progress is-target"><div><span>전체 목표 달성률</span><b>{number(plan.targetProgressRate).toFixed(1)}%</b></div><span><i style={{ width: `${Math.min(100, number(plan.targetProgressRate))}%` }} /></span></div>
          <div className="investment-plan-items">{plan.items.map((item) => <div key={item.investmentPlanItemId}><span><strong>{item.symbolName}</strong><small>{item.tickerCode} · 목표 {formatRatio(item.targetRatio)}%</small></span><span><strong>{currency(item.plannedAmount, plan.accountCurrency)}</strong><small>예상 {number(item.expectedQuantity).toLocaleString('ko-KR', { maximumFractionDigits: 6 })}주</small></span><button onClick={() => onOpenTrade(plan, item)}>거래 입력</button></div>)}</div>
          <footer><span>다음 예정일 <strong>{plan.nextExecutionDate || '계획 종료'}</strong></span><span>{plan.sourceAccountName ? `${plan.sourceAccountName}에서 준비` : '출금 계좌 미지정'}</span></footer>
        </article>)}
        {!plans.length && <div className="planning-empty-state"><span>↗</span><h3>아직 투자 계획이 없습니다.</h3><p>월 투자금과 종목별 비중을 정해보세요.</p><button onClick={() => openModal()}>첫 투자 계획 만들기</button></div>}
      </div>
    </div>


  </>;
}
