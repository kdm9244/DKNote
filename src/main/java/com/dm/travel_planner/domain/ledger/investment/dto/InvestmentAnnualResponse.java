package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record InvestmentAnnualResponse(int year,Currency baseCurrency,InvestmentTaxAccountType taxAccountType,
        BigDecimal realizedBeforeTax,BigDecimal realizedAfterTax,List<CurrencyTotals> currencies,List<Trade> trades) {
    public record CurrencyTotals(Currency currency,BigDecimal purchases,BigDecimal sales,BigDecimal dividends,BigDecimal fees,
            BigDecimal taxes,Map<InvestmentTaxKind,BigDecimal> taxBreakdown) {}
    public record Trade(String symbolName,String market,InvestmentTransactionResponse transaction) {}
}
