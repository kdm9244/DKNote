import InlineEditor from "../../workspace/InlineEditor";
import React, { useEffect, useRef, useState } from 'react';
import {
  createInvestmentTransaction,
  getInvestmentDetail,
  getInvestmentFeeSettings,
  getInvestmentPriceProviderStatus,
  getInvestmentTradePrice,
  searchInvestmentSymbols,
  updateInvestmentFeeSettings,
} from '../../../api/investment';
import '../../../styles/investment-transaction-form.css';

const TRADE_TYPES = [
  { value: 'BUY', label: '매수', description: '종목을 사고 예수금을 차감합니다.' },
  { value: 'SELL', label: '매도', description: '보유 종목을 팔고 예수금을 늘립니다.' },
  { value: 'DIVIDEND', label: '배당', description: '배당금을 예수금에 반영합니다.' },
  { value: 'DEPOSIT', label: '예수금 입금', description: '투자 계좌에 현금을 추가합니다.' },
  { value: 'WITHDRAWAL', label: '예수금 출금', description: '투자 계좌에서 현금을 인출합니다.' },
];

const ASSET_CLASSES = [
  { value: 'INDEX_ETF', label: '지수 ETF' },
  { value: 'DOMESTIC_STOCK', label: '개별주(국내)' },
  { value: 'FOREIGN_STOCK', label: '개별주(해외)' },
  { value: 'DIVIDEND_ASSET', label: '배당주/ETF' },
];

const MARKET_LABELS = { KR: '한국', US: '미국', JP: '일본' };
const EMPTY_FEE_SETTINGS = ['KR', 'US', 'JP'].map((marketGroup) => ({
  marketGroup, buyFeeRate: 0, sellFeeRate: 0, sellTaxRate: 0, dividendTaxRate: 0,
}));

const nowForInput = () => {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
};

const number = (value) => Number(value || 0);
const currency = (value, code) => {
  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency', currency: code || 'KRW', maximumFractionDigits: code === 'KRW' ? 0 : 2,
    }).format(number(value));
  } catch {
    return `${number(value).toLocaleString('ko-KR')} ${code || ''}`;
  }
};

const getErrorMessage = (error, fallback) => error?.response?.data?.message
  || error?.response?.data?.detail
  || error?.response?.data?.error
  || fallback;

function SymbolSearch({ accountId, market, providerConfigured, value, onChange }) {
  const [query, setQuery] = useState(value?.symbolName || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    setQuery(value?.symbolName || '');
  }, [value?.investmentId, value?.tickerCode, value?.symbolName]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage('');
      try {
        const items = await searchInvestmentSymbols(accountId, query.trim(), market);
        if (requestId.current === currentRequest) setResults(items);
      } catch (error) {
        if (requestId.current === currentRequest) setMessage(getErrorMessage(error, '종목을 검색하지 못했습니다.'));
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [accountId, market, open, query]);

  const selectSymbol = (item) => {
    onChange(item);
    setQuery(item.symbolName);
    setOpen(false);
  };

  return (
    <div className="investment-symbol-search">
      <div className="investment-form-label-row">
        <label htmlFor="investment-symbol-query">종목 검색</label>
        <span className="investment-search-market-label">{market === 'KR' ? '한국 KRX' : market === 'US' ? '미국 NASDAQ·NYSE·AMEX' : '일본 TSE'}</span>
      </div>
      <div className="investment-symbol-input-wrap">
        <span>⌕</span>
        <input
          id="investment-symbol-query"
          value={query}
          autoComplete="off"
          placeholder={market === 'KR' ? '종목명 또는 코드 (예: 삼성전자, 005930)' : market === 'US' ? '한글명·영문명·티커 (예: 애플, Apple, AAPL)' : '한글명·영문명·코드 (예: 도요타, Toyota, 7203)'}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(null); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter' && results.length) { event.preventDefault(); selectSymbol(results[0]); }
          }}
        />
        {loading && <i className="investment-symbol-spinner" />}
      </div>
      {open && query.trim().length >= 2 && (
        <div className="investment-symbol-dropdown">
          {loading && <div className="investment-symbol-status">종목 정보를 확인하는 중입니다.</div>}
          {!loading && message && <div className="investment-symbol-status is-error">{message}</div>}
          {!loading && !message && results.map((item) => (
            <button type="button" key={`${item.market}-${item.tickerCode}`} onClick={() => selectSymbol(item)}>
              <span className="investment-symbol-avatar">{item.symbolName?.slice(0, 1) || item.tickerCode.slice(0, 1)}</span>
              <span className="investment-symbol-copy">
                <strong>{item.symbolName}</strong>
                <small>{item.tickerCode} · {item.market} · {item.currency}</small>
              </span>
              <span className="investment-symbol-price">
                <strong>{item.currentPrice !== null && item.currentPrice !== undefined ? currency(item.currentPrice, item.currency) : '선택하여 시세 조회'}</strong>
                <small>{item.registered ? `보유 ${number(item.quantity).toLocaleString('ko-KR')}` : '현재가 · 시초가 확인'}</small>
              </span>
            </button>
          ))}
          {!loading && !message && !results.length && <div className="investment-symbol-status">{providerConfigured ? (market === 'KR' ? '종목명 또는 6자리 코드를 다시 확인해 주세요.' : '종목명이나 종목 코드를 다시 확인해 주세요.') : '현재 종목 검색을 이용할 수 없습니다.'}</div>}
        </div>
      )}
      {value && (
        <div className="investment-selected-symbol">
          <span className="investment-symbol-avatar">{value.symbolName?.slice(0, 1)}</span>
          <div><strong>{value.symbolName}</strong><small>{value.tickerCode} · {value.market} · {value.currency}</small></div>
          <div><strong>{value.currentPrice === null || value.currentPrice === undefined ? '시세 조회 중' : currency(value.currentPrice, value.currency)}</strong><small>{value.registered ? `현재 보유 ${number(value.quantity).toLocaleString('ko-KR')}` : '신규 종목'}</small></div>
        </div>
      )}
    </div>
  );
}

