package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class InvestmentTest {

    @Test
    @DisplayName("추가 매수 시 표시 통화와 기준 통화의 평균 매입가를 각각 계산한다")
    void applyBuyCalculatesWeightedAveragePrices() {
        Investment investment = baseInvestment();

        investment.applyBuy(new BigDecimal("2"), new BigDecimal("100"),
                new BigDecimal("1300"), BigDecimal.ZERO, BigDecimal.ZERO);
        investment.applyBuy(new BigDecimal("1"), new BigDecimal("130"),
                new BigDecimal("1400"), BigDecimal.ZERO, BigDecimal.ZERO);

        assertThat(investment.getCachedQuantity()).isEqualByComparingTo("3");
        assertThat(investment.getCachedAvgBuyPrice()).isEqualByComparingTo("110.0000");
        assertThat(investment.getCachedAvgBuyPriceBase()).isEqualByComparingTo("147333.3333");
    }

    @Test
    @DisplayName("현재가 갱신과 매도 시 평가금액 및 실현손익을 계산한다")
    void updatePriceAndSellCalculateValuationAndRealizedProfit() {
        Investment investment = baseInvestment();
        investment.applyBuy(new BigDecimal("3"), new BigDecimal("100"),
                new BigDecimal("1300"), BigDecimal.ZERO, BigDecimal.ZERO);
        investment.updatePrice(new BigDecimal("120"), new BigDecimal("1350"), LocalDateTime.now());

        assertThat(investment.getCachedMarketValue()).isEqualByComparingTo("486000.00");

        BigDecimal realized = investment.applySell(new BigDecimal("1"), new BigDecimal("120"),
                new BigDecimal("1"), BigDecimal.ZERO, new BigDecimal("1350"));

        assertThat(investment.getCachedQuantity()).isEqualByComparingTo("2");
        assertThat(realized).isEqualByComparingTo("30650.0000");
        assertThat(investment.getCachedMarketValue()).isEqualByComparingTo("324000.00");
    }

    private Investment baseInvestment() {
        return Investment.builder()
                .userId("user-1")
                .accountId("account-1")
                .tickerCode("AAPL")
                .symbolName("애플")
                .assetClass(InvestmentAssetClass.FOREIGN_STOCK)
                .market("NASDAQ")
                .currency(Currency.USD)
                .build();
    }
}
