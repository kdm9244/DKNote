package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.dto.AccountResponse;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentSyncStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record InvestmentDetailResponse(
        AccountResponse account,
        Profile profile,
        Summary summary,
        List<Holding> holdings,
        List<Allocation> allocations,
        List<TargetAllocation> targetAllocations,
        List<TrendPoint> recentTrend,
        List<InvestmentTransactionResponse> recentTransactions,
        Performance performance,
        List<RebalancingAlert> alerts,
        List<Note> notes
) {
    public record Profile(Boolean primary, Boolean autoSyncEnabled, InvestmentSyncStatus syncStatus,
                          String syncProvider, LocalDateTime lastSyncedAt) {
    }

    public record Summary(BigDecimal totalAssetValue, BigDecimal investedPrincipal,
                          BigDecimal evaluationProfitLoss, BigDecimal returnRate,
                          BigDecimal cashBalance, BigDecimal monthlyDividend) {
    }

    public record Holding(String investmentId, String tickerCode, String symbolName,
                          InvestmentAssetClass assetClass, String market, Currency currency,
                          BigDecimal quantity, BigDecimal averageBuyPrice, BigDecimal averageBuyPriceBase,
                          BigDecimal currentPrice, BigDecimal exchangeRate,
                          BigDecimal evaluationAmountLocal, BigDecimal profitLossLocal,
                          BigDecimal evaluationAmount, BigDecimal profitLoss, BigDecimal returnRate,
                          BigDecimal weight, LocalDateTime priceUpdatedAt) {
    }

    public record Allocation(InvestmentAssetClass assetClass, BigDecimal amount, BigDecimal ratio) {
    }

    public record TargetAllocation(InvestmentAssetClass assetClass, BigDecimal targetRatio,
                                   BigDecimal currentRatio, BigDecimal difference) {
    }

    public record TrendPoint(LocalDate date, BigDecimal totalAssetValue) {
    }

    public record Performance(BigDecimal monthlyReturnRate, BigDecimal annualizedReturnRate,
                              BigDecimal realizedProfitLoss, BigDecimal unrealizedProfitLoss,
                              BigDecimal dividendIncome) {
    }

    public record RebalancingAlert(InvestmentAssetClass assetClass, String title,
                                   String description, BigDecimal difference) {
    }

    public record Note(String noteId, String title, String content, Boolean pinned,
                       LocalDateTime updatedAt) {
    }
}