function HoldingSelector({ holdings, value, onChange, emptyMessage }) {
  const availableHoldings = holdings.filter((item) => item.assetClass !== 'CASH' && number(item.quantity) > 0);
  if (!availableHoldings.length) return <div className="investment-holding-empty">{emptyMessage}</div>;

  return (
    <div className="investment-holding-selector">
      {availableHoldings.map((item) => (
        <button
          type="button"
          key={item.investmentId}
          className={value?.investmentId === item.investmentId ? 'is-active' : ''}
          onClick={() => onChange({ ...item, registered: true, source: 'PORTFOLIO' })}
        >
          <span className="investment-symbol-avatar">{item.symbolName?.slice(0, 1)}</span>
          <span><strong>{item.symbolName}</strong><small>{item.tickerCode} · {item.market} · {item.currency}</small></span>
          <span><strong>{currency(item.currentPrice, item.currency)}</strong><small>보유 {number(item.quantity).toLocaleString('ko-KR', { maximumFractionDigits: 6 })}주</small></span>
        </button>
      ))}
    </div>
  );
}

function FeeSettingsEditor({ settings, saving, onClose, onSave }) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => setDraft(settings), [settings]);

  const updateRate = (marketGroup, field, value) => {
    setDraft((current) => current.map((item) => (item.marketGroup === marketGroup
      ? { ...item, [field]: value }
      : item)));
  };

  return (
    <InlineEditor title="수수료·세금 설정" busy={saving} onClose={onClose}>
      <section className="investment-fee-modal">
        <p className="investment-fee-description">증권사와 적용 이벤트에 따라 요율이 달라질 수 있습니다. 실제 계좌의 요율을 입력하면 거래 금액을 기준으로 자동 계산합니다.</p>
        <div className="investment-fee-market-list">
          {draft.map((item) => (
            <article key={item.marketGroup}>
              <div><strong>{MARKET_LABELS[item.marketGroup]}</strong><small>{item.marketGroup === 'KR' ? 'KRX · KRW' : item.marketGroup === 'US' ? 'NASDAQ·NYSE · USD' : 'TSE · JPY'}</small></div>
              <label><span>매수 수수료</span><div><input type="number" min="0" max="100" step="0.000001" value={item.buyFeeRate} onChange={(event) => updateRate(item.marketGroup, 'buyFeeRate', event.target.value)} /><em>%</em></div></label>
              <label><span>매도 수수료</span><div><input type="number" min="0" max="100" step="0.000001" value={item.sellFeeRate} onChange={(event) => updateRate(item.marketGroup, 'sellFeeRate', event.target.value)} /><em>%</em></div></label>
              <label><span>매도 세금</span><div><input type="number" min="0" max="100" step="0.000001" value={item.sellTaxRate} onChange={(event) => updateRate(item.marketGroup, 'sellTaxRate', event.target.value)} /><em>%</em></div></label>
              <label><span>배당 원천징수</span><div><input type="number" min="0" max="100" step="0.000001" value={item.dividendTaxRate} onChange={(event) => updateRate(item.marketGroup, 'dividendTaxRate', event.target.value)} /><em>%</em></div></label>
            </article>
          ))}
        </div>
        <div className="investment-fee-notice"><strong>매수도 수수료가 항상 0원인 것은 아닙니다.</strong><span>무료 이벤트를 적용받는 경우 해당 시장의 매수 수수료를 0으로 저장하세요. 기본값은 모두 0%입니다.</span></div>
        <footer><button type="button" onClick={onClose}>취소</button><button type="button" className="is-primary" disabled={saving} onClick={() => onSave(draft)}>{saving ? '저장 중…' : '설정 저장'}</button></footer>
      </section>
    </InlineEditor>
  );
}

