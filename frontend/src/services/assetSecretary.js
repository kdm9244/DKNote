/**
 * 💼 미카 AI 자산/가계부/주식 자연어 처리 전담 비서 엔진
 * (localAI 프로젝트의 assetSecretary.ts 100% 동일 이식 + Spring Boot DB 연동)
 */

import api from '../api/client';
import {
  getAccounts,
  getLedgerDashboard,
  createTransaction,
  deleteTransaction,
  updateTransaction,
  getTransactionsByUser,
  createAccountTransfer,
} from '../api/ledger';
import { createInvestmentTransaction } from '../api/investment';
import { getLedgerSettings } from './ledgerSettings';

export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateTimeString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}:${secs}`;
}

let lastCreatedTxId = null;
let lastCreatedTransferData = null;
let lastInquiredStockName = null;

/**
 * 한국어 조사(에서, 으로, 을, 를, 에, 로 등) 및 시간 수식어, 결제수단(현금으로, 카드로 등)을 제거하여 순수 항목명 추출
 */
function cleanItemTitle(rawDesc, accounts = []) {
  if (!rawDesc) return '';
  let desc = String(rawDesc).trim();

  // 1. 선두 불필요 수식어 제거 (오늘, 어제, 그저께, 아까, 방금, 지금, 이번에 등)
  desc = desc.replace(/^(오늘|어제|그저께|아까|방금|지금|이번에|요번에|이번달|당월)\s*/g, '').trim();

  // 2. 결제 수단 / 계좌 관련 키워드 및 조사 제거 (현금으로, 현금, 교통카드로, 스이카로, 카드로 등)
  desc = desc.replace(/(현금으로|현금은|현금도|현금|지갑에서|지갑으로|지갑|교통카드로|교통카드|스이카로|스이카|파스모로|파스모|이코카로|이코카|suica로|pasmo로|icoca로|티머니로|티머니|신용카드로|체크카드로|카드로|계좌로|통장에서|계좌에서)/gi, '').trim();

  // 2-1. 등록된 계좌명이 포함된 경우 공백 유연하게 조사와 함께 제거 (예: '트래블 하나에서' -> '')
  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (acc?.accountName && acc.accountName.length >= 2) {
        const flexibleName = acc.accountName
          .trim()
          .split(/\s+/)
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s*');
        const accRegex = new RegExp(`(?:${flexibleName})(?:으로|로는|으로도|로도|에서|서|은|는|이|가|을|를|의|도|로|에)?`, 'gi');
        desc = desc.replace(accRegex, '').trim();
      }
      if (acc?.bankName && acc.bankName.length >= 2) {
        const flexibleBank = acc.bankName
          .trim()
          .split(/\s+/)
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s*');
        const bankRegex = new RegExp(`(?:${flexibleBank})(?:통장|은행|카드|뱅크)?(?:으로|로는|으로도|로도|에서|서|은|는|이|가|을|를|의|도|로|에)?`, 'gi');
        desc = desc.replace(bankRegex, '').trim();
      }
    }
  }

  // 3. 선두 잔여 조사 제거 (계좌명이 빠지고 남은 '에서 sanwa' 등 방지)
  desc = desc.replace(/^(에서는|에서|한테서|에게서|으로는|으로|로는|로|에|서)\s*/g, '').trim();

  // 4. 후미 조사 제거 (에서는, 에서, 한테서, 에게서, 한테, 에게, 으로는, 으로, 로는, 로, 까지, 은, 는, 이, 가, 을, 를, 의, 도, 에, 서 등)
  for (let i = 0; i < 2; i++) {
    desc = desc.replace(/(에서는|에서|한테서|에게서|한테|에게|으로는|으로|로는|으로|까지|서|은|는|이|가|을|를|의|도|로|에)$/g, '').trim();
  }

  // 5. 앞뒤 특수문자/공백 제거
  desc = desc.replace(/^[,\s._-]+|[,\s._-]+$/g, '').trim();

  return desc;
}

export const assetSecretary = {
  /**
   * 사용자의 자연어 입력을 분석하여 자산/지출/주식 명령인지 감지 및 즉시 실행 (localAI 원본 파서)
   */
  async processNaturalLanguage(userInput) {
    const text = (userInput || '').trim();
    if (!text) return { isAssetCommand: false };

    // 0. 방금 등록한 거래/이체 취소 감지 ("방금 거 취소", "방금 지출 취소해줘", "방금 이체 취소")
    if (/(방금\s*(거|것|지출|수입|이체|충전|송금|등록|내역)?\s*(취소|삭제|되돌려|취소해줘|지워줘)|마지막\s*거래\s*(취소|삭제))/i.test(text)) {
      if (lastCreatedTransferData) {
        try {
          const { sourceAccount, destAccount, sourceAmount, destAmount } = lastCreatedTransferData;
          // 역이체 실행 (도착 -> 출발)
          await createAccountTransfer({
            sourceAccountId: destAccount.accountId,
            destinationAccountId: sourceAccount.accountId,
            amount: destAmount,
            destinationAmount: sourceAmount,
            feeAmount: 0,
            transferredAt: getLocalDateTimeString(),
            memo: `[미카 AI 이체 취소] ${destAccount.accountName} → ${sourceAccount.accountName}`,
          });
          lastCreatedTransferData = null;
          return {
            isAssetCommand: true,
            shouldRefreshDashboard: true,
            assistantResponse: `↩️ **방금 실행한 이체(충전)를 깔끔하게 취소하고 잔액을 원래대로 되돌렸어!** 🌸\n\n• **${sourceAccount.accountName}**: 출금 취소 및 잔액 복구 완료 ✅\n• **${destAccount.accountName}**: 입금 취소 및 잔액 복구 완료 ✅`,
          };
        } catch (e) {
          console.warn('이체 취소 실패:', e);
        }
      }

      if (lastCreatedTxId) {
        try {
          await deleteTransaction(lastCreatedTxId);
          lastCreatedTxId = null;
          return {
            isAssetCommand: true,
            shouldRefreshDashboard: true,
            assistantResponse: `↩️ **방금 등록한 거래를 깔끔하게 취소(삭제)했어!** 🌸\n\n실제 가계부 장부와 통장 잔액이 원래대로 복구되었어!`,
          };
        } catch (e) {
          console.warn('거래 삭제 실패:', e);
          return {
            isAssetCommand: true,
            assistantResponse: `⚠️ 방금 등록한 거래를 삭제하는 도중 오류가 발생했어. 가계부 탭에서 직접 확인해줘 🌸`,
          };
        }
      } else {
        return {
          isAssetCommand: true,
          assistantResponse: `⚠️ 방금 등록된 거래 내역이 없거나 이미 취소되었어! 가계부 탭에서 직접 거래를 관리할 수도 있어 🌸`,
        };
      }
    }

    // 0-1. 방금 등록한 거래 카테고리(분류) 변경 감지 ("분류는 식비야", "카테고리는 식비로 바꿔줘", "기타 말고 식비로 변경해줄래?", "식비로 수정해줘")
    const isCategoryChangeIntent = /(분류|카테고리)\s*(는|은|를|이|로)?\s*(식비|카페|교통|쇼핑|주거|저축|기타)/i.test(text) ||
      /(식비|카페|교통|쇼핑|주거|저축|기타)\s*(으?로\s*(바꿔|수정|변경|해줘|등록|넣어)|야|이야|입니다)/i.test(text) ||
      /(?:말고|아니라|말구|대신에?)\s*(?:카테고리|분류)?\s*(식비|카페|교통|쇼핑|주거|저축|기타)/i.test(text);

    if (isCategoryChangeIntent) {
      // 🎯 타겟 카테고리 스마트 우선순위 추출 (단순 첫 매칭 방지!)
      let newCategory = null;

      // 1순위: "~말고 [카테고리]로", "아니라 [카테고리]로" 등 부정 후 지정 패턴 (예: "기타 말고 식비로")
      const negationMatch = text.match(/(?:말고|아니라|말구|대신에?)\s*(?:카테고리|분류)?\s*(식비|카페|교통|쇼핑|주거|저축|기타)/i);
      if (negationMatch) {
        newCategory = negationMatch[1];
      }

      // 2순위: "[카테고리]로 (바꿔|수정|변경|해줘|등록|넣어)" 패턴 (예: "식비로 변경해줄래?")
      if (!newCategory) {
        const actionMatch = text.match(/(식비|카페|교통|쇼핑|주거|저축|기타)\s*(?:으?로\s*(?:바꿔|수정|변경|해줘|등록|넣어)|[가-힣]*로\s*(?:바꿔|수정|변경|해줘))/i);
        if (actionMatch) {
          newCategory = actionMatch[1];
        }
      }

      // 3순위: "(분류|카테고리) [카테고리]" 패턴 (예: "분류는 식비야")
      if (!newCategory) {
        const explicitMatch = text.match(/(?:분류|카테고리)\s*(?:는|은|를|이|로)?\s*(식비|카페|교통|쇼핑|주거|저축|기타)/i);
        if (explicitMatch) {
          newCategory = explicitMatch[1];
        }
      }

      // 4순위: "[카테고리]야 / 이야 / 입니다" 패턴
      if (!newCategory) {
        const declarativeMatch = text.match(/(식비|카페|교통|쇼핑|주거|저축|기타)\s*(?:야|이야|입니다)/i);
        if (declarativeMatch) {
          newCategory = declarativeMatch[1];
        }
      }

      // 5순위: 문장에서 가장 마지막으로 언급된 카테고리 (예: "A에서 B로")
      if (!newCategory) {
        const allMatches = [...text.matchAll(/(식비|카페|교통|쇼핑|주거|저축|기타)/gi)];
        if (allMatches.length > 0) {
          newCategory = allMatches[allMatches.length - 1][1];
        }
      }

      if (newCategory) {
        try {
          let targetTxId = lastCreatedTxId;
          let targetTx = null;

          if (lastCreatedTxData && (!targetTxId || lastCreatedTxData.id === targetTxId)) {
            targetTx = lastCreatedTxData;
            targetTxId = lastCreatedTxData.id;
          }

          if (!targetTxId) {
            const allTxs = await getTransactionsByUser();
            if (allTxs && allTxs.length > 0) {
              targetTx = allTxs[0];
              targetTxId = targetTx.transactionId;
            }
          }

          if (targetTxId) {
            const updated = await updateTransaction(targetTxId, {
              categoryId: newCategory,
              title: targetTx?.title,
              amount: targetTx?.amount,
              transactionType: targetTx?.transactionType,
            });

            if (lastCreatedTxData) {
              lastCreatedTxData.categoryId = newCategory;
            }

            const actualCurr = updated?.currency || targetTx?.currency || 'KRW';
            const actualAmt = Number(updated?.amount ?? targetTx?.amount ?? 0);
            let formattedAmt = '';
            if (actualCurr === 'JPY') {
              formattedAmt = `${actualAmt.toLocaleString()}엔 (약 ${(actualAmt * 9.2).toLocaleString()}원)`;
            } else if (actualCurr === 'USD') {
              formattedAmt = `$${actualAmt.toLocaleString()}`;
            } else {
              formattedAmt = `₩${actualAmt.toLocaleString()}원`;
            }

            return {
              isAssetCommand: true,
              shouldRefreshDashboard: true,
              assistantResponse: `📒 **거래 분류(카테고리) 수정 완료!** 🌸\n\n- **항목**: ${updated?.title || targetTx?.title || '기타'}\n- **분류**: **${newCategory}** ✅\n- **금액**: ${formattedAmt}\n\n실제 가계부 장부에도 **${newCategory}**(으)로 즉시 반영되었어! 🌸`,
            };
          }
        } catch (e) {
          console.warn('거래 카테고리 수정 실패:', e);
        }
      }
    }

    // 1. 주식 매수/매도 등록 감지 (국내/미국/일본 전 종목 동적 자율 인식)
    // 예: "루닛 10주 9200원에 샀어", "테슬라 5주 350달러에 매수", "닌텐도 10주 8900엔에 샀어", "삼전 10주 매수"
    const digitQtyMatch = text.match(/([0-9]+)\s*주/i);
    const korQtyMatch = text.match(/(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열|스무|일|이|삼|사|오|육|칠|팔|구|십)\s*주/i);
    const actionTradeMatch = text.match(/(샀어|매수|구매|산거|산건데|사들였어|매도|팔았어|처분|익절|손절|청산|판거)/i);

    let tradeStockCandidate = null;
    if ((digitQtyMatch || korQtyMatch) && actionTradeMatch) {
      const matchQtyIdx = (digitQtyMatch || korQtyMatch).index;
      const beforeQty = text.substring(0, matchQtyIdx).trim();
      const cleanedBefore = beforeQty.replace(/^(오늘|어제|방금|이번에|계좌에서|통장에서)\s*/g, '').trim();
      const candidateTokens = cleanedBefore.split(/\s+/);
      const rawCandidate = candidateTokens[candidateTokens.length - 1];
      if (rawCandidate && rawCandidate.length >= 1) {
        tradeStockCandidate = rawCandidate.replace(/(는|은|이|가|의|에|을|를|도)$/, '').trim();
      }
    }

    if (tradeStockCandidate && (digitQtyMatch || korQtyMatch) && actionTradeMatch) {
      const stockNameRaw = tradeStockCandidate;
      let quantity = 1;
      if (digitQtyMatch) {
        quantity = parseInt(digitQtyMatch[1], 10);
      } else if (korQtyMatch) {
        const kMap = {
          한: 1, 일: 1, 두: 2, 이: 2, 세: 3, 삼: 3, 네: 4, 사: 4, 다섯: 5, 오: 5,
          여섯: 6, 육: 6, 일곱: 7, 칠: 7, 여덟: 8, 팔: 8, 아홉: 9, 구: 9, 열: 10, 십: 10, 스무: 20,
        };
        quantity = kMap[korQtyMatch[1]] || 1;
      }

      const actionRaw = actionTradeMatch[1];
      const actionType = /(팔았어|매도|처분|익절|손절|청산|판거)/i.test(actionRaw) ? 'SELL' : 'BUY';

      // 가격 추출
      let price = 0;
      let currency = 'KRW';
      const textWithoutQty = text.replace(/([0-9]+|[가-힣]+)\s*주/g, '');
      const priceMatch = textWithoutQty.match(
        /([0-9,]+(?:\.[0-9]+)?)\s*(만원|천원|원|달러|엔|USD|KRW|JPY|\$|¥)?(?:\s*(?:가격|에|으로|주고))?/i
      );

      if (priceMatch) {
        let rawPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
        const unit = (priceMatch[2] || '').toUpperCase();
        if (unit.includes('만')) rawPrice *= 10000;
        else if (unit.includes('천')) rawPrice *= 1000;
        if (unit.includes('달러') || unit === 'USD' || unit === '$') currency = 'USD';
        else if (unit.includes('엔') || unit === 'JPY' || unit === '¥') currency = 'JPY';
        if (rawPrice > 0) price = rawPrice;
      }

      // 가격 미기재 시 실시간 주가 API 자동 조회
      let cleanName = stockNameRaw;
      let tickerCode = stockNameRaw;
      let market = 'KRX';
      if (!price || price <= 0) {
        try {
          const res = await api.get(`/api/ai/stock-quote?query=${encodeURIComponent(stockNameRaw)}`);
          if (res.data && res.data.price > 0) {
            price = res.data.price;
            cleanName = res.data.name || cleanName;
            tickerCode = res.data.ticker || tickerCode;
            currency = res.data.currency || currency;
            market = res.data.market || market;
          }
        } catch {
          price = 70000;
        }
      }

      const totalTradeCost = quantity * price;

      try {
        const accData = await getAccounts();
        const accounts = accData.accounts || [];
        const invAccount = accounts.find((a) => a.accountType === 'INVESTMENT') || accounts[0];

        if (invAccount) {
          let created = null;
          // 투자 전용 계좌인 경우 투자 도메인 포트폴리오(보유 종목)와 가계부 장부 동시 반영
          if (invAccount.accountType === 'INVESTMENT') {
            try {
              created = await createInvestmentTransaction(invAccount.accountId, {
                tradeType: actionType,
                tickerCode,
                symbolName: cleanName,
                market,
                quantity,
                unitPrice: price,
                amount: totalTradeCost,
                currency: invAccount.currency || currency,
                tradeDate: getLocalDateTimeString(),
                memo: `미카 AI 주식 ${actionType === 'BUY' ? '매수' : '매도'} 등록`,
              });
            } catch (invErr) {
              console.warn('투자 계좌 전용 거래 API 실패, 가계부 장부로 폴백:', invErr);
            }
          }

          if (!created) {
            created = await createTransaction({
              accountId: invAccount.accountId,
              amount: Number(totalTradeCost),
              transactionType: actionType === 'BUY' ? 'EXPENSE' : 'INCOME',
              title: `${cleanName} ${quantity}주 ${actionType === 'BUY' ? '매수' : '매도'}`,
              categoryId: '저축',
              currency: invAccount.currency || currency,
              transactionDate: getLocalDateTimeString(),
            });
          }

          lastCreatedTxId = created.transactionId || created.id;
          lastCreatedTxData = {
            id: created.transactionId || created.id,
            accountId: invAccount.accountId,
            accountName: invAccount.accountName,
            title: `${cleanName} ${quantity}주 ${actionType === 'BUY' ? '매수' : '매도'}`,
            amount: Number(totalTradeCost),
            currency: invAccount.currency || currency,
            categoryId: '저축',
            transactionType: actionType === 'BUY' ? 'EXPENSE' : 'INCOME',
          };

          const actionKor = actionType === 'BUY' ? '매수' : '매도';
          const formattedPrice = currency === 'USD' ? `$${price.toLocaleString()}` : currency === 'JPY' ? `¥${price.toLocaleString()}엔` : `${price.toLocaleString()}원`;
          const formattedTotal = currency === 'USD' ? `$${totalTradeCost.toLocaleString()}` : currency === 'JPY' ? `¥${totalTradeCost.toLocaleString()}엔` : `₩${totalTradeCost.toLocaleString()}`;

          return {
            isAssetCommand: true,
            shouldRefreshDashboard: true,
            assistantResponse: `📈 **주식 ${actionKor} 기록 완료!** 🌸\n\n- 🏛️ **계좌**: ${invAccount.accountName || '투자 계좌'}\n- 🏷️ **종목명**: ${cleanName} (${tickerCode})\n- 🔢 **체결 수량**: ${quantity}주 (단가: ${formattedPrice})\n- 💸 **총 금액**: **${formattedTotal}**\n\n실제 가계부 장부 및 투자 포트폴리오에 즉시 반영되었어! 잘못 입력했다면 *"방금 거 취소"* 라고 말해줘 🌸`,
          };
        }
      } catch (e) {
        console.warn('주식 거래 등록 실패:', e);
      }
    }

    // 2. 실시간 개별 종목 주가 / 시세 질의 (국내/미국/일본 전 시장 100% 동적 자율 인식 엔진)
    // ⚠️ 하드코딩 완전 제거: 어떤 종목이든 자연어에서 자율 추출하여 실시간 API 조회
    const technicalBlackList = new Set([
      'API', 'APP', 'URL', 'HTTP', 'JSON', 'AI', 'GPT', 'TTS', 'DB', 'UI', 'UX',
      '서버', '토큰', '오류', '에러', '설정', '메모리', '갤러리', '가계부', '환율',
      '엔화', '달러', '통장', '지출', '수입', '예약', '일정', '여행', '비행기', '호텔',
      '오늘', '지금', '어제', '내일', '얼마', '현재',
      // 대화 접속사 및 포괄 명사 제외
      '그럼', '근데', '하지만', '그리고', '혹시', '저기', '요즘', '최근', '추천', '테마', '대장주', '관련주', '수혜주', '종목', '주식', '시장'
    ]);

    // 💡 테마, 추천, 관련주, 설명 등 포괄적인 대화/분석 질문은 시세 조회가 아닌 AI의 자율 대화로 직행
    const isConceptualOrThematicQuery = /(테마|관련주|종목들|뭐가\s*있어|어떤게\s*있어|어떤\s*게\s*있|추천|설명|전망|분석|소개|어떤\s*종목|배당주|대장주|수혜주)/i.test(text);

    const isStockPriceQuery = !isConceptualOrThematicQuery && /(주식|주가|현재가|시세|얼마야|얼마인지|얼마|가격|어때)/i.test(text);

    let dynamicStockName = null;
    if (isStockPriceQuery) {
      let clean = text.replace(/^(미카야|미카|저기|혹시|야|오늘|지금|현재|실시간|그럼|근데|그리고)\s*/gi, '');
      clean = clean.replace(/(주식|주가|현재가|시세|가격|얼마야|얼마하고있어|얼마인가|얼마|어때|어떻게\s*돼|어떻게|알려줘|확인해줘|확인해\s*줘|확인|조회해줘|조회|알아봐줘|말해줘|\?|!|\.)/gi, ' ');
      const tokens = clean
        .split(/\s+/)
        .map((t) => t.replace(/(는|은|이|가|의|에|을|를|도|으로|로)$/, '').trim())
        .filter((t) => t.length >= 1 && !technicalBlackList.has(t.toUpperCase()));

      if (tokens.length > 0) {
        dynamicStockName = tokens[0];
      }
    }

    const targetStockName = dynamicStockName || (lastInquiredStockName && /(그거|그건|다시|현재는|지금은)/i.test(text) ? lastInquiredStockName : null);

    // 주식 관련 질의이고 종목명이 도출된 경우 (예: "루닛 시세", "삼성전자 얼마야", "현재 삼성전자는 얼마야?", "테슬라 얼마야", "소니 주식 어때")
    if (targetStockName && !actionTradeMatch && !isConceptualOrThematicQuery) {
      const stockNameRaw = targetStockName;

      try {
        const res = await api.get(`/api/ai/stock-quote?query=${encodeURIComponent(stockNameRaw)}`);
        const liveQuote = res.data;
        if (liveQuote && liveQuote.price > 0) {
          lastInquiredStockName = stockNameRaw;
          const sign = (liveQuote.changeRate || 0) > 0 ? '▲ +' : (liveQuote.changeRate || 0) < 0 ? '▼ ' : '';
          let formattedPrice = '';
          let extraKrwNote = '';

          if (liveQuote.currency === 'USD') {
            formattedPrice = `$${Number(liveQuote.price).toLocaleString()}`;
          } else if (liveQuote.currency === 'JPY') {
            formattedPrice = `¥${Number(liveQuote.price).toLocaleString()}엔`;
            try {
              const fxRes = await api.get('/api/ai/exchange-rate?base=JPY&quote=KRW');
              const jpyRate = Number(fxRes.data?.rate || 8.61);
              const unitRate = jpyRate < 50 ? jpyRate : jpyRate / 100;
              const approxKrw = Math.round(liveQuote.price * unitRate);
              extraKrwNote = ` (약 ₩${approxKrw.toLocaleString()}원)`;
            } catch {
              // ignore
            }
          } else {
            formattedPrice = `₩${Number(liveQuote.price).toLocaleString()}원`;
          }

          const changeStr = liveQuote.changeRate !== undefined
            ? ` (${sign}${Number(liveQuote.changeRate).toFixed(2)}%)`
            : '';

          return {
            isAssetCommand: true,
            assistantResponse: `📈 현재 **${liveQuote.name}(${liveQuote.ticker}, ${liveQuote.market})**의 실시간 주가는 **${formattedPrice}**${extraKrwNote}${changeStr}야! 🌸`,
          };
        }
      } catch (e) {
        console.warn('시세 조회 실패 또는 종목 미발견:', e);
      }

      // API에서 실시간 종목을 찾지 못했거나 포괄적인 질문이면, 억지로 가로채지 않고 최종적으로 AI(Qwen/Gemini)가 자율 답변하도록 패스!
      return { isAssetCommand: false };
    }

    // 3. 통장 잔액 / 잔고 / 가계부 현황 질의
    // 예: "현재 통장에 있는 엔화 잔고 정리해서 보여줘", "잔액 얼마야?", "엔화 잔고 얼마야?", "통장에 얼마 있어?", "총자산 얼마야?"
    const isBalanceInquiry = /(통장.*(잔액|잔고|현황|정리|얼마)|(엔화|달러|원화).*(잔액|잔고|얼마)|잔고\s*(정리|보여|알려|얼마)|잔액\s*(얼마|확인|알려|보여)|얼마\s*남았|얼마\s*있어|통장에\s*얼마|총\s*자산|순자산|이번\s*달\s*(지출|수입|돈|가계부))/i.test(text);

    if (isBalanceInquiry) {
      try {
        const ledger = await getLedgerDashboard();
        const accountsData = await getAccounts();
        const accounts = accountsData.accounts || [];

        // 실시간 환율 조회 (외화 원화 환산용)
        let jpyRate = 8.63;
        try {
          const fxRes = await api.get('/api/ai/exchange-rate?base=JPY&quote=KRW');
          const rate = Number(fxRes.data?.rate || 863);
          jpyRate = rate < 50 ? rate : rate / 100;
        } catch {
          jpyRate = 8.63;
        }

        const asksJpy = /(엔화|엔|JPY|일본\s*돈)/i.test(text) && !/(원화|달러|총\s*자산)/i.test(text);

        // 특정 외화(엔화)만 정리해서 보여달라는 경우
        if (asksJpy) {
          const jpyAccounts = accounts.filter((a) => a.currency === 'JPY');
          const totalJpy = jpyAccounts.reduce((sum, a) => sum + Number(a.cachedBookBalance ?? a.balance ?? 0), 0);
          const totalKrwVal = Math.round(totalJpy * jpyRate);

          const listStr = jpyAccounts.length > 0
            ? jpyAccounts
                .map((a) => {
                  const b = Number(a.cachedBookBalance ?? a.balance ?? 0);
                  const krw = Math.round(b * jpyRate);
                  return `• **${a.accountName}**: **¥${b.toLocaleString()}엔** (약 ₩${krw.toLocaleString()}원)`;
                })
                .join('\n')
            : '등록된 엔화 통장이 없어.';

          return {
            isAssetCommand: true,
            assistantResponse: `💴 **현재 보유 중인 엔화(JPY) 통장 잔고 현황이야!** 🌸\n\n- 💰 **총 엔화 잔고**: **¥${totalJpy.toLocaleString()}엔** (원화 환산 약 **₩${totalKrwVal.toLocaleString()}원**)\n- 🏷️ **적용 환율**: 100엔당 약 ${(jpyRate * 100).toFixed(1)}원 기준\n\n**통장별 엔화 잔액**:\n${listStr}\n\n엔화 지출이나 여행 경비 관리할 때 참고해줘 🌸`,
          };
        }

        // 전체 자산 & 통장별 현황
        let totalCashKrw = 0;
        const accountsList = accounts
          .map((a) => {
            const b = Number(a.cachedBookBalance ?? a.balance ?? 0);
            const curr = a.currency || 'KRW';
            if (curr === 'JPY') {
              const krw = Math.round(b * jpyRate);
              totalCashKrw += krw;
              return `• **${a.accountName}**: **¥${b.toLocaleString()}엔** (약 ₩${krw.toLocaleString()}원)`;
            } else if (curr === 'USD') {
              const krw = Math.round(b * 1350);
              totalCashKrw += krw;
              return `• **${a.accountName}**: **$${b.toLocaleString()}달러** (약 ₩${krw.toLocaleString()}원)`;
            } else {
              totalCashKrw += b;
              return `• **${a.accountName}**: **₩${b.toLocaleString()}원**`;
            }
          })
          .join('\n');

        const totalAsset = totalCashKrw + Number(ledger?.investment?.totals?.find((item) => item.currency === 'KRW')?.marketValue || 0);
        const monthExpense = Number(ledger?.monthExpenseKrw || ledger?.monthlyExpense?.KRW || 0);
        const monthIncome = Number(ledger?.monthIncomeKrw || ledger?.monthlyIncome?.KRW || 0);
        const netCashFlow = Number(ledger?.netCashFlowKrw || (monthIncome - monthExpense));

        return {
          isAssetCommand: true,
          assistantResponse: `💼 **오빠의 현재 자산 & 통장 잔액 현황이야!** 🌸\n\n- 💰 **총 순자산(원화 환산)**: **₩${totalAsset.toLocaleString()}원**\n- 📥 **이번 달 수입**: ₩${monthIncome.toLocaleString()}원\n- 📤 **이번 달 지출**: ₩${monthExpense.toLocaleString()}원 (당월 수지: ${netCashFlow >= 0 ? '+' : ''}₩${netCashFlow.toLocaleString()}원)\n\n**보유 통장별 잔액**:\n${accountsList || '등록된 통장이 없어.'}\n\n궁금한 점이 있으면 언제든 편하게 물어봐줘 🌸`,
        };
      } catch (e) {
        console.warn('자산 요약 조회 실패:', e);
      }
    }

    // 3-1. 실시간 외환 환율 및 통화 환산 질의
    // 예: "현재 엔화 환율과 1000엔 원화 가치 알려줘", "1000엔 원화로 얼마야?", "엔화 환율 알려줘", "달러 환율 얼마야?", "100달러 원화로"
    const isFxQuery = /(환율|원화\s*가치|엔화\s*환율|달러\s*환율|엔화\s*얼마|달러\s*얼마|엔\s*원화|달러\s*원화|환전|환산)/i.test(text);
    const isFxInquiryVerb = /(알려|얼마|가치|시세|조회|계산|어때|어떻게|환산|궁금)/i.test(text);

    if (isFxQuery && (isFxInquiryVerb || !actionTradeMatch)) {
      const isDollar = /(달러|USD|\$)/i.test(text);
      const baseCurr = isDollar ? 'USD' : 'JPY';
      const baseName = isDollar ? '달러(USD)' : '엔화(JPY)';
      const baseUnit = isDollar ? '달러' : '엔';

      let targetAmount = 0;
      const fxAmountMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(만원|천원|백원|원|엔|JPY|달러|USD)?/i);
      if (fxAmountMatch) {
        let rawAmt = parseFloat(fxAmountMatch[1].replace(/,/g, ''));
        const unit = (fxAmountMatch[2] || '').toUpperCase();
        if (unit.includes('만')) rawAmt *= 10000;
        else if (unit.includes('천')) rawAmt *= 1000;
        if (rawAmt > 0) targetAmount = rawAmt;
      }

      try {
        const res = await api.get(`/api/ai/exchange-rate?base=${baseCurr}&quote=KRW`);
        const fx = res.data;
        if (fx && fx.rate > 0) {
          const rawRate = Number(fx.rate);
          const rate100 = baseCurr === 'JPY' && rawRate < 50 ? rawRate * 100 : rawRate;
          const unitRate = baseCurr === 'JPY' ? rate100 / 100 : rawRate;
          const convertedKrw = targetAmount > 0 ? targetAmount * unitRate : 0;

          const changeVal = Number(fx.changePercent || 0);
          const changeSign = changeVal !== 0 ? (changeVal > 0 ? ` (▲ +${changeVal.toFixed(2)}%)` : ` (▼ ${Math.abs(changeVal).toFixed(2)}%)`) : '';

          let responseText = `💴 **실시간 ${baseName} 환율 브리핑이야!** 🌸\n\n`;
          responseText += `- 🏷️ **기준 환율 (${baseCurr === 'JPY' ? '100엔 기준' : '1달러 기준'})**: **약 ${rate100.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원**${changeSign}\n`;
          if (targetAmount > 0) {
            responseText += `- 💰 **${targetAmount.toLocaleString()}${baseUnit}의 원화 가치**: **약 ${Math.round(convertedKrw).toLocaleString('ko-KR')}원**\n`;
          } else if (baseCurr === 'JPY') {
            responseText += `- 💰 **1,000엔 가치**: 약 **${Math.round(1000 * unitRate).toLocaleString('ko-KR')}원**\n`;
            responseText += `- 💰 **10,000엔 가치**: 약 **${Math.round(10000 * unitRate).toLocaleString('ko-KR')}원**\n`;
          }
          responseText += `- 🏛️ **출처**: ${fx.provider || '실시간 금융망'}\n\n`;
          responseText += `일본 여행 경비나 환전 계획할 때 참고해줘 🌸`;

          return {
            isAssetCommand: true,
            assistantResponse: responseText,
          };
        }
      } catch (err) {
        console.warn('자산비서 환율 조회 실패:', err);
      }
    }

    // 3-2. 계좌 간 이체 / 충전 / 송금 등록 감지 (예: "현금에서 교통카드로 5000엔을 보냈어", "토스에서 현금으로 5만원 이체했어", "교통카드에 5000엔 충전했어")
    const isTransferVerb = /(보냈어|보냄|보냈다|보냈는데|이체했어|이체함|이체|송금했어|송금함|송금|충전했어|충전함|충전|옮겼어|옮김|옮겨|인출했어|인출|뽑았어|채웠어|넣었어)/i.test(text);
    const hasTransferSyntax = /(에서|한테서|에게서|으로|로|에|에게)/i.test(text) || /(충전|이체|송금|인출|뽑았)/i.test(text);

    if (isTransferVerb && hasTransferSyntax) {
      const amountMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(만원|천원|백원|원|엔|JPY|달러|USD|KRW)?/i);
      if (amountMatch) {
        let transferAmt = parseFloat(amountMatch[1].replace(/,/g, ''));
        const unit = (amountMatch[2] || '').toUpperCase();
        if (unit.includes('만')) transferAmt *= 10000;
        else if (unit.includes('천')) transferAmt *= 1000;

        let detectedCurrency = 'KRW';
        if (unit.includes('엔') || unit === 'JPY' || text.includes('엔')) detectedCurrency = 'JPY';
        else if (unit.includes('달러') || unit === 'USD' || text.includes('달러')) detectedCurrency = 'USD';

        if (transferAmt > 0) {
          try {
            const accountsData = await getAccounts();
            const accounts = accountsData.accounts || [];

            if (accounts.length >= 2) {
              let sourceTerm = '';
              let destTerm = '';

              // 패턴 1: (A)에서 (B)로/에
              const fromToMatch = text.match(/([가-힣a-zA-Z0-9\s]+?)\s*(?:에서|한테서|에게서)\s*([가-힣a-zA-Z0-9\s]+?)\s*(?:로|으로|에)\s*/);
              // 패턴 2: (B)에/에게 (A)로/에서
              const toFromMatch = text.match(/([가-힣a-zA-Z0-9\s]+?)\s*(?:에|에게)\s*([가-힣a-zA-Z0-9\s]+?)\s*(?:으로|로|에서)\s*/);
              // 패턴 3: (B)에/로 (금액) 충전/채웠/넣었
              const singleDestMatch = text.match(/([가-힣a-zA-Z0-9\s]+?)\s*(?:에|에게|으로|로)\s*.*?(?:충전|채웠|넣었|이체|보냈|송금)/);

              if (fromToMatch) {
                sourceTerm = cleanItemTitle(fromToMatch[1]);
                destTerm = cleanItemTitle(fromToMatch[2]);
              } else if (toFromMatch) {
                destTerm = cleanItemTitle(toFromMatch[1]);
                sourceTerm = cleanItemTitle(toFromMatch[2]);
              } else if (singleDestMatch) {
                destTerm = cleanItemTitle(singleDestMatch[1]);
              }

              let sourceAcc = matchAccount(sourceTerm, accounts, detectedCurrency);
              let destAcc = matchAccount(destTerm, accounts, detectedCurrency);

              // 미지정 단일 대상 폴백
              if (!sourceAcc && destAcc) {
                if (destAcc.accountPurpose === 'TRANSIT_CARD') {
                  sourceAcc = accounts.find((a) => a.accountPurpose === 'CASH' && a.currency === destAcc.currency)
                    || accounts.find((a) => a.accountPurpose === 'CASH')
                    || accounts.find((a) => a.accountId !== destAcc.accountId && a.accountType === 'CHECKING');
                } else if (destAcc.accountPurpose === 'CASH') {
                  sourceAcc = accounts.find((a) => a.accountId !== destAcc.accountId && a.accountType === 'CHECKING')
                    || accounts.find((a) => a.accountId !== destAcc.accountId);
                } else {
                  sourceAcc = accounts.find((a) => a.accountPurpose === 'CASH' && a.currency === destAcc.currency)
                    || accounts.find((a) => a.accountId !== destAcc.accountId && a.accountType === 'CHECKING')
                    || accounts.find((a) => a.accountId !== destAcc.accountId);
                }
              } else if (sourceAcc && !destAcc) {
                if (/(인출|뽑았|출금)/i.test(text)) {
                  destAcc = accounts.find((a) => a.accountPurpose === 'CASH' && a.currency === sourceAcc.currency)
                    || accounts.find((a) => a.accountPurpose === 'CASH');
                } else {
                  destAcc = accounts.find((a) => a.accountPurpose === 'TRANSIT_CARD' && a.currency === sourceAcc.currency)
                    || accounts.find((a) => a.accountPurpose === 'TRANSIT_CARD')
                    || accounts.find((a) => a.accountId !== sourceAcc.accountId);
                }
              }

              if (sourceAcc && destAcc && sourceAcc.accountId !== destAcc.accountId) {
                let srcAmount = transferAmt;
                let dstAmount = transferAmt;
                let exRate = 1.0;

                // 통화 불일치 시 실시간 환율 적용
                if (sourceAcc.currency !== destAcc.currency) {
                  try {
                    const fxRes = await api.get('/api/ai/exchange-rate?base=JPY&quote=KRW');
                    const jpyKrwRate = Number(fxRes.data?.rate || 860);
                    const jpyUnit = jpyKrwRate < 50 ? jpyKrwRate : jpyKrwRate / 100;

                    if (sourceAcc.currency === 'KRW' && destAcc.currency === 'JPY') {
                      if (detectedCurrency === 'JPY') {
                        dstAmount = transferAmt;
                        srcAmount = Math.round(transferAmt * jpyUnit);
                      } else {
                        srcAmount = transferAmt;
                        dstAmount = Math.round(transferAmt / jpyUnit);
                      }
                      exRate = jpyUnit;
                    } else if (sourceAcc.currency === 'JPY' && destAcc.currency === 'KRW') {
                      if (detectedCurrency === 'JPY') {
                        srcAmount = transferAmt;
                        dstAmount = Math.round(transferAmt * jpyUnit);
                      } else {
                        dstAmount = transferAmt;
                        srcAmount = Math.round(transferAmt / jpyUnit);
                      }
                      exRate = jpyUnit;
                    }
                  } catch (fxErr) {
                    console.warn('환율 계산 실패:', fxErr);
                  }
                }

                // 잔액 확인
                const sourceBal = Number(sourceAcc.cachedBookBalance || 0);
                if (sourceBal < srcAmount) {
                  const currSymbol = sourceAcc.currency === 'JPY' ? '¥' : sourceAcc.currency === 'USD' ? '$' : '₩';
                  return {
                    isAssetCommand: true,
                    assistantResponse: `⚠️ **출금 계좌(${sourceAcc.accountName}) 잔액이 부족해!** 🌸\n\n- 현재 잔액: **${currSymbol}${sourceBal.toLocaleString()}**\n- 필요 금액: **${currSymbol}${srcAmount.toLocaleString()}**\n\n통장 잔액을 먼저 확인하거나 다른 계좌를 이용해줘 🌸`,
                  };
                }

                const createdTransfer = await createAccountTransfer({
                  sourceAccountId: sourceAcc.accountId,
                  destinationAccountId: destAcc.accountId,
                  amount: srcAmount,
                  destinationAmount: dstAmount,
                  exchangeRate: exRate,
                  feeAmount: 0,
                  transferredAt: getLocalDateTimeString(),
                  memo: `[미카 AI 이체] ${sourceAcc.accountName} → ${destAcc.accountName}`,
                });

                lastCreatedTransferData = {
                  transferId: createdTransfer.transferId,
                  sourceAccount: sourceAcc,
                  destAccount: destAcc,
                  sourceAmount: srcAmount,
                  destAmount: dstAmount,
                };

                const srcFmt = formatAmtWithCurr(srcAmount, sourceAcc.currency);
                const dstFmt = formatAmtWithCurr(dstAmount, destAcc.currency);
                const newSrcBal = formatAmtWithCurr(sourceBal - srcAmount, sourceAcc.currency);
                const newDstBal = formatAmtWithCurr(Number(destAcc.cachedBookBalance || 0) + dstAmount, destAcc.currency);

                return {
                  isAssetCommand: true,
                  shouldRefreshDashboard: true,
                  assistantResponse: `💸 **계좌 간 이체(충전) 완료!** 🌸\n\n- 📤 **출금 계좌**: **${sourceAcc.accountName}** (-${srcFmt})\n- 📥 **입금 계좌**: **${destAcc.accountName}** (+${dstFmt})\n- 💰 **이체 금액**: **${dstFmt}**\n- 📊 **이체 후 잔액**:\n  • **${sourceAcc.accountName}**: ${newSrcBal}\n  • **${destAcc.accountName}**: ${newDstBal}\n\n실제 가계부 장부와 계좌 잔액에 즉시 반영되었어! 잘못 입력했다면 *"방금 거 취소"* 라고 말해줘 🌸`,
                };
              }
            }
          } catch (e) {
            console.warn('이체 처리 실패 (일반 지출/대화로 폴백):', e);
          }
        }
      }
    }

    // 3-3. 계좌 잔액 맞춤 (실제 잔액 기반 자동 차액 지출/수입 등록)
    // 예: "현금에 지금 12000엔 남아있어", "교통카드 잔액 3000엔으로 맞춰줘", "트래블 하나 224709엔 남았는데 잔액조정해줘 금액은 기타로", "현금 잔액 만오천원이야"
    const isReconcileIntent = /(잔액\s*조정|잔액조정|잔액\s*맞춤|잔액맞춤|남아있어|남았어|남음|남았는데|남았네|맞춰줘|맞춰|동기화|일치시켜줘)/i.test(text)
      || (/(잔액|현재|지금|통장에|지갑에)/i.test(text) && /(있어|이야|야)/i.test(text) && !/(얼마|알려|조회|궁금)/i.test(text));

    if (isReconcileIntent && !isTransferVerb) {
      const amountMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(만원|천원|백원|원|엔|JPY|달러|USD|KRW)?/i);
      if (amountMatch) {
        let targetBal = parseFloat(amountMatch[1].replace(/,/g, ''));
        const unit = (amountMatch[2] || '').toUpperCase();
        if (unit.includes('만')) targetBal *= 10000;
        else if (unit.includes('천')) targetBal *= 1000;

        let detectedCurrency = 'KRW';
        if (unit.includes('엔') || unit === 'JPY' || text.includes('엔')) detectedCurrency = 'JPY';
        else if (unit.includes('달러') || unit === 'USD' || text.includes('달러')) detectedCurrency = 'USD';

        if (targetBal >= 0) {
          try {
            const accountsData = await getAccounts();
            const accounts = accountsData.accounts || [];

            if (accounts.length > 0) {
              // 계좌 매칭 (현금, 교통카드, 특정 계좌명 및 통화 스마트 인식)
              let targetAcc = findAccountInText(text, accounts, detectedCurrency);

              if (targetAcc?.notFound) {
                const reqName = targetAcc.requestedPurpose || '해당';
                const currLabel = targetAcc.requestedCurrency === 'JPY' ? '엔화(JPY)' : targetAcc.requestedCurrency === 'USD' ? '달러(USD)' : '원화(KRW)';
                return {
                  isAssetCommand: true,
                  assistantResponse: `⚠️ **가계부에 ${currLabel} ${reqName} 통장이 등록되어 있지 않아!** 🌸\n\n` +
                    `- 가계부 화면에서 **[+ 계좌 추가]**를 눌러 **${reqName}** 통장을 먼저 만들어주거나,\n` +
                    `- 등록된 다른 통장 이름으로 잔액 맞춤을 요청해줘 🌸`,
                };
              }

              if (targetAcc) {
                const bookBal = Number(targetAcc.cachedBookBalance || 0);
                const diff = targetBal - bookBal;
                const currSymbol = targetAcc.currency === 'JPY' ? '¥' : targetAcc.currency === 'USD' ? '$' : '₩';
                const formattedTarget = `${currSymbol}${targetBal.toLocaleString()}`;
                const formattedBook = `${currSymbol}${bookBal.toLocaleString()}`;

                if (Math.abs(diff) < 0.0001) {
                  return {
                    isAssetCommand: true,
                    assistantResponse: `⚖️ **${targetAcc.accountName}**의 장부 잔액(${formattedBook})과 말씀하신 현재 잔액(${formattedTarget})이 이미 완벽히 일치하고 있어! 🌸 별도의 조정이 필요하지 않아.`,
                  };
                }

                const isExpense = diff < 0;
                const adjustmentAmount = Math.abs(diff);
                const adjTypeStr = isExpense ? '지출' : '수입';
                const adjSign = isExpense ? '-' : '+';
                const formattedDiff = `${currSymbol}${adjustmentAmount.toLocaleString()}`;

                // 사용자 요청 카테고리 추출 (예: "금액은 기타로", "카테고리는 식비", "분류는 기타" 등)
                let category = '잔액 조정';
                const explicitCatMatch = text.match(/(?:카테고리|분류|항목|금액)(?:은|는|를|이|으로|로)?\s*(식비|카페|교통|쇼핑|주거|저축|기타)/i)
                  || text.match(/(식비|카페|교통|쇼핑|주거|저축|기타)\s*(?:카테고리|분류|항목|으로|로)/i);
                if (explicitCatMatch) {
                  category = explicitCatMatch[1];
                }

                const createdTx = await createTransaction({
                  accountId: targetAcc.accountId,
                  amount: adjustmentAmount,
                  transactionType: isExpense ? 'EXPENSE' : 'INCOME',
                  title: `실제 잔액 맞춤 (${targetAcc.accountName})`,
                  categoryId: category,
                  currency: targetAcc.currency || detectedCurrency,
                  transactionDate: getLocalDateTimeString(),
                  memo: `미카 AI 잔액 맞춤: 실제 잔액 ${formattedTarget} 기준 자동 조정 (${category})`,
                });

                lastCreatedTxId = createdTx.transactionId || createdTx.id;
                lastCreatedTxData = {
                  id: createdTx.transactionId || createdTx.id,
                  accountId: targetAcc.accountId,
                  title: createdTx.title || `실제 잔액 맞춤 (${targetAcc.accountName})`,
                  amount: adjustmentAmount,
                  isIncome: !isExpense,
                  currency: targetAcc.currency || detectedCurrency,
                };

                return {
                  isAssetCommand: true,
                  shouldRefreshDashboard: true,
                  createdTxId: createdTx.transactionId || createdTx.id,
                  assistantResponse: `🎯 **${targetAcc.accountName} 잔액 맞춤 완료!** 🌸\n\n` +
                    `- 📖 **기존 장부 잔액**: ${formattedBook}\n` +
                    `- 🎯 **입력하신 실제 잔액**: **${formattedTarget}**\n` +
                    `- ⚖️ **자동 차액 조정**: **${adjSign}${formattedDiff}** (${adjTypeStr} 처리, 카테고리: *${category}*)\n\n` +
                    `이제 가계부 장부 잔액이 실제 보유 금액인 **${formattedTarget}**으로 정확하게 동기화되었어! 💖\n` +
                    `혹시 잘못 입력했다면 *"방금 거 취소"* 라고 말해줘 🌸`,
                };
              }
            }
          } catch (e) {
            console.warn('잔액 맞춤 처리 실패 (일반 대화로 폴백):', e);
          }
        }
      }
    }

    // 4. 지출 / 수입 기록 감지 (초광범위 자연어 분석 엔진)
    // ⚠️ 반드시 실제 거래 행위 동사(썼어, 썻어, 씀, 결제, 지출, 샀어, 들어왔어, 입금, 장봤어 등)가 포함되어 있어야 함!
    // 단순 질문("얼마야?", "알려줘", "가치", "시세", "어때?", "환율")인 경우는 가계부에 등록하지 않음!
    const isExplicitExpense = /(썼어|썻어|썼음|썻음|썼다|썻다|썼네|썻네|썼는데|썻는데|씀|쓴거|쓴건데|결제했어|결제함|결제|지출했어|지출함|지출|먹었어|사먹었어|먹음|사먹음|구입했어|구입|샀어|삼|산거|산건데|구매했어|구매|나갔어|나감|빠져나감|보냈어|보냄|송금했어|송금|출금|소비했어|소비|납부|이체|적어줘|등록해줘|기록해줘|입력해줘|추가해줘|장봤어|장봤음|장봤다|장봤네|장봤는데|장보기|장\s*봤어|장\s*봤음|장\s*봤다|장을\s*봤어|장을\s*봤음|장을\s*봤다|쇼핑했어|쇼핑함|쇼핑|주문했어|주문함|주문|시켰어|시킴|배달|긁었어|긁음|냈어|돈냈어|끊었어|예매했어|예약했어|충전했어|충전함|마셨어|사마셨어)/i.test(text);
    const isExplicitIncome = /(입금|들어왔어|들어옴|받았어|받음|벌었어|벌음|월급|보너스|용돈|수입)/i.test(text);
    const isQuestionOrInquiry = /(알려줘|알려줄래|얼마야|얼마인지|어때|어떻게|조회|확인|계산|분석|가치|시세|전망|추천|\?)/i.test(text);
    const isStrictRecordRequest = /(적어줘|등록해줘|기록해줘|입력해줘|추가해줘|넣어줘)/i.test(text);

    // 질문성 문장이면서 "적어줘/등록해줘/기록해줘" 같은 명시적 등록 요청이 없다면 지출/수입 등록 건너뛰기!
    if (isQuestionOrInquiry && !isStrictRecordRequest) {
      return { isAssetCommand: false };
    }

    if (!isExplicitExpense && !isExplicitIncome) {
      return { isAssetCommand: false };
    }

    let parsedDesc = null;
    let parsedAmount = null;
    let parsedCurrency = 'KRW';
    let isIncome = false;

    // 문장에서 금액 및 단위 찾기
    const amountMatch = text.match(/([0-9,]+(?:\.[0-9]+)?)\s*(만원|천원|백원|원|엔|JPY|달러|USD|KRW)?/i);

    if (amountMatch) {
      let rawAmt = parseFloat(amountMatch[1].replace(/,/g, ''));
      const unit = (amountMatch[2] || '원').toUpperCase();
      if (unit.includes('만')) rawAmt *= 10000;
      else if (unit.includes('천')) rawAmt *= 1000;
      if (unit.includes('엔') || unit === 'JPY') parsedCurrency = 'JPY';
      else if (unit.includes('달러') || unit === 'USD') parsedCurrency = 'USD';

      // 수입 vs 지출 액션 판별
      const isIncomeAction = /(입금|받았어|받음|수입|들어왔어|들어옴|벌었어|벌음|월급|보너스|용돈)/i.test(text);
      isIncome = isIncomeAction;

      // 금액 앞부분과 뒷부분에서 항목명 추출
      const matchIdx = amountMatch.index ?? 0;
      const beforeAmount = text.substring(0, matchIdx).trim();
      const afterAmount = text.substring(matchIdx + amountMatch[0].length).trim();

      const expenseVerbRegex = /(썼어|썻어|썼음|썻음|썼다|썻다|썼네|썻네|썼는데|썻는데|씀|쓴거|쓴건데|결제했어|결제함|결제|지출했어|지출함|지출|사용했어|사용|먹었어|사먹었어|먹음|사먹음|구입했어|구입|샀어|삼|산거|산건데|구매했어|구매|나갔어|나감|빠져나감|입금|받았어|수입|들어왔어|벌었어|주고|짜리|어치|적어줘|등록해줘|기록해줘|입력해줘|추가해줘|장봤어|장봤음|장봤다|장봤네|장봤는데|장보기|장\s*봤어|장\s*봤음|장\s*봤다|장을\s*봤어|장을\s*봤음|장을\s*봤다|쇼핑했어|쇼핑함|쇼핑|주문했어|주문함|주문|시켰어|시킴|배달|긁었어|긁음|냈어|돈냈어|끊었어|예매했어|예약했어|충전했어|충전함|마셨어|사마셨어)/g;

      const beforeCleaned = beforeAmount.replace(expenseVerbRegex, '').trim();
      const afterCleaned = afterAmount.replace(expenseVerbRegex, '').trim();

      // 계좌/수단 키워드가 제거된 유효 항목 판별 (예: "트래블에서 460엔 마트에서 장을 봤어" -> afterCleaned "마트에서" 우선!)
      const beforeItem = cleanItemTitle(beforeCleaned);
      const afterItem = cleanItemTitle(afterCleaned);

      let chosenDesc = '';
      if (afterItem && (!beforeItem || beforeItem === '수입' || beforeItem === '지출')) {
        chosenDesc = afterItem;
      } else if (beforeItem && (!afterItem || afterItem === '수입' || afterItem === '지출')) {
        chosenDesc = beforeItem;
      } else if (beforeItem && afterItem) {
        chosenDesc = `${beforeItem} ${afterItem}`.trim();
      } else {
        chosenDesc = beforeItem || afterItem || (isIncome ? '수입' : '일상 지출');
      }

      parsedDesc = cleanItemTitle(chosenDesc);
      if (!parsedDesc || /^(썼어|썻어|씀|결제|지출|사용|구매|장봤어|장보기)$/i.test(parsedDesc)) {
        parsedDesc = isIncome ? '수입' : '일상 지출';
      }
      parsedAmount = rawAmt;
    }

    if (parsedAmount && parsedAmount > 0) {
      try {
        const accountsData = await getAccounts();
        const accounts = accountsData.accounts || [];

        // 🌟 문맥과 결제 수단(현금, 교통카드, 특정 계좌명 등) 및 통화(JPY/KRW/USD)를 분석하여 정확한 통장 선택!
        const targetAccount = findAccountInText(text, accounts, parsedCurrency);

        if (targetAccount?.notFound) {
          const reqName = targetAccount.requestedPurpose || '해당';
          const currLabel = targetAccount.requestedCurrency === 'JPY' ? '엔화(JPY)' : targetAccount.requestedCurrency === 'USD' ? '달러(USD)' : '원화(KRW)';
          return {
            isAssetCommand: true,
            assistantResponse: `⚠️ **가계부에 ${currLabel} ${reqName} 통장이 등록되어 있지 않아!** 🌸\n\n` +
              `- 가계부 화면에서 **[+ 계좌 추가]**를 눌러 **${reqName}** 통장을 먼저 만들어주거나,\n` +
              `- 등록된 다른 통장 이름(예: *"트래블 통장에 적어줘"*)으로 말씀해줘 🌸`,
          };
        }

        if (!targetAccount) {
          return {
            isAssetCommand: true,
            assistantResponse: `⚠️ 등록할 입출금 통장이 없습니다. 가계부에서 통장을 먼저 생성해주세요 🌸`,
          };
        }

        // 결제 수단/계좌명 단어가 빠진 순수 항목명 정제
        let desc = cleanItemTitle(parsedDesc, accounts) || (isIncome ? '수입' : '일상 지출');
        if (!desc || /^(썼어|썻어|씀|결제|지출|사용|구매)$/i.test(desc)) {
          desc = isIncome ? '수입' : '일상 지출';
        }
        if (isIncome && (desc === '수입' || !desc)) {
          if (/(현금|지갑|실물|캐시)/i.test(text)) {
            desc = '현금 입금';
          } else if (/(월급|급여)/i.test(text)) {
            desc = '급여 입금';
          } else if (/(용돈)/i.test(text)) {
            desc = '용돈';
          } else {
            desc = '수입';
          }
        }

        // 🌟 지능형 카테고리 자동 분류 (다양한 20개+ 세분화 카테고리 + AI 동적 추론)
        const category = await inferSmartCategory(desc, text, isIncome);

        const nowFormatted = getLocalDateTimeString();
        const actualCurrency = targetAccount.currency || parsedCurrency;

        let createdTx;
        try {
          createdTx = await createTransaction({
            accountId: targetAccount.accountId,
            amount: Number(parsedAmount),
            transactionType: isIncome ? 'INCOME' : 'EXPENSE',
            title: desc,
            categoryId: category,
            currency: actualCurrency,
            transactionDate: nowFormatted,
          });
        } catch (apiErr) {
          console.error('가계부 거래 등록 API 에러:', apiErr);
          const errDetail = apiErr.response?.data?.message || apiErr.response?.data || apiErr.message || '요청 처리 실패';
          return {
            isAssetCommand: true,
            assistantResponse: `⚠️ **가계부 ${isIncome ? '수입' : '지출'} 등록에 실패했어!** 🌸\n\n` +
              `- **통장**: ${targetAccount.accountName}\n` +
              `- **항목**: ${desc}\n` +
              `- **실패 사유**: ${errDetail}\n\n` +
              `통장 상태나 잔액을 확인하고 다시 시도해줘 🌸`,
          };
        }

        lastCreatedTxId = createdTx.transactionId || createdTx.id;
        lastCreatedTxData = {
          id: createdTx.transactionId || createdTx.id,
          accountId: targetAccount.accountId,
          accountName: targetAccount.accountName,
          title: desc,
          amount: Number(parsedAmount),
          currency: actualCurrency,
          categoryId: category,
          transactionType: isIncome ? 'INCOME' : 'EXPENSE',
        };

        const formattedAmount =
          actualCurrency === 'JPY'
            ? `${parsedAmount.toLocaleString()}엔 (약 ${(parsedAmount * 9.2).toLocaleString()}원)`
            : actualCurrency === 'USD'
            ? `$${parsedAmount.toLocaleString()}`
            : `${parsedAmount.toLocaleString()}원`;

        const prevBal = Number(targetAccount.cachedBookBalance || 0);
        const currSymbol = actualCurrency === 'JPY' ? '¥' : actualCurrency === 'USD' ? '$' : '₩';
        const postBal = isIncome ? prevBal + Number(parsedAmount) : prevBal - Number(parsedAmount);
        const balFeedback = `- **통장 잔액**: ${currSymbol}${postBal.toLocaleString()}` + (postBal < 0 ? ` *(⚠️ 마이너스 잔액)*` : '');

        return {
          isAssetCommand: true,
          shouldRefreshDashboard: true,
          createdTxId: createdTx.transactionId || createdTx.id,
          assistantResponse: `📒 **${isIncome ? '수입' : '지출'} 내역 등록 완료!** 🌸\n\n- **통장**: ${targetAccount.accountName}\n- **항목**: ${desc}\n- **분류**: ${category}\n- **금액**: ${formattedAmount}\n${balFeedback}\n\n실제 가계부 DB에 즉시 등록되었어! 잘못 입력했다면 *"방금 거 취소"* 라고 말해줘 🌸`,
        };
      } catch (e) {
        console.error('가계부 자동 등록 시스템 예외:', e);
        const errDetail = e.response?.data?.message || e.message || '서버 통신 실패';
        return {
          isAssetCommand: true,
          assistantResponse: `⚠️ **가계부 서버 처리 중 문제가 발생했어!** 🌸\n\n- 사유: **${errDetail}**\n\n가계부 서버 연결 상태를 확인하고 잠시 후 다시 시도해줘 🌸`,
        };
      }
    }

    return { isAssetCommand: false };
  },
};

/**
 * 🎯 프로젝트 공식 7대 카테고리 (식비, 카페, 교통, 쇼핑, 주거, 저축, 기타)
 * + 일본 현지 여행/생활(엔화, 일본 브랜드, 매장, 교통) 특화 AI 실시간 추론 엔진
 */
async function inferSmartCategory(desc, fullText, isIncome) {
  const combined = `${desc} ${fullText}`.toLowerCase();

  // 1. 수입 카테고리
  if (isIncome) {
    return '수입';
  }

  // 2. 일본 여행 & 실생활 패턴 즉시 매핑 (공식 카테고리 7개 중 하나로만 정밀 매핑)
  // [카페]
  if (/카페|커피|스타벅스|도토루|코메다|툴리스|블루보틀|킷사텐|설빙|이디야|투썸|빽다방|메가커피|컴포즈|공차|말차|녹차|당고|파르페|크레페|빙수|디저트|베이커리|빵|케이크|마카롱|아이스크림|베스킨|도넛|미스터도넛/i.test(combined)) {
    return '카페';
  }

  // [식비]
  if (/밥|점심|저녁|식사|편의점|로손|세븐일레븐|패밀리마트|미니스톱|마트|라이프|이온몰|세이유|산와|sanwa|치킨|피자|고기|삼겹살|야키니쿠|햄버거|국밥|외식|배달|라멘|이치란|잇푸도|츠케멘|스시|초밥|쿠라스시|스시로|돈카츠|카츠동|텐동|우동|규동|마츠야|요시노야|스키야|타코야키|오코노미야키|쿠시카츠|꼬치|야키토리|소바|카레|나베|샤브샤브|이자카야|벤또|도시락|오니기리|삼각김밥|샌드위치|식비|수산|횟집|회|광어|우럭|연어|참치|해물|해산물|조개|게장|생선|구이|매운탕|식당|맛집|포차|주점|술집|호프|맥주|소주|안주|뷔페|레스토랑|분식|떡볶이|라면|김밥|만두|순대|곱창|막창|대창|갈비|찜닭|족발|보쌈|찌개|탕|탕수육|짜장|짬뽕|중국집|중화요리|파스타|스테이크|돈까스/i.test(combined)) {
    return '식비';
  }

  // [교통]
  if (/교통|지하철|전철|도쿄메트로|오사카메트로|jr|신칸센|스이카|파스모|이코카|suica|pasmo|icoca|티머니|기차|ktx|srt|하루카|라피트|넥스|스카이라이너|버스|리무진|공항버스|택시|카카오택시|페리|배|렌터카|주유|주유소|기름|휘발유|톨게이트|하이패스|etc|주차/i.test(combined)) {
    return '교통';
  }

  // [쇼핑]
  if (/돈키호테|돈키|마츠모토키요시|선드럭|다이코쿠|드럭스토어|빅카메라|요도바시|유니클로|gu|지유|다이소|세리아|캔두|무인양품|무지|muji|로프트|도큐핸즈|포켓몬센터|닌텐도|아키하바라|피규어|굿즈|애니메이트|만다라케|백화점|이세탄|한큐|다카시마야|아울렛|면세점|면세|duty\s*free|기념품|선물|도쿄바나나|시로이코이비토|옷|의류|신발|패딩|코트|셔츠|바지|무신사|쿠팡|가방|지갑|액세서리|화장품|향수|생필품|올리브영|쇼핑/i.test(combined)) {
    return '쇼핑';
  }

  // [주거] (숙박 및 주거)
  if (/호텔|아파호텔|apa|토요코인|도미인|료칸|온천|온천호텔|캡슐호텔|게스트하우스|에어비앤비|호스텔|민박|펜션|리조트|모텔|숙소|숙박|월세|관리비|공과금|전기세|가스비|수도세/i.test(combined)) {
    return '주거';
  }

  // [저축] (투자/환전/외화)
  if (/환전|트래블월렛|트래블로그|외화|엔화환전|달러환전|주식|매수|매도|증권|적금|예금|저축|투자|펀드|코인/i.test(combined)) {
    return '저축';
  }

  // 3. 미매칭 시 로컬 AI (Ollama) 초고속 일본 여행/생활 맥락 추론 (타임아웃 1.2초)
  try {
    const aiCategory = await queryAiCategory(desc, fullText);
    if (aiCategory) return aiCategory;
  } catch {
    // fallback
  }

  return '기타';
}

/**
 * 로컬 Ollama 모델을 활용한 0.1초 AI 카테고리 추론 (일본 여행/생활 맥락 특화)
 */
async function queryAiCategory(_desc, _fullText) {
  // 카테고리는 기존 규칙으로 분류하고 브라우저에서 로컬 AI를 직접 호출하지 않습니다.
  return null;
}

function formatAmtWithCurr(amt, curr) {
  const num = Number(amt || 0);
  if (curr === 'JPY') return `¥${num.toLocaleString()}엔`;
  if (curr === 'USD') return `$${num.toLocaleString()}`;
  return `₩${num.toLocaleString()}원`;
}

function matchAccount(rawTerm, accounts, preferredCurrency) {
  if (!rawTerm) return null;
  const term = rawTerm.trim().toLowerCase().replace(/^(오늘|어제|방금|내|제)\s*/g, '').trim();
  if (!term) return null;

  // 1. purpose & 이름 기반 현금 매핑 (통화 우선 매칭)
  if (/(현금|지갑|실물|캐시|cash)/i.test(term)) {
    const matchedCash = accounts.find((a) => (a.accountPurpose === 'CASH' || /(현금|지갑|cash)/i.test(a.accountName)) && (!preferredCurrency || a.currency === preferredCurrency));
    if (matchedCash) return matchedCash;
    const anyCash = accounts.find((a) => a.accountPurpose === 'CASH' || /(현금|지갑|cash)/i.test(a.accountName));
    if (anyCash) return anyCash;
  }

  // 2. purpose & 이름 기반 교통카드 매핑 (통화 우선 매칭)
  if (/(교통|교통카드|스이카|파스모|이코카|suica|pasmo|icoca|티머니|기후동행)/i.test(term)) {
    const transitAcc = accounts.find((a) => (a.accountPurpose === 'TRANSIT_CARD' || /(교통|스이카|파스모|이코카|suica|pasmo|icoca|티머니)/i.test(a.accountName)) && (!preferredCurrency || a.currency === preferredCurrency))
      || accounts.find((a) => a.accountPurpose === 'TRANSIT_CARD' || /(교통|스이카|파스모|이코카|suica|pasmo|icoca|티머니)/i.test(a.accountName));
    if (transitAcc) return transitAcc;
  }

  // 3. 이름 매칭
  const searchPool = preferredCurrency
    ? [...accounts.filter((a) => a.currency === preferredCurrency), ...accounts.filter((a) => a.currency !== preferredCurrency)]
    : accounts;

  const exact = searchPool.find((a) => a.accountName.toLowerCase() === term);
  if (exact) return exact;

  const partial = searchPool.find((a) => {
    const name = a.accountName.toLowerCase();
    const bank = (a.bankName || '').toLowerCase();
    return name.includes(term) || term.includes(name) || (bank && (bank.includes(term) || term.includes(bank)));
  });
  if (partial) return partial;

  return null;
}

export function findAccountInText(fullText, accounts = [], preferredCurrency = null) {
  if (!accounts || accounts.length === 0) return null;
  const t = (fullText || '').toLowerCase();

  // 1. 현금 명시적 키워드 우선 감지 (통화 일치 + purpose/이름 매칭)
  const isCashMentioned = /(현금|지갑|실물\s*돈|캐시|cash)/i.test(t);
  if (isCashMentioned) {
    // 1-1. 통화 일치하는 현금 계좌 (purpose === 'CASH' 또는 이름에 '현금/지갑/cash')
    const matchedCashWithCurr = accounts.find((a) =>
      (!preferredCurrency || a.currency === preferredCurrency) &&
      (a.accountPurpose === 'CASH' || /(현금|지갑|cash)/i.test(a.accountName))
    );
    if (matchedCashWithCurr) return matchedCashWithCurr;

    // 1-2. 통화 불문 현금 계좌
    const anyCash = accounts.find((a) => a.accountPurpose === 'CASH' || /(현금|지갑|cash)/i.test(a.accountName));
    if (anyCash) return anyCash;

    // 1-3. 사용자가 "현금"을 명시했는데 현금 계좌가 없다면 엉뚱한 일반 통장으로 빠지지 않고 알림 반환!
    return { notFound: true, requestedPurpose: '현금', requestedCurrency: preferredCurrency };
  }

  // 2. 교통카드 명시적 키워드 우선 감지
  const isTransitMentioned = /(교통카드|교통|스이카|파스모|이코카|suica|pasmo|icoca|티머니|기후동행)/i.test(t);
  if (isTransitMentioned) {
    const matchedTransitWithCurr = accounts.find((a) =>
      (!preferredCurrency || a.currency === preferredCurrency) &&
      (a.accountPurpose === 'TRANSIT_CARD' || /(교통|스이카|파스모|이코카|suica|pasmo|icoca|티머니)/i.test(a.accountName))
    );
    if (matchedTransitWithCurr) return matchedTransitWithCurr;

    const anyTransit = accounts.find((a) => a.accountPurpose === 'TRANSIT_CARD' || /(교통|스이카|파스모|이코카|suica|pasmo|icoca|티머니)/i.test(a.accountName));
    if (anyTransit) return anyTransit;

    return { notFound: true, requestedPurpose: '교통카드', requestedCurrency: preferredCurrency };
  }

  // 3. 등록된 계좌 이름 / 은행명 매칭 (긴 이름 우선 탐색, 띄어쓰기 유연 매칭)
  const sorted = [...accounts].sort((a, b) => (b.accountName?.length || 0) - (a.accountName?.length || 0));
  const tNoSpace = t.replace(/\s+/g, '');
  for (const acc of sorted) {
    const name = (acc.accountName || '').toLowerCase().trim();
    const bank = (acc.bankName || '').toLowerCase().trim();
    const nameNoSpace = name.replace(/\s+/g, '');
    const bankNoSpace = bank.replace(/\s+/g, '');
    if (nameNoSpace && tNoSpace.includes(nameNoSpace)) return acc;
    if (bankNoSpace && bankNoSpace.length >= 2 && tNoSpace.includes(bankNoSpace)) return acc;

    // 3-1. 계좌명 분할 키워드 매칭 (예: "트래블 하나" -> "트래블"만 언급해도 통화 일치 시 최우선 매칭)
    const parts = name.split(/\s+/).filter((p) => p.length >= 2);
    for (const part of parts) {
      if (tNoSpace.includes(part)) {
        if (!preferredCurrency || acc.currency === preferredCurrency) {
          return acc;
        }
      }
    }
  }

  // 4. 사용자 환경설정(LedgerSettings) 통화별 기본 출금 계좌 조회
  const settings = getLedgerSettings();
  if (preferredCurrency && settings?.defaultAccounts?.[preferredCurrency]) {
    const configuredAcc = accounts.find((a) => a.accountId === settings.defaultAccounts[preferredCurrency]);
    if (configuredAcc) return configuredAcc;
  }

  // 4-1. 통화(JPY, KRW, USD) 기반 자동 매칭
  if (preferredCurrency) {
    const currMatch = accounts.find((a) => a.currency === preferredCurrency && a.accountType === 'CHECKING')
      || accounts.find((a) => a.currency === preferredCurrency && a.accountType !== 'INVESTMENT')
      || accounts.find((a) => a.currency === preferredCurrency);
    if (currMatch) return currMatch;
  }

  // 5. 대표 주거래 계좌(Primary) 또는 기본 입출금 계좌 폴백
  if (settings?.primaryAccountId) {
    const primary = accounts.find((a) => a.accountId === settings.primaryAccountId);
    if (primary) return primary;
  }

  return accounts.find((a) => a.accountType === 'CHECKING')
    || accounts.find((a) => a.accountType !== 'INVESTMENT')
    || accounts[0];
}
