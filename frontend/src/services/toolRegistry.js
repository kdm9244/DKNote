/**
 * 🧰 미카 AI 통합 도구 및 실시간 팩트 데이터(Grounding) 레지스트리
 */

import api from '../api/client';
import { getAccounts, getLedgerDashboard } from '../api/ledger';

/**
 * 전 종목 실시간 시세 조회 (Spring Boot AI 프록시를 통한 무제한 CORS-free 조회)
 */
async function fetchStockQuote(query) {
  if (!query || !query.trim()) return null;
  const cleanQuery = query.trim();

  // 1. Spring Boot 백엔드 프록시를 통한 실시간 시세 조회
  try {
    const res = await api.get('/api/ai/stock-quote', { params: { query: cleanQuery } });
    if (res.data && res.data.price > 0) {
      return res.data;
    }
  } catch {
    // 2. KIS 로컬 계좌 검색 폴백
    try {
      const accs = await getAccounts();
      const invAcc = (accs.accounts || []).find((a) => a.accountType === 'INVESTMENT');
      if (invAcc) {
        const searchRes = await api.get(`/api/ledger/investment-accounts/${invAcc.accountId}/symbols/search`, {
          params: { query: cleanQuery, market: 'ALL' },
        });
        if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const matched = searchRes.data[0];
          const curPrice = Number(matched.currentPrice || matched.openingPrice || 0);
          if (curPrice > 0) {
            return {
              name: matched.symbolName || cleanQuery,
              ticker: matched.tickerCode || cleanQuery,
              market: matched.market || 'KRX',
              price: curPrice,
              currency: matched.currency || 'KRW',
              source: 'KIS/거래소',
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * 🧰 도구 정의 목록
 */
const TOOLS = [
  // 1. 실시간 주식 시세 조회
  {
    name: 'get_stock_market_price',
    matchIntent: (msg) => /(주식|주가|시세|1주|현재가|삼전|삼성전자|하이닉스|테슬라|엔비디아|애플|루닛|TSLA|NVDA|AAPL|\b\d{6}\b)/i.test(msg),
    getGroundingFacts: async (msg) => {
      const cleanMsg = msg.replace(/[^\w가-힣\s]/g, ' ');
      const ignoreWords = new Set([
        '얼마', '현재', '1주', '주가', '시세', '얼마야', '어때', '미카', '알려줘', '확인',
        '확인해', '확인해줘', '해줘', '지금', '주식', '현재가', '현재가는', '현재가가', '알아봐', '알아봐줘', '말해줘'
      ]);
      const words = cleanMsg
        .split(/\s+/)
        .map((w) => w.replace(/(은|는|이|가|의|에|을|를|도|으로|로)$/, '').trim())
        .filter((w) => w.length >= 2 && !ignoreWords.has(w));

      const quotes = [];
      for (const w of words) {
        const q = await fetchStockQuote(w);
        if (q) quotes.push(q);
      }
      if (quotes.length === 0) {
        const directQuery = cleanMsg
          .replace(/(현재가|현재가는|현재가가|얼마야|얼마인지|얼마|알려줘|주가|시세|주식|가격|현재|지금)/g, '')
          .replace(/(은|는|이|가|의|에|을|를|도|으로|로)$/, '')
          .trim();
        if (directQuery) {
          const direct = await fetchStockQuote(directQuery);
          if (direct) quotes.push(direct);
        }
      }

      if (quotes.length > 0) {
        const unique = Array.from(new Map(quotes.map((q) => [q.ticker, q])).values());
        const stockInfo = unique
          .map((s) => `- ${s.name} (${s.ticker}, ${s.market}): 실시간 현재가 ${s.currency === 'USD' ? '$' : '₩'}${Number(s.price).toLocaleString()} ${s.currency}${s.changeRate !== undefined ? ` (전일 대비 ${s.changeRate > 0 ? '+' : ''}${s.changeRate.toFixed(2)}%)` : ''}`)
          .join('\n');
        return `[실시간 주가 시세 (확인됨)]:\n${stockInfo}`;
      }
      return null;
    },
  },

  // 2. 가계부 및 총자산 현황 조회
  {
    name: 'get_financial_summary',
    matchIntent: (msg) => /(총자산|자산|현금|순자산|얼마|수익|손익|포트폴리오|재정|통장|잔액|잔고|가계부|지출|수입)/i.test(msg),
    getGroundingFacts: async () => {
      try {
        const [dash, accData] = await Promise.allSettled([getLedgerDashboard(), getAccounts()]);
        const ledger = dash.status === 'fulfilled' ? dash.value : null;
        const accounts = accData.status === 'fulfilled' ? accData.value.accounts || [] : [];

        if (!ledger && accounts.length === 0) return null;

        // 실시간 엔화 환율 조회 (외화 원화 환산용)
        let jpyRate = 8.63;
        try {
          const fxRes = await api.get('/api/ai/exchange-rate?base=JPY&quote=KRW');
          const rate = Number(fxRes.data?.rate || 863);
          jpyRate = rate < 50 ? rate : rate / 100;
        } catch {
          jpyRate = 8.63;
        }

        let totalCashKrw = 0;
        const accDetails = accounts.map((a) => {
          const bal = Number(a.cachedBookBalance ?? a.balance ?? 0);
          const curr = a.currency || 'KRW';
          if (curr === 'JPY') {
            const krwVal = Math.round(bal * jpyRate);
            totalCashKrw += krwVal;
            return `${a.accountName}: ¥${bal.toLocaleString()}엔 (원화 환산 약 ₩${krwVal.toLocaleString()}원)`;
          } else if (curr === 'USD') {
            const krwVal = Math.round(bal * 1350);
            totalCashKrw += krwVal;
            return `${a.accountName}: $${bal.toLocaleString()}달러 (원화 환산 약 ₩${krwVal.toLocaleString()}원)`;
          } else {
            totalCashKrw += bal;
            return `${a.accountName}: ₩${bal.toLocaleString()}원`;
          }
        });

        const investmentVal = Number(ledger?.investment?.totals?.find((item) => item.currency === 'KRW')?.marketValue || 0);
        const totalNetWorth = totalCashKrw + investmentVal;
        const monthIncome = Number(ledger?.monthlyIncome?.KRW || 0);
        const monthExpense = Number(ledger?.monthlyExpense?.KRW || 0);
        const monthNet = Number(ledger?.monthlyNetCashFlow?.KRW || (monthIncome - monthExpense));

        const holdings = (ledger?.investment?.holdings || [])
          .filter((h) => Number(h.quantity || 0) > 0 && h.tickerCode !== 'CASH')
          .map((h) => `${h.symbolName}(${h.quantity}주, 평가금액: ₩${Number(h.marketValue || 0).toLocaleString()})`)
          .join(', ');

        let result = `[실제 DB 계좌 및 자산 현황 (확인됨)]:\n` +
          `- 총 순자산(원화 환산 합계): ₩${totalNetWorth.toLocaleString()}원 (현금/예금: ₩${totalCashKrw.toLocaleString()}원, 투자: ₩${investmentVal.toLocaleString()}원)\n` +
          `- 보유 계좌별 실제 잔액:\n${accDetails.map((d) => `  • ${d}`).join('\n')}\n` +
          `- 이번 달 수입: ₩${monthIncome.toLocaleString()}원, 이번 달 지출: ₩${monthExpense.toLocaleString()}원 (당월 순현금흐름: ${monthNet >= 0 ? '+' : ''}₩${monthNet.toLocaleString()}원)`;

        if (holdings) {
          result += `\n- 보유 주식 종목: ${holdings}`;
        }
        return result;
      } catch {
        return null;
      }
    },
  },

  // 3. 여행 일정 및 D-Day 조회
  {
    name: 'get_trip_schedules',
    matchIntent: (msg) => /(여행|일정|디데이|dday|d-day|비행기|숙소|언제 가|어디 가|계획)/i.test(msg),
    getGroundingFacts: async () => {
      try {
        const tripsRes = await api.get('/api/travel/trips');
        const allTrips = tripsRes.data || [];

        if (!allTrips.length) return '[등록된 여행 계획]: 현재 등록된 여행 계획이 없습니다.';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tripSummaries = allTrips.map((t) => {
          let ddayStr = '날짜 미정';
          if (t.startDate) {
            const start = new Date(t.startDate);
            start.setHours(0, 0, 0, 0);
            const diff = Math.round((start - today) / 86400000);
            ddayStr = diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
          }
          return `- ${t.title || '여행'} (${t.startDate || '미정'} ~ ${t.endDate || '미정'}, ${ddayStr})`;
        });

        return `[등록된 여행 일정 현황]:\n${tripSummaries.join('\n')}`;
      } catch {
        return null;
      }
    },
  },

  // 4. 최근 거래 내역 조회
  {
    name: 'get_recent_transactions',
    matchIntent: (msg) => /(최근|어제|오늘|쓴|썼어|거래|내역|얼마 썼|결제)/i.test(msg),
    getGroundingFacts: async () => {
      try {
        const ledger = await getLedgerDashboard();
        const txs = (ledger?.recentTransactions || []).slice(0, 5);
        if (!txs.length) return null;

        const lines = txs.map(
          (t) => `- [${(t.transactionDate || '').slice(0, 10)}] ${t.title || '거래'}: ${t.transactionType === 'INCOME' ? '+' : '-'}₩${Number(t.amount || 0).toLocaleString()} (${t.accountName || ''})`
        );
        return `[최근 가계부 거래 내역]:\n${lines.join('\n')}`;
      } catch {
        return null;
      }
    },
  },
];


export const toolRegistry = {
  /**
   * 재정/숫자 관련 질의인지 감지 (낮은 temperature 0.35 적용용)
   */
  isFinancialQuery(userMsg) {
    return /(주식|주가|시세|현재가|원|달러|자산|수익|손익|배당|지출|수입|가계부|얼마|예산|환율|통장|잔액)/i.test(userMsg || '');
  },

  /**
   * 사용자 메시지에서 관련된 도구들의 실시간 팩트 데이터를 모아 Grounding Context 생성
   */
  async resolveGroundingContext(userMsg) {
    const todayStr = new Date().toISOString().substring(0, 10);
    const facts = [`[현재 시스템 기준 일시: ${todayStr}]`];

    for (const tool of TOOLS) {
      if (tool.matchIntent && tool.matchIntent(userMsg) && tool.getGroundingFacts) {
        try {
          const fact = await tool.getGroundingFacts(userMsg);
          if (fact) facts.push(fact);
        } catch (e) {
          console.warn(`팩트 데이터 추출 실패 (${tool.name}):`, e);
        }
      }
    }

    if (facts.length > 1) {
      return `【실시간 팩트 데이터 (Grounding Context)】\n${facts.join('\n\n')}\n\n[지침] 위 실제 수치와 일정을 반드시 바탕으로 답변하며, 모르는 숫자는 지어내지 않는다.`;
    }
    return null;
  },


};
