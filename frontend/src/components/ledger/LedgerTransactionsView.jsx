import React, { useEffect, useMemo, useState } from 'react';
import { getTransactionsByUser } from '../../api/ledger';
import { getInvestmentActivities } from '../../api/investment';

const symbols = { KRW: '₩', USD: '$', JPY: '¥' };
const money = (value, currency = 'KRW', signed = false) => {
  const amount = Number(value || 0);
  const prefix = amount < 0 ? '-' : signed && amount > 0 ? '+' : '';
  return `${prefix}${symbols[currency] || currency} ${Math.abs(amount).toLocaleString('ko-KR', { maximumFractionDigits: currency === 'KRW' ? 0 : 2 })}`;
};
const currentMonth = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const PAGE_SIZE = 10;
const TRADE_META = {
  BUY: { label: '매수', className: 'is-investment-buy' },
  SELL: { label: '매도', className: 'is-investment-sell' },
  DIVIDEND: { label: '배당', className: 'is-investment-dividend' },
  DEPOSIT: { label: '예수금 입금', className: 'is-investment-cash' },
  WITHDRAWAL: { label: '예수금 출금', className: 'is-investment-cash' },
};
const nextMonth = (month) => {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
};

export default function LedgerTransactionsView({ accounts = [], onSelectAccount, initialType = 'ALL' }) {
  const [transactions, setTransactions] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [accountId, setAccountId] = useState('ALL');
  const [type, setType] = useState(initialType);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [investmentError, setInvestmentError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getTransactionsByUser()
      .then(async (ledgerResult) => {
        if (!alive) return;
        const ledgerItems = Array.isArray(ledgerResult) ? ledgerResult : [];
        let investmentResult = [];
        try {
          investmentResult = await getInvestmentActivities({ from: `${month}-01`, to: nextMonth(month) });
          if (alive) setInvestmentError('');
        } catch (requestError) {
          if (alive) setInvestmentError(requestError.response?.data?.message || '투자 거래 내역을 불러오지 못했습니다.');
        }
        if (!alive) return;
        const ledgerTransactionIds = new Set(ledgerItems.map((item) => item.transactionId));
        const investmentItems = (Array.isArray(investmentResult) ? investmentResult : [])
          .filter((item) => !item.ledgerTransactionId || !ledgerTransactionIds.has(item.ledgerTransactionId))
          .map((item) => {
            const trade = TRADE_META[item.tradeType] || { label: item.tradeType || '투자' };
            const details = [];
            if (['BUY', 'SELL'].includes(item.tradeType)) {
              details.push(`${Number(item.quantity || 0).toLocaleString('ko-KR')}주`);
              details.push(`단가 ${money(item.unitPrice, item.quoteCurrency)}`);
            }
            const cost = Number(item.feeAmount || 0) + Number(item.taxAmount || 0);
            if (cost) details.push(`비용 ${money(cost, item.quoteCurrency)}`);
            if (item.memo) details.push(item.memo);
            return {
              transactionId: `investment-${item.investmentTransactionId}`,
              accountId: item.accountId,
              transactionDate: item.tradeDate,
              transactionType: 'INVESTMENT',
              activityKind: 'INVESTMENT',
              tradeType: item.tradeType,
              title: item.symbolName || '예수금',
              tickerCode: item.tickerCode,
              categoryId: `투자 · ${trade.label}`,
              amount: Number(item.netAmount || 0),
              currency: item.accountCurrency || 'KRW',
              memo: details.join(' · '),
            };
          });
        setTransactions([...ledgerItems, ...investmentItems].sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate)));
        setError('');
      })
      .catch((requestError) => { if (alive) setError(requestError.response?.data?.message || '가계부 거래를 불러오지 못했습니다.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accounts, month]);

  const accountMap = useMemo(() => new Map(accounts.map((account) => [account.accountId, account])), [accounts]);
  const filtered = useMemo(() => transactions.filter((item) => {
    const date = new Date(item.transactionDate);
    const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (itemMonth !== month) return false;
    if (accountId !== 'ALL' && item.accountId !== accountId) return false;
    const account = accountMap.get(item.accountId);
    if (type === 'INVESTMENT') {
      if (account?.accountType !== 'INVESTMENT') return false;
    } else if (type === 'DEBT') {
      if (account?.accountType !== 'DEBT') return false;
    } else {
      if (accountId === 'ALL' && item.transactionType === 'TRANSFER' && item.transferDirection === 'IN') return false;
      if (item.activityKind === 'INVESTMENT' && type !== 'ALL') return false;
      if (type !== 'ALL' && item.transactionType !== type) return false;
    }
    const keyword = query.trim().toLowerCase();
    if (keyword && !`${item.title || ''} ${item.tickerCode || ''} ${item.categoryId || ''} ${item.memo || ''}`.toLowerCase().includes(keyword)) return false;
    return true;
  }), [transactions, month, accountId, type, query, accountMap]);

  const totals = useMemo(() => {
    const result = new Map();
    filtered.forEach((item) => {
      const current = result.get(item.currency) || { currency: item.currency, income: 0, expense: 0, transfer: 0 };
      if (item.transactionType === 'INCOME') current.income += Number(item.amount || 0);
      else if (item.transactionType === 'EXPENSE') current.expense += Number(item.amount || 0);
      else if (item.transactionType === 'TRANSFER') current.transfer += Number(item.amount || 0);
      result.set(item.currency, current);
    });
    return Array.from(result.values()).map((item) => ({ ...item, net: item.income - item.expense }));
  }, [filtered]);

  const investmentTotals = useMemo(() => {
    const result = new Map();
    filtered.filter((item) => item.activityKind === 'INVESTMENT').forEach((item) => {
      const current = result.get(item.currency) || { currency: item.currency, buy: 0, sell: 0, dividend: 0 };
      if (item.tradeType === 'BUY') current.buy += Math.abs(Number(item.amount || 0));
      if (item.tradeType === 'SELL') current.sell += Math.abs(Number(item.amount || 0));
      if (item.tradeType === 'DIVIDEND') current.dividend += Math.abs(Number(item.amount || 0));
      result.set(item.currency, current);
    });
    return Array.from(result.values());
  }, [filtered]);

  const debtTotals = useMemo(() => {
    const result = new Map();
    filtered.forEach((item) => {
      const current = result.get(item.currency) || { currency: item.currency, repayment: 0, borrowing: 0 };
      const repayment = item.transactionType === 'INCOME'
        || (item.transactionType === 'TRANSFER' && item.transferDirection === 'IN');
      if (repayment) current.repayment += Math.abs(Number(item.amount || 0));
      else current.borrowing += Math.abs(Number(item.amount || 0));
      result.set(item.currency, current);
    });
    return Array.from(result.values()).map((item) => ({ ...item, net: item.borrowing - item.repayment }));
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

  useEffect(() => { setPage(1); }, [month, accountId, type, query]);
  useEffect(() => { setPage((current) => Math.min(current, totalPages)); }, [totalPages]);

  return <div className="ledger-book-page">
    <header className="ledger-book-header">
      <div><span className="ledger-eyebrow">HOUSEHOLD LEDGER</span><h1>가계부</h1><p>생활 거래와 투자·부채 변동을 월별로 모아 확인합니다.</p></div>
      <label className="ledger-book-month"><span>조회 월</span><input type="month" value={month} max={currentMonth()} onChange={(event) => event.target.value && setMonth(event.target.value)} /></label>
    </header>

    {type === 'INVESTMENT' ? <div className="ledger-book-summary">
      <div><span>매수</span>{investmentTotals.length ? investmentTotals.map((item) => <strong key={item.currency} className="is-negative">{money(item.buy, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>매도</span>{investmentTotals.length ? investmentTotals.map((item) => <strong key={item.currency} className="is-positive">{money(item.sell, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>배당</span>{investmentTotals.length ? investmentTotals.map((item) => <strong key={item.currency} className="is-positive">{money(item.dividend, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>투자 거래</span><strong>{filtered.length}건</strong><small>예수금 입출금 포함</small></div>
    </div> : type === 'DEBT' ? <div className="ledger-book-summary">
      <div><span>부채 상환</span>{debtTotals.length ? debtTotals.map((item) => <strong key={item.currency} className="is-positive">{money(item.repayment, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>추가 대출</span>{debtTotals.length ? debtTotals.map((item) => <strong key={item.currency} className="is-negative">{money(item.borrowing, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>부채 순변동</span>{debtTotals.length ? debtTotals.map((item) => <strong key={item.currency} className={item.net <= 0 ? 'is-positive' : 'is-negative'}>{money(item.net, item.currency, true)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>부채 거래</span><strong>{filtered.length}건</strong><small>상환·대출·이자 내역</small></div>
    </div> : <div className="ledger-book-summary">
      <div><span>수입</span>{totals.length ? totals.map((item) => <strong key={item.currency} className="is-positive">{money(item.income, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>지출</span>{totals.length ? totals.map((item) => <strong key={item.currency} className="is-negative">{money(item.expense, item.currency)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>순현금흐름</span>{totals.length ? totals.map((item) => <strong key={item.currency} className={item.net >= 0 ? 'is-positive' : 'is-negative'}>{money(item.net, item.currency, true)}</strong>) : <strong>기록 없음</strong>}</div>
      <div><span>거래 건수</span><strong>{filtered.length}건</strong><small>현재 필터 기준</small></div>
    </div>}

    <section className="ledger-card ledger-book-transactions">
      <div className="ledger-book-filters">
        <select aria-label="조회할 계좌" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="ALL">전체 계좌</option>{accounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountName}</option>)}</select>
        <div className="ledger-book-type-tabs">{[['ALL', '전체'], ['INCOME', '수입'], ['EXPENSE', '지출'], ['TRANSFER', '이체'], ['INVESTMENT', '투자'], ['DEBT', '부채']].map(([value, label]) => <button type="button" key={value} className={type === value ? 'is-active' : ''} onClick={() => setType(value)}>{label}</button>)}</div>
        <input aria-label="가계부 거래 검색" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 카테고리, 메모 검색" />
      </div>

      {loading && <div className="ledger-table-empty">거래 내역을 불러오고 있습니다.</div>}
      {!loading && error && <div className="ledger-dashboard-error">{error}</div>}
      {!loading && !error && type === 'INVESTMENT' && investmentError && <div className="ledger-book-inline-notice">투자 거래 일부를 불러오지 못했습니다. 백엔드를 재시작한 뒤 다시 확인해 주세요.</div>}
      {!loading && !error && <div className="ledger-table-scroll"><table className="ledger-table"><thead><tr><th>날짜</th><th>계좌</th><th>구분</th><th>제목</th><th>카테고리</th><th>금액</th><th>메모</th></tr></thead><tbody>
        {pageItems.map((item) => {
          const account = accountMap.get(item.accountId);
          const isIncome = item.transactionType === 'INCOME';
          const isTransfer = item.transactionType === 'TRANSFER';
          const isInvestment = item.activityKind === 'INVESTMENT';
          const isDebt = account?.accountType === 'DEBT';
          const transferIn = isTransfer && item.transferDirection === 'IN';
          const debtRepayment = isDebt && (isIncome || transferIn);
          const trade = TRADE_META[item.tradeType];
          const kind = isInvestment ? trade?.label || '투자' : isDebt ? debtRepayment ? '상환' : '대출' : isTransfer ? '이체' : isIncome ? '수입' : '지출';
          const kindClass = isInvestment ? trade?.className || 'is-investment-cash' : isDebt ? debtRepayment ? 'is-debt-repayment' : 'is-debt-borrowing' : isTransfer ? 'is-transfer' : isIncome ? 'is-income' : 'is-expense';
          const signedAmount = isInvestment ? Number(item.amount) : isTransfer ? transferIn ? Number(item.amount) : -Number(item.amount) : isIncome ? Number(item.amount) : -Number(item.amount);
          const amount = money(signedAmount, item.currency, true);
          return <tr key={item.transactionId} onClick={() => account && onSelectAccount(account)}><td data-label="날짜">{new Date(item.transactionDate).toLocaleDateString('ko-KR')}</td><td data-label="계좌"><strong>{account ? <button type="button" className="ledger-book-account-link" onClick={event=>{event.stopPropagation();onSelectAccount(account);}}>{account.accountName} →</button> : '삭제된 계좌'}</strong><small>{account?.bankName || ''}</small></td><td data-label="구분"><span className={`ledger-book-kind ${kindClass}`}>{kind}</span></td><td data-label="제목"><strong>{item.title}</strong>{item.tickerCode && <small>{item.tickerCode}</small>}</td><td data-label="카테고리">{item.categoryId || '기타'}</td><td data-label="금액" className={signedAmount >= 0 ? 'is-positive' : 'is-negative'}>{isTransfer ? `↔ ${amount}` : amount}</td><td data-label="메모">{item.memo || '-'}</td></tr>;
        })}
        {!filtered.length && <tr><td colSpan="7"><div className="ledger-table-empty">선택한 조건에 해당하는 거래가 없습니다.</div></td></tr>}
      </tbody></table></div>}
      {!loading && !error && filtered.length > PAGE_SIZE && <nav className="ledger-book-pagination" aria-label="가계부 페이지 이동">
        <span>총 {filtered.length}건 · {page} / {totalPages} 페이지</span>
        <div>
          <button type="button" onClick={() => setPage(1)} disabled={page === 1} aria-label="첫 페이지">«</button>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>이전</button>
          {pageNumbers.map((number) => <button type="button" key={number} className={page === number ? 'is-active' : ''} onClick={() => setPage(number)} aria-current={page === number ? 'page' : undefined}>{number}</button>)}
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>다음</button>
          <button type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="마지막 페이지">»</button>
        </div>
      </nav>}
    </section>
  </div>;
}
