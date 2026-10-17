import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AccountIdentityCard from '../shared/AccountIdentityCard';
import {
  createForeignTransaction,
  deleteForeignTransaction,
  getForeignAccountDetail,
  syncForeignExchangeRates,
  updateForeignTransaction,
} from '../../../api/foreignCurrency';
import '../../../styles/foreign-currency-account.css';

const PURPOSES = {
  DEPOSIT: [
    ['EXCHANGE_DEPOSIT', '환전 입금'],
    ['FOREIGN_TRANSFER_IN', '외화 이체'],
    ['FOREIGN_SALARY', '외화 급여'],
    ['INTEREST', '외화 이자'],
    ['OTHER_DEPOSIT', '기타 입금'],
  ],
  WITHDRAWAL: [
    ['EXCHANGE_WITHDRAWAL', '환전 출금'],
    ['FOREIGN_TRANSFER_OUT', '해외 송금'],
    ['FOREIGN_SPENDING', '해외 결제·사용'],
    ['CASH_WITHDRAWAL', '외화 현금 출금'],
    ['OTHER_WITHDRAWAL', '기타 출금'],
  ],
};

const nowInputValue = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const emptyForm = (type = 'DEPOSIT', currency = 'KRW') => ({
  transactionType: type,
  currency,
  purpose: PURPOSES[type][0][0],
  title: '',
  amount: '',
  exchangeRate: '',
  exchangeRateCurrency: 'KRW',
  krwExchangeRate: '',
  feeKrw: '0',
  transactionDate: nowInputValue(),
  memo: '',
});

const currencyMeta = {
  KRW: { symbol: '₩', mark: 'KRW', name: '대한민국 원', digits: 0 },
  USD: { symbol: '$', mark: 'USD', name: '미국 달러', digits: 2 },
  JPY: { symbol: '¥', mark: 'JPY', name: '일본 엔', digits: 0 },
};

const formatNumber = (value, digits = 2) => value === null || value === undefined
  ? '-'
  : new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(Number(value));

const formatForeign = (value, currency) => {
  const meta = currencyMeta[currency] || { symbol: currency, digits: 2 };
  return `${meta.symbol}${formatNumber(value, meta.digits)}`;
};

const formatKrw = (value, signed = false) => {
  if (value === null || value === undefined) return '-';
  const number = Number(value);
  const prefix = number < 0 ? '-' : signed && number > 0 ? '+' : '';
  return `${prefix}₩${formatNumber(Math.abs(number), 0)}`;
};

const formatRate = (value, currency) => {
  if (value === null || value === undefined) return '-';
  if (currency === 'KRW') return '₩1';
  if (currency === 'JPY') return `₩${formatNumber(Number(value) * 100, 2)} / 100엔`;
  return `₩${formatNumber(value, 2)} / 1${currency === 'USD' ? '달러' : currency}`;
};

const formatQuotedRate = (value, baseCurrency, quoteCurrency = 'KRW') => {
  if (value === null || value === undefined) return '-';
  return `1 ${baseCurrency} = ${formatNumber(value, 4)} ${quoteCurrency}`;
};

const purposeLabel = (type, value) => PURPOSES[type]?.find(([key]) => key === value)?.[1] || value;

