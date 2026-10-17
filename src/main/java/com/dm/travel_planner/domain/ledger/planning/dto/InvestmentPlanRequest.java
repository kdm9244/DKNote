package com.dm.travel_planner.domain.ledger.planning.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record InvestmentPlanRequest(
        @NotBlank String title,
        @NotBlank String investmentAccountId,
        String sourceAccountId,
        @NotNull @Positive BigDecimal monthlyAmount,
        @NotNull @Positive BigDecimal targetAmount,
        @NotNull LocalDate startDate,
        LocalDate targetDate,
        @NotNull @Min(1) @Max(31) Integer executionDay,
        String status,
        String memo,
        @NotEmpty List<@Valid Item> items
) {
    public record Item(
            String investmentId,
            @NotBlank String tickerCode,
            @NotBlank String symbolName,
            String market,
            @NotNull Currency quoteCurrency,
            @NotNull InvestmentAssetClass assetClass,
            @NotNull @DecimalMin("0.001") @DecimalMax("100.000") BigDecimal targetRatio,
            @PositiveOrZero BigDecimal referencePrice,
            @Positive BigDecimal exchangeRate,
            LocalDateTime priceQuotedAt
    ) {}
}
