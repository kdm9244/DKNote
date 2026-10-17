package com.dm.travel_planner.domain.ledger.foreign.dto;

import com.dm.travel_planner.domain.ledger.dto.AccountResponse;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.foreign.entity.ForeignTransactionType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ForeignCurrencyDetailResponse(
        AccountResponse account,
        Summary summary,
        MonthlyFlow monthlyFlow,
        List<RateQuote> rates,
        List<WalletSummary> wallets,
        List<TransactionItem> transactions
) {
    public record Summary(
            BigDecimal foreignBalance,
            BigDecimal averageAcquisitionRate,
            BigDecimal acquisitionCostKrw,
            BigDecimal currentExchangeRate,
            BigDecimal valuationKrw,
            BigDecimal unrealizedExchangeProfit,
            BigDecimal unrealizedReturnRate,
            boolean costBasisComplete,
            LocalDateTime rateUpdatedAt,
            String rateProvider
    ) {}

    public record MonthlyFlow(BigDecimal deposits, BigDecimal withdrawals, BigDecimal realizedExchangeProfit) {}

    public record WalletSummary(
            Currency currency,
            BigDecimal balance,
            BigDecimal averageAcquisitionRate,
            BigDecimal acquisitionCostKrw,
            BigDecimal currentExchangeRate,
            BigDecimal valuationKrw,
            BigDecimal unrealizedExchangeProfit,
            BigDecimal unrealizedReturnRate,
            boolean costBasisComplete
    ) {}

    public record RateQuote(
            Currency baseCurrency,
            Currency quoteCurrency,
            BigDecimal rate,
            BigDecimal previousClose,
            BigDecimal change,
            BigDecimal changePercent,
            LocalDateTime quotedAt,
            String provider
    ) {}

    public record TransactionItem(
            String transactionId,
            LocalDateTime transactionDate,
            ForeignTransactionType transactionType,
            String purpose,
            String title,
            BigDecimal amount,
            Currency currency,
            BigDecimal exchangeRate,
            Currency exchangeRateCurrency,
            BigDecimal krwExchangeRate,
            BigDecimal krwAmount,
            BigDecimal feeKrw,
            BigDecimal removedCostKrw,
            BigDecimal realizedExchangeProfit,
            String memo
    ) {}
}