export default function ForeignCurrencyAccountView({
  account,
  onUpdate,
  onEditClick,
  onBackToDashboard,
}) {
  const [detail, setDetail] = useState(null);
  const [activeCurrency, setActiveCurrency] = useState('KRW');
  const [activeTab, setActiveTab] = useState('history');
  const [form, setForm] = useState(emptyForm('DEPOSIT', 'KRW'));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingRates, setSyncingRates] = useState(false);
  const [rateMessage, setRateMessage] = useState('');
  const [error, setError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!account?.accountId) return;
    try {
      setLoading(true);
      setError('');
      setDetail(await getForeignAccountDetail(account.accountId));
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || '외화 통장 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [account?.accountId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const currentAccount = detail?.account || account;
  const currency = activeCurrency;
  const meta = currencyMeta[currency] || currencyMeta.USD;
  const wallets = detail?.wallets || [];
  const activeWallet = wallets.find((wallet) => wallet.currency === currency) || {};
  const summary = {
    ...activeWallet,
    foreignBalance: activeWallet.balance,
    rateProvider: detail?.summary?.rateProvider,
    rateUpdatedAt: detail?.summary?.rateUpdatedAt,
  };
  const transactions = (detail?.transactions || []).filter((item) => item.currency === currency);
  const monthly = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return transactions.reduce((result, item) => {
      if (!item.transactionDate.startsWith(month)) return result;
      if (item.transactionType === 'DEPOSIT') result.deposits += Number(item.amount || 0);
      else result.withdrawals += Number(item.amount || 0);
      result.realizedExchangeProfit += Number(item.realizedExchangeProfit || 0);
      return result;
    }, { deposits: 0, withdrawals: 0, realizedExchangeProfit: 0 });
  }, [transactions]);
  const totalValuationKrw = wallets.reduce((sum, wallet) => sum + Number(wallet.valuationKrw || 0), 0);
  const totalAcquisitionCostKrw = wallets.reduce((sum, wallet) => sum + Number(wallet.acquisitionCostKrw || 0), 0);
  const totalUnrealizedProfit = wallets.reduce((sum, wallet) => sum + Number(wallet.unrealizedExchangeProfit || 0), 0);

  const quoteMap = useMemo(() => Object.fromEntries(
    (detail?.rates || []).map((quote) => [`${quote.baseCurrency}/${quote.quoteCurrency}`, quote]),
  ), [detail?.rates]);

  const getCurrentPairRate = useCallback((baseCurrency, quoteCurrency) => {
    if (baseCurrency === quoteCurrency) return 1;
    const direct = quoteMap[`${baseCurrency}/${quoteCurrency}`];
    if (direct?.rate) return Number(direct.rate);
    const inverse = quoteMap[`${quoteCurrency}/${baseCurrency}`];
    if (inverse?.rate) return 1 / Number(inverse.rate);
    const baseToKrw = baseCurrency === 'KRW' ? 1 : Number(quoteMap[`${baseCurrency}/KRW`]?.rate || 0);
    const quoteToKrw = quoteCurrency === 'KRW' ? 1 : Number(quoteMap[`${quoteCurrency}/KRW`]?.rate || 0);
    return baseToKrw && quoteToKrw ? baseToKrw / quoteToKrw : null;
  }, [quoteMap]);

  const calculatedKrwRate = useMemo(() => {
    if (form.currency === 'KRW') return 1;
    const enteredRate = Number(form.exchangeRate || 0);
    if (!enteredRate) return null;
    if (form.exchangeRateCurrency === 'KRW') return enteredRate;
    const quoteToKrw = getCurrentPairRate(form.exchangeRateCurrency, 'KRW');
    return quoteToKrw ? enteredRate * quoteToKrw : null;
  }, [form.currency, form.exchangeRate, form.exchangeRateCurrency, getCurrentPairRate]);

  const resetForm = (type = 'DEPOSIT', targetCurrency = currency) => {
    setEditingId(null);
    setForm(emptyForm(type, targetCurrency));
  };

  const changeType = (type) => {
    setForm((current) => ({
      ...current,
      transactionType: type,
      purpose: PURPOSES[type][0][0],
      exchangeRate: '',
      krwExchangeRate: '',
    }));
  };

  const useCurrentRate = () => {
    const currentRate = getCurrentPairRate(form.currency, form.exchangeRateCurrency);
    if (!currentRate) {
      setError('선택한 통화 조합의 환율이 없습니다. 주요 환율을 먼저 동기화해 주세요.');
      return;
    }
    setError('');
    setForm((current) => ({ ...current, exchangeRate: String(currentRate) }));
  };

  const handleRateSync = async () => {
    try {
      setSyncingRates(true);
      setError('');
      setRateMessage('');
      const synced = await syncForeignExchangeRates(account.accountId);
      setDetail(synced);
      setRateMessage('주요 환율을 최신 값으로 동기화했습니다.');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'KIS 환율을 동기화하지 못했습니다.');
    } finally {
      setSyncingRates(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !Number(form.amount)) {
      setError('거래명과 외화 금액을 입력해 주세요.');
      return;
    }
    if (form.currency !== 'KRW' && form.transactionType === 'DEPOSIT' && !Number(form.exchangeRate)) {
      setError('입금 외화의 취득환율을 입력해 주세요.');
      return;
    }
    if (form.currency !== 'KRW' && form.exchangeRateCurrency !== 'KRW'
        && Number(form.exchangeRate) && !calculatedKrwRate) {
      setError('원화 환산에 필요한 주요 환율이 없습니다. 환율 동기화 후 다시 입력해 주세요.');
      return;
    }
    const payload = {
      ...form,
      title: form.title.trim(),
      amount: Number(form.amount),
      exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
      exchangeRateCurrency: form.currency === 'KRW' ? 'KRW' : form.exchangeRateCurrency,
      krwExchangeRate: calculatedKrwRate,
      feeKrw: Number(form.feeKrw || 0),
      transactionDate: `${form.transactionDate}:00`,
      memo: form.memo.trim() || null,
    };
    try {
      setSaving(true);
      setError('');
      if (editingId) await updateForeignTransaction(account.accountId, editingId, payload);
      else await createForeignTransaction(account.accountId, payload);
      resetForm(form.transactionType);
      setActiveTab('history');
      await loadDetail();
      await onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.message || '외화 거래를 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item) => {
    setEditingId(item.transactionId);
    setForm({
      transactionType: item.transactionType,
      currency: item.currency,
      purpose: item.purpose,
      title: item.title,
      amount: String(item.amount),
      exchangeRate: item.exchangeRate ? String(item.exchangeRate) : '',
      exchangeRateCurrency: item.exchangeRateCurrency || 'KRW',
      krwExchangeRate: item.krwExchangeRate ? String(item.krwExchangeRate) : '',
      feeKrw: String(item.feeKrw || 0),
      transactionDate: item.transactionDate.slice(0, 16),
      memo: item.memo || '',
    });
    setActiveTab('entry');
  };

  const handleDelete = async (transactionId) => {
    if (!window.confirm('이 외화 거래를 삭제할까요? 잔액과 환차익도 다시 계산됩니다.')) return;
    try {
      setError('');
      await deleteForeignTransaction(account.accountId, transactionId);
      await loadDetail();
      await onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.message || '외화 거래를 삭제하지 못했습니다.');
    }
  };

  const rateDifference = summary.currentExchangeRate && summary.averageAcquisitionRate
    ? Number(summary.currentExchangeRate) - Number(summary.averageAcquisitionRate)
    : null;

  if (loading && !detail) {
    return <div className="foreign-account-loading">외화 잔액과 환율을 계산하고 있습니다.</div>;
  }

  return (
    <div className="ledger-account-detail ledger-account-detail--foreign foreign-account-page">
      <header className="foreign-account-header">
        <div>
          <button type="button" className="investment-back-btn" onClick={onBackToDashboard}>← 대시보드로</button>
          <div className="investment-title-row">
            <h1>외화 통장 상세</h1>
            <span>{currency}</span>
          </div>
          <p>{meta.name} 잔액과 취득원가, 환차익을 한 화면에서 관리합니다.</p>
        </div>
        <div className="investment-page-actions">
          <button type="button" onClick={() => onEditClick?.(currentAccount)}>계좌 수정</button>
          <button type="button" className="is-primary" onClick={() => { resetForm('DEPOSIT'); setActiveTab('entry'); }}>
            + 외화 입출금
          </button>
        </div>
      </header>

      {error && <div className="foreign-account-error">{error}</div>}

      <div className="foreign-wallet-tabs" role="tablist" aria-label="통화 지갑 선택">
        {['KRW', 'USD', 'JPY'].map((walletCurrency) => {
          const wallet = wallets.find((item) => item.currency === walletCurrency) || {};
          return (
            <button
              key={walletCurrency}
              type="button"
              role="tab"
              aria-selected={currency === walletCurrency}
              className={currency === walletCurrency ? 'is-active' : ''}
              onClick={() => { setActiveCurrency(walletCurrency); resetForm('DEPOSIT', walletCurrency); setActiveTab('history'); }}
            >
              <span>{currencyMeta[walletCurrency].name}</span>
              <strong>{formatForeign(wallet.balance, walletCurrency)}</strong>
            </button>
          );
        })}
        <div><span>통합 원화 평가액</span><strong>{formatKrw(totalValuationKrw)}</strong></div>
      </div>

      <section className="foreign-summary-card">
        <AccountIdentityCard
          variant="foreign"
          mark={meta.mark}
          status={currency === 'KRW' ? '원화 지갑' : summary.currentExchangeRate ? 'KIS 환율 반영' : '환율 입력 대기'}
          statusTone={currency === 'KRW' || summary.currentExchangeRate ? 'success' : 'warning'}
          eyebrow="외화 통장"
          accountName={currentAccount?.accountName}
          bankName={currentAccount?.bankName}
          accountNumber={currentAccount?.accountNumberMasked}
          tags={[{ label: meta.name }, { label: currentAccount?.accountPurpose === 'FOREIGN_LIVING' ? '해외 생활비' : '외화 예금', tone: 'blue' }]}
          footerLabel="선택 지갑 잔액"
          footerValue={formatForeign(summary.foreignBalance, currency)}
          footerBadge={currency}
        />

        <div className="foreign-summary-content">
          <div className="foreign-metric-grid">
            <div className="foreign-metric is-primary"><span>통합 원화 평가액</span><strong>{formatKrw(totalValuationKrw)}</strong></div>
            <div className="foreign-metric"><span>통합 취득원가</span><strong>{formatKrw(totalAcquisitionCostKrw)}</strong></div>
            <div className="foreign-metric"><span>통합 미실현 환차익</span><strong className={totalUnrealizedProfit >= 0 ? 'is-positive' : 'is-negative'}>{formatKrw(totalUnrealizedProfit, true)}</strong></div>
            <div className="foreign-metric"><span>평균 취득환율</span><strong>{formatRate(summary.averageAcquisitionRate, currency)}</strong></div>
            <div className="foreign-metric"><span>현재 기준환율</span><strong>{formatRate(summary.currentExchangeRate, currency)}</strong></div>
            <div className="foreign-metric"><span>환율 수익률</span><strong className={Number(summary.unrealizedReturnRate) >= 0 ? 'is-positive' : 'is-negative'}>{summary.unrealizedReturnRate == null ? '-' : `${Number(summary.unrealizedReturnRate) > 0 ? '+' : ''}${formatNumber(summary.unrealizedReturnRate, 2)}%`}</strong></div>
          </div>
          <div className="foreign-summary-insight">
            <span>평균환율 대비</span>
            <strong className={(rateDifference || 0) >= 0 ? 'is-positive' : 'is-negative'}>
              {rateDifference == null ? '-' : `${rateDifference > 0 ? '+' : ''}${currency === 'JPY' ? formatNumber(rateDifference * 100, 2) : formatNumber(rateDifference, 2)}원`}
            </strong>
            <p>{rateDifference == null ? '환율을 불러오면 보유 외화의 평가 차이를 보여드립니다.' : rateDifference >= 0 ? '현재 환율이 평균 취득환율보다 높습니다.' : '현재 환율이 평균 취득환율보다 낮습니다.'}</p>
            <div className="foreign-summary-insight__bar"><i style={{ width: `${Math.min(100, Math.max(8, 50 + (Number(summary.unrealizedReturnRate) || 0) * 2))}%` }} /></div>
          </div>
        </div>
      </section>

      <div className="foreign-main-grid">
        <section className="investment-card foreign-activity-card">
          <div className="investment-tabbed-card-header foreign-card-tab-header">
            <div className="investment-card-tabs">
              <button type="button" className={activeTab === 'history' ? 'is-active' : ''} onClick={() => setActiveTab('history')}>
                거래 내역 <em>{transactions.length}</em>
              </button>
              <button type="button" className={activeTab === 'entry' ? 'is-active' : ''} onClick={() => setActiveTab('entry')}>
                외화 입출금
              </button>
            </div>
            <span>{activeTab === 'history' ? '입출금과 취득환율을 함께 확인합니다.' : '환전이 아닌 외화 이동도 구분해 기록할 수 있습니다.'}</span>
          </div>

          {activeTab === 'history' ? (
            <div className="foreign-table-wrap">
              <table className="foreign-transaction-table">
                <thead><tr><th>날짜</th><th>구분</th><th>거래명</th><th>외화 금액</th><th>적용 환율</th><th>원화 금액</th><th>실현 환차익</th><th>관리</th></tr></thead>
                <tbody>
                  {transactions.length === 0 && <tr><td colSpan="8" className="foreign-empty">아직 등록된 외화 거래가 없습니다.</td></tr>}
                  {transactions.map((item) => (
                    <tr key={item.transactionId}>
                      <td>{new Date(item.transactionDate).toLocaleDateString('ko-KR')}</td>
                      <td><span className={`foreign-type-badge is-${item.transactionType.toLowerCase()}`}>{item.transactionType === 'DEPOSIT' ? '입금' : '출금'}</span></td>
                      <td><strong>{item.title}</strong><small>{purposeLabel(item.transactionType, item.purpose)}{item.memo ? ` · ${item.memo}` : ''}</small></td>
                      <td className={item.transactionType === 'DEPOSIT' ? 'is-positive' : 'is-negative'}>{item.transactionType === 'DEPOSIT' ? '+' : '-'}{formatForeign(item.amount, currency)}</td>
                      <td>
                        {formatQuotedRate(item.exchangeRate, item.currency, item.exchangeRateCurrency)}
                        {item.currency !== 'KRW' && item.krwExchangeRate && item.exchangeRateCurrency !== 'KRW'
                          ? <small>원화 환산 {formatRate(item.krwExchangeRate, item.currency)}</small> : null}
                      </td>
                      <td>{formatKrw(item.krwAmount)}</td>
                      <td className={Number(item.realizedExchangeProfit) >= 0 ? 'is-positive' : 'is-negative'}>{formatKrw(item.realizedExchangeProfit, true)}</td>
                      <td><button type="button" onClick={() => handleEdit(item)}>수정</button><button type="button" className="is-delete" onClick={() => handleDelete(item.transactionId)}>삭제</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <form className="foreign-entry-form" onSubmit={handleSubmit}>
              <div className="foreign-entry-currency">
                {['KRW', 'USD', 'JPY'].map((item) => <button
                  key={item}
                  type="button"
                  className={form.currency === item ? 'is-active' : ''}
                  onClick={() => setForm({
                    ...form,
                    currency: item,
                    exchangeRate: item === 'KRW' ? '' : form.exchangeRate,
                    exchangeRateCurrency: item === 'KRW' || form.exchangeRateCurrency === item ? 'KRW' : form.exchangeRateCurrency,
                    krwExchangeRate: '',
                  })}
                >{currencyMeta[item].name}</button>)}
              </div>
              <div className="foreign-entry-type">
                <button type="button" className={form.transactionType === 'DEPOSIT' ? 'is-active' : ''} onClick={() => changeType('DEPOSIT')}>외화 입금</button>
                <button type="button" className={form.transactionType === 'WITHDRAWAL' ? 'is-active' : ''} onClick={() => changeType('WITHDRAWAL')}>외화 출금</button>
              </div>
              <div className="foreign-form-grid">
                <label><span>거래 유형</span><select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>{PURPOSES[form.transactionType].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label><span>거래명 *</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 여행 경비 환전" /></label>
                <label><span>금액 ({form.currency}) *</span><input type="number" min="0" step="0.0001" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></label>
                {form.currency !== 'KRW' && <label>
                  <span>{form.transactionType === 'DEPOSIT' ? '취득환율 *' : '환전·처분 환율 (선택)'}</span>
                  <div className="foreign-rate-currency">
                    <select
                      aria-label="취득환율 기준 통화"
                      value={form.exchangeRateCurrency}
                      onChange={(e) => setForm({ ...form, exchangeRateCurrency: e.target.value, exchangeRate: '', krwExchangeRate: '' })}
                    >
                      {['KRW', 'USD', 'JPY'].filter((item) => item !== form.currency).map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <div className="foreign-rate-input"><input type="number" min="0" step="0.00000001" value={form.exchangeRate} onChange={(e) => setForm({ ...form, exchangeRate: e.target.value, krwExchangeRate: '' })} placeholder={`1 ${form.currency}당 ${form.exchangeRateCurrency}`} /><button type="button" onClick={useCurrentRate}>현재 환율</button></div>
                  </div>
                  {calculatedKrwRate && <small className="foreign-converted-rate">원화 환산 취득환율: {formatRate(calculatedKrwRate, form.currency)}</small>}
                </label>}
                <label><span>원화 수수료</span><input type="number" min="0" step="1" value={form.feeKrw} onChange={(e) => setForm({ ...form, feeKrw: e.target.value })} /></label>
                <label><span>거래 일시 *</span><input type="datetime-local" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} /></label>
                <label className="is-full"><span>메모</span><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="송금처, 환전 목적 등 필요한 내용을 기록하세요." /></label>
              </div>
              <div className="foreign-entry-note">
                {form.currency === 'KRW' ? '원화 지갑 입출금은 환율 없이 실제 원화 금액 그대로 기록됩니다.' : form.transactionType === 'DEPOSIT'
                  ? '환전 입금이 아니더라도 정확한 환차익 계산을 위해 입금 시점의 취득환율을 기록합니다.'
                  : '환전 출금이면 실제 적용환율을 입력해 실현 환차익을 계산하고, 단순 송금·사용이면 비워둘 수 있습니다.'}
              </div>
              <div className="foreign-form-actions"><button type="button" onClick={() => { resetForm(); setActiveTab('history'); }}>취소</button><button type="submit" className="is-primary" disabled={saving}>{saving ? '저장 중...' : editingId ? '거래 수정' : '거래 저장'}</button></div>
            </form>
          )}
        </section>

        <aside className="foreign-side-stack">
          <section className="investment-card foreign-rate-card">
            <div className="investment-card__header foreign-rate-card__header">
              <div><h2>주요 환율</h2><span>KIS 기준</span></div>
              <button type="button" onClick={handleRateSync} disabled={syncingRates}>
                {syncingRates ? '동기화 중...' : '환율 동기화'}
              </button>
            </div>
            {rateMessage && <p className="foreign-rate-message">{rateMessage}</p>}
            {[
              ['USD/KRW', '달러 / 원', false],
              ['JPY/KRW', '100엔 / 원', true],
              ['USD/JPY', '달러 / 엔', false],
            ].map(([key, label, perHundred]) => {
              const quote = quoteMap[key];
              const rate = quote ? Number(quote.rate) * (perHundred ? 100 : 1) : null;
              const change = quote ? Number(quote.change) * (perHundred ? 100 : 1) : null;
              return <div className="foreign-rate-row" key={key}><div><span>{label}</span><small>{key}</small></div><div><strong>{rate == null ? '-' : formatNumber(rate, 2)}</strong><em className={(change || 0) >= 0 ? 'is-positive' : 'is-negative'}>{change == null ? '시세 없음' : `${change > 0 ? '+' : ''}${formatNumber(change, 2)} · ${formatNumber(quote.changePercent, 2)}%`}</em></div></div>;
            })}
          </section>

          <section className="investment-card foreign-flow-card">
            <div className="investment-card__header"><h2>이번 달 외화 흐름</h2><span>{currency}</span></div>
            <div className="foreign-flow-grid">
              <div><span>입금</span><strong className="is-positive">+{formatForeign(monthly.deposits, currency)}</strong></div>
              <div><span>출금</span><strong className="is-negative">-{formatForeign(monthly.withdrawals, currency)}</strong></div>
              <div><span>실현 환차익</span><strong className={Number(monthly.realizedExchangeProfit) >= 0 ? 'is-positive' : 'is-negative'}>{formatKrw(monthly.realizedExchangeProfit, true)}</strong></div>
              <div><span>원가 기록</span><strong>{summary.costBasisComplete ? '정상' : '보완 필요'}</strong></div>
            </div>
            {!summary.costBasisComplete && <p className="foreign-cost-warning">초기 잔액의 취득환율을 계좌 수정에서 입력하면 전체 환차익이 정확해집니다.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
