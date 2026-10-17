package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_account_snapshots", indexes = {
        @Index(name = "idx_investment_account_snapshot_date", columnList = "account_id,snapshot_date")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_investment_account_snapshot_day", columnNames = {"account_id", "snapshot_date"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentAccountSnapshot {
    @Id
    @Column(name = "account_snapshot_id", length = 50)
    private String accountSnapshotId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_snapshots_user"))
    private User user;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_snapshots_account"))
    private Account account;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "total_asset_value", nullable = false, precision = 18, scale = 2)
    private BigDecimal totalAssetValue;

    @Column(name = "invested_principal", nullable = false, precision = 18, scale = 2)
    private BigDecimal investedPrincipal;

    @Column(name = "cash_balance", nullable = false, precision = 18, scale = 2)
    private BigDecimal cashBalance;

    @Column(name = "market_value", nullable = false, precision = 18, scale = 2)
    private BigDecimal marketValue;

    @Column(name = "realized_profit_loss", nullable = false, precision = 18, scale = 2)
    private BigDecimal realizedProfitLoss;

    @Column(name = "unrealized_profit_loss", nullable = false, precision = 18, scale = 2)
    private BigDecimal unrealizedProfitLoss;

    @Column(name = "dividend_income", nullable = false, precision = 18, scale = 2)
    private BigDecimal dividendIncome;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (accountSnapshotId == null) accountSnapshotId = UUID.randomUUID().toString().replace("-", "");
        if (snapshotDate == null) snapshotDate = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void updateValues(BigDecimal totalAssetValue, BigDecimal investedPrincipal,
                             BigDecimal cashBalance, BigDecimal marketValue,
                             BigDecimal realizedProfitLoss, BigDecimal unrealizedProfitLoss,
                             BigDecimal dividendIncome) {
        this.totalAssetValue = totalAssetValue;
        this.investedPrincipal = investedPrincipal;
        this.cashBalance = cashBalance;
        this.marketValue = marketValue;
        this.realizedProfitLoss = realizedProfitLoss;
        this.unrealizedProfitLoss = unrealizedProfitLoss;
        this.dividendIncome = dividendIncome;
    }
}
