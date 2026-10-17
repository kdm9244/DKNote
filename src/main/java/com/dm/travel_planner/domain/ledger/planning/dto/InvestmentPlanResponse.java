package com.dm.travel_planner.domain.ledger.planning.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record InvestmentPlanResponse(
        String investmentPlanId,
        String title,
        String investmentAccountId,
        String investmentAccountName,
        Currency accountCurrency,
        String sourceAccountId,
        String sourceAccountName,
        BigDecimal monthlyAmount,
        BigDecimal targetAmount,
        BigDecimal monthlyActualAmount,
        BigDecimal cumulativeInvestedAmount,
        BigDecimal monthlyExecutionRate,
        BigDecimal targetProgressRate,
        LocalDate startDate,
        LocalDate targetDate,
        Integer executionDay,
        LocalDate nextExecutionDate,
        String status,
        String memo,
        List<Item> items
) {
    public record Item(
            String investmentPlanItemId,
            String investmentId,
            String tickerCode,
            String symbolName,
            String market,
            Currency quoteCurrency,
            InvestmentAssetClass assetClass,
            BigDecimal targetRatio,
            BigDecimal plannedAmount,
            BigDecimal monthlyActualAmount,
            BigDecimal cumulativeInvestedAmount,
            BigDecimal referencePrice,
            BigDecimal exchangeRate,
            BigDecimal expectedQuantity,
            LocalDateTime priceQuotedAt
    ) {}
}
