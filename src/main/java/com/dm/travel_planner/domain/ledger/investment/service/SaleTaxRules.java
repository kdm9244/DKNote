package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;

/** Effective-dated defaults. Unknown products/dates require an explicit settlement amount. */
public final class SaleTaxRules {
    private SaleTaxRules() {}
    public record Quote(BigDecimal automaticTax, BigDecimal estimatedIncomeTax, String basis, String source) {}
    public static Quote quote(Investment holding, LocalDate date, String residence, InvestmentTaxTreatment treatment,
                              BigDecimal quantity, BigDecimal gross, BigDecimal fee) {
        String market = holding.getMarket() == null ? "" : holding.getMarket().toUpperCase(Locale.ROOT);
        if (holding.getCurrency() == Currency.KRW) {
            String source = "https://www.law.go.kr/lsInfoP.do?lsiSeq=282431&viewCls=lsRvsDocInfoR";
            if (!Set.of("KR", "KRX", "KOSPI", "KOSDAQ", "KONEX").contains(market))
                return new Quote(null, null, "거래 시장 확인 필요 · 실제 정산 세액을 입력하세요.", source);
            if (holding.getAssetClass() == InvestmentAssetClass.INDEX_ETF)
                return new Quote(BigDecimal.ZERO, null, "국내 상장 투자신탁형 ETF · 거래세 면제 (소득세는 별도)", "https://regulation.krx.co.kr/contents/RGL/03/03060105/RGL03060105.jsp");
            if (holding.getAssetClass() == null || holding.getAssetClass() == InvestmentAssetClass.DIVIDEND_ASSET)
                return new Quote(null, null, "배당주/ETF의 상품 구분 필요 · 실제 정산 세액을 입력하세요.", source);
            if (date.getYear() < 2025 || date.getYear() > 2026)
                return new Quote(null, null, "자동 거래세 지원 기간은 2025~2026년입니다. 실제 정산 세액을 입력하세요.", source);
            BigDecimal rate = new BigDecimal(market.equals("KONEX") ? "0.10" : date.getYear() == 2025 ? "0.15" : "0.20");
            BigDecimal amount = market.equals("KOSPI") && date.getYear() == 2026
                    ? percent(gross,new BigDecimal("0.05"),0).add(percent(gross,new BigDecimal("0.15"),0)) : percent(gross,rate,0);
            return new Quote(amount, null, date.getYear() + "년 " + market + " 장내 일반 주식 · 거래세 등 " + rate + "% (코스피 농특세 포함)", source);
        }
        if ("JP".equals(residence)) {
            String source = "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1476.htm";
            if (treatment == InvestmentTaxTreatment.NISA)
                return new Quote(BigDecimal.ZERO, BigDecimal.ZERO, "일본 NISA · 계좌 내 매도차익 비과세", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1535.htm");
            if (holding.getCurrency() == Currency.JPY && date.getYear() >= 2025 && date.getYear() <= 2026) {
                BigDecimal profit = gross.subtract(fee).subtract(holding.getCachedAvgBuyPrice().multiply(quantity)).max(BigDecimal.ZERO);
                return new Quote(BigDecimal.ZERO, percent(profit, new BigDecimal("20.315"), 0),
                        "일본 · 이번 매도차익 × 20.315% 참고액. 연간 손익통산·환급은 별도이며 실제 원천징수액은 정산서로 확인하세요.", source);
            }
            return new Quote(BigDecimal.ZERO, null, "일본 · 엔화 환산 및 연간 손익통산은 세금 관리에서 계산합니다.", source);
        }
        return new Quote(BigDecimal.ZERO, null, "해외주식 · 양도소득세는 세금 관리에서 연간 정산합니다. 시장별 실제 부과금은 비용 수정으로 기록하세요.", "");
    }
    private static BigDecimal percent(BigDecimal amount, BigDecimal rate, int scale) {
        return amount.multiply(rate).divide(new BigDecimal("100"), scale, RoundingMode.DOWN);
    }
}
