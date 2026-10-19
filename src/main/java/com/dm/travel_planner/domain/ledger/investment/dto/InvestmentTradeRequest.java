package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvestmentTradeRequest(
        @NotNull InvestmentTradeType tradeType,
        String investmentId,
        String tickerCode,
        String symbolName,
        InvestmentAssetClass assetClass,
        String market,
        @PositiveOrZero BigDecimal quantity,
        @PositiveOrZero BigDecimal unitPrice,
        @PositiveOrZero BigDecimal amount,
        @PositiveOrZero BigDecimal feeAmount,
        @PositiveOrZero BigDecimal taxAmount,
        Boolean applyFeeSettings,
        Currency currency,
        @PositiveOrZero BigDecimal exchangeRate,
        LocalDateTime tradeDate,
        String memo,
        String externalTransactionKey,
        String counterAccountId,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxTreatment taxTreatment,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxKind taxKind
) {
}