export default function InvestmentTransactionCreatePage({ account, accounts = [], initialDraft = null, onCancel, onSaved }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [buyMarket, setBuyMarket] = useState('KR');
  const [feeSettings, setFeeSettings] = useState(EMPTY_FEE_SETTINGS);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceBasis, setPriceBasis] = useState(null);
  const [form, setForm] = useState({
    tradeType: 'BUY', quantity: '', unitPrice: '', amount: '',
    currency: 'KRW', exchangeRate: '1', tradeDate: nowForInput(), memo: '',
    assetClass: 'DOMESTIC_STOCK', counterAccountId: '',
  });

  useEffect(() => {
    let alive = true;
    Promise.all([
      getInvestmentDetail(account.accountId),
      getInvestmentPriceProviderStatus().catch(() => ({ configured: false })),
      getInvestmentFeeSettings(account.accountId).catch(() => EMPTY_FEE_SETTINGS),
    ])
      .then(([data, provider, savedFeeSettings]) => {
        if (!alive) return;
        const baseCurrency = data.account.currency || 'KRW';
        const defaultMarket = baseCurrency === 'USD' ? 'US' : baseCurrency === 'JPY' ? 'JP' : 'KR';
        setDetail(data);
        setProviderConfigured(Boolean(provider.configured));
        setFeeSettings(savedFeeSettings);
        setBuyMarket(defaultMarket);
        const draftCurrency = initialDraft?.currency || baseCurrency;
        const draftMarket = draftCurrency === 'USD' ? 'US' : draftCurrency === 'JPY' ? 'JP' : 'KR';
        if (initialDraft) {
          setSelectedSymbol({
            investmentId: initialDraft.investmentId || null,
            tickerCode: initialDraft.tickerCode,
            symbolName: initialDraft.symbolName,
            market: initialDraft.market,
            currency: draftCurrency,
            assetClass: initialDraft.assetClass,
            currentPrice: initialDraft.currentPrice,
            quantity: 0,
            registered: Boolean(initialDraft.investmentId),
            source: 'PLAN',
          });
          setBuyMarket(draftMarket);
          setPriceBasis(initialDraft.currentPrice ? { type: '계획 참고가', quotedAt: null } : null);
        }
        setForm((current) => ({
          ...current,
          currency: draftCurrency,
          exchangeRate: initialDraft ? String(initialDraft.exchangeRate || (draftCurrency === baseCurrency ? 1 : '')) : '1',
          assetClass: initialDraft?.assetClass || (baseCurrency === 'KRW' ? 'DOMESTIC_STOCK' : 'FOREIGN_STOCK'),
          quantity: initialDraft ? String(initialDraft.quantity || '') : current.quantity,
          unitPrice: initialDraft ? String(initialDraft.currentPrice || '') : current.unitPrice,
          memo: initialDraft ? `투자 계획 · ${initialDraft.planTitle}` : current.memo,
        }));
        setError('');
      })
      .catch((requestError) => alive && setError(getErrorMessage(requestError, '투자 계좌 정보를 불러오지 못했습니다.')))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [account.accountId, initialDraft?.planId, initialDraft?.tickerCode]);

  const isSecurityTrade = ['BUY', 'SELL', 'DIVIDEND'].includes(form.tradeType);
  const isQuantityTrade = ['BUY', 'SELL'].includes(form.tradeType);
  const isCashTrade = ['DEPOSIT', 'WITHDRAWAL'].includes(form.tradeType);
  const accountCurrency = detail?.account?.currency || account.currency || 'KRW';
  const counterAccounts = accounts.filter((item) => item.accountId !== account.accountId
    && !['INVESTMENT', 'DEBT', 'FOREIGN_CURRENCY'].includes(item.accountType)
    && item.currency === accountCurrency
    && item.isActive !== false);
  const transactionCurrency = selectedSymbol?.currency || form.currency;
  const marketGroup = transactionCurrency === 'USD' ? 'US' : transactionCurrency === 'JPY' ? 'JP' : 'KR';
  const activeFeeSetting = feeSettings.find((item) => item.marketGroup === marketGroup) || EMPTY_FEE_SETTINGS[0];
  const exchangeRate = transactionCurrency === accountCurrency ? 1 : number(form.exchangeRate);
  const gross = isQuantityTrade ? number(form.quantity) * number(form.unitPrice) : number(form.amount);
  const rateAmount = (rate) => Math.round(gross * number(rate)) / 100;
  const feeAmount = form.tradeType === 'BUY' ? rateAmount(activeFeeSetting.buyFeeRate)
    : form.tradeType === 'SELL' ? rateAmount(activeFeeSetting.sellFeeRate) : 0;
  const taxAmount = form.tradeType === 'SELL' ? rateAmount(activeFeeSetting.sellTaxRate)
    : form.tradeType === 'DIVIDEND' ? rateAmount(activeFeeSetting.dividendTaxRate) : 0;
  const cost = (gross + (form.tradeType === 'BUY' ? feeAmount + taxAmount : 0)) * exchangeRate;
  const proceeds = (gross - (['SELL', 'DIVIDEND'].includes(form.tradeType) ? feeAmount + taxAmount : 0)) * exchangeRate;
  const cashChange = form.tradeType === 'BUY' || form.tradeType === 'WITHDRAWAL' ? -cost : proceeds;
  const currentCash = number(detail?.summary?.cashBalance);
  const afterCash = currentCash + cashChange;
  const currentQuantity = number(selectedSymbol?.quantity);
  const afterQuantity = form.tradeType === 'BUY'
    ? currentQuantity + number(form.quantity)
    : form.tradeType === 'SELL' ? currentQuantity - number(form.quantity) : currentQuantity;
  const sellCostBasis = number(selectedSymbol?.averageBuyPriceBase) * number(form.quantity);
  const expectedRealized = proceeds - sellCostBasis;
  const expectedReturnRate = sellCostBasis > 0 ? expectedRealized / sellCostBasis * 100 : 0;

  const selectTradeType = (tradeType) => {
    setSelectedSymbol(null);
    setPriceBasis(null);
    setError('');
    setForm((current) => ({
      ...current, tradeType, quantity: '', unitPrice: '', amount: '', memo: '', counterAccountId: '',
      currency: tradeType === 'BUY'
        ? buyMarket === 'KR' ? 'KRW' : buyMarket === 'US' ? 'USD' : 'JPY'
        : tradeType === 'DEPOSIT' || tradeType === 'WITHDRAWAL' ? accountCurrency : current.currency,
      exchangeRate: tradeType === 'BUY'
        ? (buyMarket === 'KR' ? 'KRW' : buyMarket === 'US' ? 'USD' : 'JPY') === accountCurrency ? '1' : ''
        : tradeType === 'DEPOSIT' || tradeType === 'WITHDRAWAL' ? '1' : current.exchangeRate,
      assetClass: tradeType === 'BUY' && buyMarket === 'KR' ? 'DOMESTIC_STOCK' : current.assetClass,
    }));
  };

  const selectBuyMarket = (market) => {
    setBuyMarket(market);
    setSelectedSymbol(null);
    setPriceBasis(null);
    setError('');
    setForm((current) => ({
      ...current,
      unitPrice: '',
      currency: market === 'KR' ? 'KRW' : market === 'US' ? 'USD' : 'JPY',
      exchangeRate: (market === 'KR' ? 'KRW' : market === 'US' ? 'USD' : 'JPY') === accountCurrency ? '1' : '',
      assetClass: market === 'KR' ? 'DOMESTIC_STOCK' : 'FOREIGN_STOCK',
    }));
  };

  const applySelectedSymbol = (symbol) => {
    setSelectedSymbol(symbol);
    if (!symbol) {
      setPriceBasis(null);
      return;
    }
    const currentPrice = number(symbol.currentPrice) > 0 ? number(symbol.currentPrice) : null;
    const openingPrice = number(symbol.openingPrice) > 0 ? number(symbol.openingPrice) : null;
    const automaticPrice = currentPrice || openingPrice;
    const automaticType = currentPrice
      ? symbol.source === 'PORTFOLIO' ? '저장된 최근가' : 'KIS 현재가'
      : openingPrice ? '오늘 시초가' : null;
    setPriceBasis(automaticPrice ? {
      type: automaticType,
      quotedAt: symbol.priceUpdatedAt || symbol.quotedAt || null,
    } : null);
    if (form.tradeType === 'BUY') {
      setBuyMarket(symbol.currency === 'USD' ? 'US' : symbol.currency === 'JPY' ? 'JP' : 'KR');
    }
    setForm((current) => ({
      ...current,
      unitPrice: automaticPrice ? String(automaticPrice) : current.unitPrice,
      currency: symbol.currency,
      exchangeRate: symbol.currency === accountCurrency ? '1' : current.exchangeRate === '1' ? '' : current.exchangeRate,
      assetClass: symbol.assetClass || (symbol.currency === 'KRW' ? 'DOMESTIC_STOCK' : 'FOREIGN_STOCK'),
    }));
  };

  const selectSymbol = async (symbol) => {
    applySelectedSymbol(symbol);
    if (!symbol || !['BUY', 'SELL'].includes(form.tradeType) || !providerConfigured) return;

    setPriceLoading(true);
    try {
      const quote = await getInvestmentTradePrice(account.accountId, symbol);
      applySelectedSymbol({
        ...symbol,
        currentPrice: quote.currentPrice,
        openingPrice: quote.openingPrice,
        priceUpdatedAt: quote.quotedAt,
        source: quote.source,
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError, `현재가와 오늘 시초가를 불러오지 못했습니다. 실제 ${form.tradeType === 'SELL' ? '매도' : '매수'} 체결 단가를 직접 입력해 주세요.`));
    } finally {
      setPriceLoading(false);
    }
  };

  const validate = () => {
    if (isSecurityTrade && !selectedSymbol) return '거래할 종목을 선택해 주세요.';
    if (isQuantityTrade && number(form.quantity) <= 0) return '수량을 입력해 주세요.';
    if (isQuantityTrade && number(form.unitPrice) <= 0) return '거래 단가를 입력해 주세요.';
    if (!isQuantityTrade && number(form.amount) <= 0) return '거래 금액을 입력해 주세요.';
    if (isCashTrade && !form.counterAccountId) return '예수금을 이동할 상대 계좌 또는 외부 입출금을 선택해 주세요.';
    if (transactionCurrency !== accountCurrency && number(form.exchangeRate) <= 0) return `${transactionCurrency}를 ${accountCurrency}로 환산할 환율을 입력해 주세요.`;
    if (form.tradeType === 'SELL' && number(form.quantity) > currentQuantity) return '보유 수량보다 많이 매도할 수 없습니다.';
    if (afterCash < 0) return '거래 후 예수금이 부족합니다.';
    return '';
  };

  const saveFeeSettings = async (draft) => {
    setFeeSaving(true);
    setError('');
    try {
      const normalized = draft.map((item) => ({
        ...item,
        buyFeeRate: number(item.buyFeeRate),
        sellFeeRate: number(item.sellFeeRate),
        sellTaxRate: number(item.sellTaxRate),
        dividendTaxRate: number(item.dividendTaxRate),
      }));
      const saved = await updateInvestmentFeeSettings(account.accountId, normalized);
      setFeeSettings(saved);
      setFeeModalOpen(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '수수료·세금 설정을 저장하지 못했습니다.'));
    } finally {
      setFeeSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await createInvestmentTransaction(account.accountId, {
        tradeType: form.tradeType,
        investmentId: selectedSymbol?.investmentId || null,
        tickerCode: selectedSymbol?.tickerCode || null,
        symbolName: selectedSymbol?.symbolName || null,
        assetClass: selectedSymbol?.assetClass || form.assetClass,
        market: selectedSymbol?.market || null,
        quantity: isQuantityTrade ? number(form.quantity) : 0,
        unitPrice: isQuantityTrade ? number(form.unitPrice) : 0,
        amount: isQuantityTrade ? null : number(form.amount),
        feeAmount: null,
        taxAmount: null,
        applyFeeSettings: true,
        currency: transactionCurrency,
        exchangeRate: transactionCurrency === accountCurrency ? 1 : number(form.exchangeRate),
        tradeDate: form.tradeDate ? `${form.tradeDate}:00` : null,
        memo: form.memo.trim() || null,
        counterAccountId: isCashTrade && form.counterAccountId !== 'EXTERNAL'
          ? form.counterAccountId : null,
      });
      onSaved(saved);
    } catch (requestError) {
      setError(getErrorMessage(requestError, '거래를 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="investment-state"><div className="investment-spinner" /><h2>거래 입력 화면을 준비하고 있습니다.</h2></div>;
  if (!detail) return <div className="investment-state is-error"><h2>{error}</h2><button type="button" onClick={onCancel}>계좌 상세로</button></div>;

  return (
    <div className="investment-transaction-page">
      <header className="investment-transaction-header">
        <div>
          <button type="button" onClick={onCancel}>← 투자 계좌 상세로</button>
          <h1>투자 거래 추가</h1>
          <p>{detail.account.accountName} · 현재 예수금 <strong>{currency(currentCash, accountCurrency)}</strong></p>
        </div>
        <div><button type="button" onClick={() => setFeeModalOpen(true)}>수수료·세금 설정</button><button type="button" onClick={onCancel}>취소</button><button type="submit" form="investment-transaction-form" className="is-primary" disabled={saving}>{saving ? '저장 중…' : '거래 저장'}</button></div>
      </header>

      {feeModalOpen && <FeeSettingsEditor settings={feeSettings} saving={feeSaving} onClose={() => setFeeModalOpen(false)} onSave={saveFeeSettings} />}
      <form id="investment-transaction-form" className="investment-transaction-layout" onSubmit={handleSubmit}>
        <div className="investment-transaction-form-card">
          <section>
            <div className="investment-form-section-title"><span>1</span><div><h2>거래 유형</h2><p>계좌에 반영할 거래 종류를 선택하세요.</p></div></div>
            <div className="investment-trade-type-grid">
              {TRADE_TYPES.map((type) => <button type="button" key={type.value} className={form.tradeType === type.value ? 'is-active' : ''} onClick={() => selectTradeType(type.value)}><strong>{type.label}</strong><small>{type.description}</small></button>)}
            </div>
          </section>

          {isSecurityTrade && (
            <section>
              <div className="investment-form-section-title"><span>2</span><div><h2>종목 선택</h2><p>{form.tradeType === 'BUY' ? '투자 국가를 선택한 뒤 해당 시장의 종목 코드를 검색하세요.' : '현재 계좌에서 실제로 보유 중인 종목을 선택하세요.'}</p></div></div>
              {form.tradeType === 'BUY' ? <>
                {detail.holdings.some((item) => item.assetClass !== 'CASH' && number(item.quantity) > 0) && <div className="investment-rebuy-section">
                  <div className="investment-rebuy-heading"><div><strong>보유 종목 빠른 매수</strong><span>이미 등록한 종목은 검색 없이 바로 선택할 수 있습니다.</span></div></div>
                  <HoldingSelector holdings={detail.holdings} value={selectedSymbol} onChange={selectSymbol} emptyMessage="" />
                </div>}
                <div className="investment-buy-market-tabs" aria-label="매수 시장 선택">
                  <button type="button" className={buyMarket === 'KR' ? 'is-active' : ''} onClick={() => selectBuyMarket('KR')}><strong>🇰🇷 한국</strong><small>KRX · KRW</small></button>
                  <button type="button" className={buyMarket === 'US' ? 'is-active' : ''} onClick={() => selectBuyMarket('US')}><strong>🇺🇸 미국</strong><small>NASDAQ · NYSE · USD</small></button>
                  <button type="button" className={buyMarket === 'JP' ? 'is-active' : ''} onClick={() => selectBuyMarket('JP')}><strong>🇯🇵 일본</strong><small>TSE · JPY</small></button>
                </div>
                <SymbolSearch accountId={account.accountId} market={buyMarket} providerConfigured={providerConfigured} value={selectedSymbol} onChange={selectSymbol} />
              </> : (
                <HoldingSelector
                  holdings={detail.holdings}
                  value={selectedSymbol}
                  onChange={selectSymbol}
                  emptyMessage={form.tradeType === 'SELL' ? '매도할 수 있는 보유 종목이 없습니다.' : '배당을 등록할 보유 종목이 없습니다.'}
                />
              )}
              {form.tradeType === 'BUY' && selectedSymbol && !selectedSymbol.registered && (
                <label className="investment-form-field is-small"><span>자산 분류</span><select value={form.assetClass} onChange={(event) => setForm((current) => ({ ...current, assetClass: event.target.value }))}>{ASSET_CLASSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
              )}
            </section>
          )}

          <section>
            <div className="investment-form-section-title"><span>{isSecurityTrade ? '3' : '2'}</span><div><h2>거래 정보</h2><p>거래 금액을 입력하면 저장된 시장별 요율로 비용과 예상 예수금을 자동 계산합니다.</p></div></div>
            <div className="investment-form-grid">
              {isQuantityTrade ? <>
                <label className="investment-form-field"><span>수량 *</span><input type="number" min="0" step="0.000001" value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} placeholder="0" /></label>
                <label className="investment-form-field">
                  <span>단가 * {['BUY', 'SELL'].includes(form.tradeType) && <small className="investment-live-price-label">
                    {priceLoading ? 'KIS 시세 조회 중…' : priceBasis ? `${priceBasis.type} 자동 입력 · 실제 체결가로 수정 가능` : number(form.unitPrice) > 0 ? '직접 입력한 체결가' : '종목 선택 시 자동 입력'}
                  </small>}</span>
                  <div className="investment-input-unit"><input type="number" min="0" step="0.0001" value={form.unitPrice} onChange={(event) => { setPriceBasis(null); setForm((current) => ({ ...current, unitPrice: event.target.value })); }} placeholder={priceLoading ? '시세 조회 중…' : '0'} /><em>{transactionCurrency}</em></div>
                  {selectedSymbol && ['BUY', 'SELL'].includes(form.tradeType) && <div className="investment-price-assist">
                    <span>{priceBasis?.quotedAt ? `${new Date(priceBasis.quotedAt).toLocaleString('ko-KR')} 기준` : 'KIS에서 현재가를 우선 조회합니다.'}</span>
                    <button type="button" disabled={priceLoading} onClick={() => selectSymbol(selectedSymbol)}>{priceLoading ? '조회 중…' : '시세 다시 조회'}</button>
                  </div>}
                </label>
              </> : <label className="investment-form-field"><span>{form.tradeType === 'DIVIDEND' ? '배당 금액' : '예수금 금액'} *</span><div className="investment-input-unit"><input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0" /><em>{transactionCurrency}</em></div></label>}
              {isCashTrade && <label className="investment-form-field is-full investment-counter-account-field">
                <span>상대 계좌 *</span>
                <select value={form.counterAccountId} onChange={(event) => setForm((current) => ({ ...current, counterAccountId: event.target.value }))}>
                  <option value="">이동할 계좌를 선택해 주세요</option>
                  {counterAccounts.map((item) => <option key={item.accountId} value={item.accountId}>
                    {item.accountName} · {item.bankName || '금융기관 미등록'} · {currency(item.cachedBookBalance, item.currency)}
                  </option>)}
                  <option value="EXTERNAL">외부 {form.tradeType === 'DEPOSIT' ? '입금' : '출금'} · 실제 {form.tradeType === 'DEPOSIT' ? '수입' : '지출'}로 기록</option>
                </select>
                <small>{form.counterAccountId === 'EXTERNAL'
                  ? `가계부의 실제 ${form.tradeType === 'DEPOSIT' ? '수입' : '지출'}에 포함됩니다.`
                  : '계좌 간 이체는 양쪽 잔액만 이동하며 월 수입·지출 합계에는 포함되지 않습니다.'}</small>
              </label>}
              {!isCashTrade && <div className="investment-applied-fee-setting"><div><span>{MARKET_LABELS[marketGroup]} 시장 비용 자동 적용</span><strong>수수료 {currency(feeAmount, transactionCurrency)} · 세금 {currency(taxAmount, transactionCurrency)}</strong></div><button type="button" onClick={() => setFeeModalOpen(true)}>설정 변경</button></div>}
              {transactionCurrency !== accountCurrency && <label className="investment-form-field"><span>적용 환율 (1 {transactionCurrency} → {accountCurrency}) *</span><input type="number" min="0" step="0.0001" value={form.exchangeRate} onChange={(event) => setForm((current) => ({ ...current, exchangeRate: event.target.value }))} placeholder={`1 ${transactionCurrency}의 ${accountCurrency} 환산값`} /></label>}
              <label className="investment-form-field"><span>거래 일시 *</span><input type="datetime-local" value={form.tradeDate} max={nowForInput()} onChange={(event) => setForm((current) => ({ ...current, tradeDate: event.target.value }))} /></label>
              <label className="investment-form-field is-full"><span>메모</span><textarea value={form.memo} onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))} placeholder="거래 목적이나 참고 내용을 기록하세요." rows="3" /></label>
            </div>
          </section>
          {error && <div className="investment-form-error" role="alert">{error}</div>}
        </div>

        <aside className="investment-transaction-preview">
          <div className="investment-preview-account"><span>거래 계좌</span><strong>{detail.account.accountName}</strong><small>{detail.account.bankName} · {detail.account.accountNumberMasked || '계좌번호 미등록'}</small></div>
          <h2>거래 후 예상</h2>
          <div className="investment-preview-list">
            <div><span>거래 금액</span><strong>{currency(gross, transactionCurrency)}</strong></div>
            {!isCashTrade && <><div><span>예상 수수료</span><strong>{currency(feeAmount, transactionCurrency)}</strong></div><div><span>예상 세금</span><strong>{currency(taxAmount, transactionCurrency)}</strong></div></>}
            {transactionCurrency !== accountCurrency && <div><span>적용 환율</span><strong>1 {transactionCurrency} = {number(exchangeRate).toLocaleString('ko-KR')} {accountCurrency}</strong></div>}
            {form.tradeType === 'SELL' && selectedSymbol && <><div><span>취득 원가</span><strong>{currency(sellCostBasis, accountCurrency)}</strong></div><div className="is-highlight"><span>예상 실현손익</span><strong className={expectedRealized >= 0 ? 'is-positive' : 'is-negative'}>{expectedRealized >= 0 ? '+' : '-'}{currency(Math.abs(expectedRealized), accountCurrency)} ({expectedReturnRate >= 0 ? '+' : ''}{expectedReturnRate.toFixed(2)}%)</strong></div></>}
            <div className="is-highlight"><span>예수금 변동</span><strong className={cashChange >= 0 ? 'is-positive' : 'is-negative'}>{cashChange >= 0 ? '+' : '-'}{currency(Math.abs(cashChange), accountCurrency)}</strong></div>
            <div><span>현재 예수금</span><strong>{currency(currentCash, accountCurrency)}</strong></div>
            <div className="is-total"><span>거래 후 예수금</span><strong className={afterCash < 0 ? 'is-negative' : ''}>{currency(afterCash, accountCurrency)}</strong></div>
            {isQuantityTrade && selectedSymbol && <div><span>거래 후 보유 수량</span><strong className={afterQuantity < 0 ? 'is-negative' : ''}>{afterQuantity.toLocaleString('ko-KR', { maximumFractionDigits: 6 })}주</strong></div>}
          </div>
          <div className="investment-preview-note"><strong>자동 반영 안내</strong><p>저장하면 보유 수량과 평균매입가, 예수금, 평가금액, 거래 내역이 함께 갱신됩니다.</p></div>
          <button type="submit" disabled={saving}>{saving ? '저장 중…' : '거래 저장하기'}</button>
        </aside>
      </form>

    </div>
  );
}
