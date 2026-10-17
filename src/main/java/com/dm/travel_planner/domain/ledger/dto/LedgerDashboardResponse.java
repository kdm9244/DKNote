package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public record LedgerDashboardResponse(
        String month,
        LocalDateTime generatedAt,
        Map<Currency, BigDecimal> monthlyIncome,
        Map<Currency, BigDecimal> monthlyExpense,
        Map<Currency, BigDecimal> monthlyNetCashFlow,
        List<CategorySpending> categorySpending,
        List<RecentTransaction> recentTransactions,
        InvestmentOverview investment,
        DebtOverview debt
) {
    public record CategorySpending(
            String category,
            Currency currency,
            BigDecimal amount,
            BigDecimal ratio
    ) {}

    public record RecentTransaction(
            String transactionId,
            String accountId,
            String accountName,
            LocalDateTime transactionDate,
            TransactionType transactionType,
            String title,
            String category,
            BigDecimal amount,
            Currency currency
    ) {}

    public record InvestmentOverview(
            int accountCount,
            int holdingCount,
            int stalePriceCount,
            List<InvestmentCurrencySummary> totals,
            List<InvestmentAccountSummary> accounts,
            List<InvestmentHoldingSummary> holdings,
            List<InvestmentAllocation> allocations,
            List<RecentInvestmentTrade> recentTrades
    ) {}

    public record InvestmentCurrencySummary(
            Currency currency,
            BigDecimal totalAsset,
            BigDecimal marketValue,
            BigDecimal investedPrincipal,
            BigDecimal cashBalance,
            BigDecimal unrealizedProfitLoss,
            BigDecimal returnRate,
            BigDecimal monthlyDividend
    ) {}

    public record InvestmentAccountSummary(
            String accountId,
            String accountName,
            String bankName,
            Currency currency,
            BigDecimal totalAsset,
            BigDecimal investedPrincipal,
            BigDecimal unrealizedProfitLoss,
            BigDecimal returnRate,
            BigDecimal cashBalance,
            int holdingCount,
            LocalDateTime lastPriceUpdatedAt
    ) {}

    public record InvestmentHoldingSummary(
            String investmentId,
            String accountId,
            String accountName,
            String tickerCode,
            String symbolName,
            InvestmentAssetClass assetClass,
            String market,
            Currency quoteCurrency,
            Currency accountCurrency,
            BigDecimal quantity,
            BigDecimal currentPrice,
            BigDecimal marketValue,
            BigDecimal profitLoss,
            BigDecimal returnRate,
            LocalDateTime priceUpdatedAt
    ) {}

    public record InvestmentAllocation(
            Currency currency,
            InvestmentAssetClass assetClass,
            BigDecimal amount,
            BigDecimal ratio
    ) {}

    public record RecentInvestmentTrade(
            String transactionId,
            String accountId,
            String accountName,
            String symbolName,
            InvestmentTradeType tradeType,
            LocalDateTime tradeDate,
            BigDecimal netAmount,
            Currency accountCurrency
    ) {}

    public record DebtOverview(
            int accountCount,
            List<DebtCurrencySummary> totals,
            List<DebtAccountSummary> accounts,
            List<RecentTransaction> recentTransactions
    ) {}

    public record DebtCurrencySummary(
            Currency currency,
            BigDecimal outstandingDebt,
            BigDecimal monthlyRepayment,
            BigDecimal monthlyBorrowing,
            BigDecimal plannedMonthlyPayment,
            BigDecimal estimatedMonthlyInterest,
            BigDecimal weightedAverageRate
    ) {}

    public record DebtAccountSummary(
            String accountId,
            String accountName,
            String bankName,
            String accountPurpose,
            Currency currency,
            BigDecimal outstandingDebt,
            BigDecimal interestRate,
            BigDecimal monthlyPayment,
            LocalDate maturityDate,
            BigDecimal estimatedMonthlyInterest
    ) {}
}
