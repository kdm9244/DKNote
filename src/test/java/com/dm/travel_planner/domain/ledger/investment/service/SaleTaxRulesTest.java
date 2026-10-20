package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import static org.assertj.core.api.Assertions.*;

class SaleTaxRulesTest {
    Investment holding(String market,Currency currency,InvestmentAssetClass type) {
        return Investment.builder().market(market).currency(currency).assetClass(type).cachedAvgBuyPrice(new BigDecimal("1000")).build();
    }
    SaleTaxRules.Quote quote(Investment h,String date,String residence,InvestmentTaxTreatment treatment,String gross) {
        return SaleTaxRules.quote(h,LocalDate.parse(date),residence,treatment,BigDecimal.ONE,new BigDecimal(gross),BigDecimal.ZERO);
    }
    @Test void koreanRatesChangeAtYearBoundaryRegardlessOfResidence() {
        var h=holding("KOSPI",Currency.KRW,InvestmentAssetClass.DOMESTIC_STOCK);
        assertThat(quote(h,"2025-12-31","JP",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isEqualByComparingTo("150");
        assertThat(quote(h,"2026-01-01","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isEqualByComparingTo("200");
        h=holding("KOSDAQ",Currency.KRW,InvestmentAssetClass.DOMESTIC_STOCK);
        assertThat(quote(h,"2026-01-01","JP",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isEqualByComparingTo("200");
    }
    @Test void konexAndEtfDoNotInheritCommonStockRate() {
        assertThat(quote(holding("KONEX",Currency.KRW,InvestmentAssetClass.DOMESTIC_STOCK),"2026-10-20","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isEqualByComparingTo("100");
        assertThat(quote(holding("KRX",Currency.KRW,InvestmentAssetClass.INDEX_ETF),"2026-10-20","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isZero();
    }
    @Test void unknownProductMarketOrYearDoesNotSilentlyBecomeZeroTax() {
        assertThat(quote(holding("OTC",Currency.KRW,InvestmentAssetClass.DOMESTIC_STOCK),"2026-10-20","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isNull();
        assertThat(quote(holding("KRX",Currency.KRW,InvestmentAssetClass.DIVIDEND_ASSET),"2026-10-20","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isNull();
        assertThat(quote(holding("KRX",Currency.KRW,InvestmentAssetClass.DOMESTIC_STOCK),"2027-01-01","KR",InvestmentTaxTreatment.ANNUAL,"100000").automaticTax()).isNull();
    }
    @Test void japanUsesProfitAfterFeeAndKeepsEstimateSeparateFromCash() {
        var h=holding("TSE",Currency.JPY,InvestmentAssetClass.FOREIGN_STOCK);
        var q=SaleTaxRules.quote(h,LocalDate.parse("2026-10-20"),"JP",InvestmentTaxTreatment.WITHHOLDING,BigDecimal.ONE,new BigDecimal("2100"),new BigDecimal("100"));
        assertThat(q.automaticTax()).isZero();assertThat(q.estimatedIncomeTax()).isEqualByComparingTo("203");
        assertThat(quote(h,"2026-10-20","JP",InvestmentTaxTreatment.WITHHOLDING,"900").estimatedIncomeTax()).isZero();
        assertThat(quote(h,"2026-10-20","JP",InvestmentTaxTreatment.NISA,"2100").estimatedIncomeTax()).isZero();
        assertThat(quote(h,"2026-10-20","KR",InvestmentTaxTreatment.ANNUAL,"2100").estimatedIncomeTax()).isNull();
    }
}
