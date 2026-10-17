package com.dm.travel_planner.domain.ledger.planning.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_plan_items", indexes = {
        @Index(name = "idx_investment_plan_items_plan", columnList = "investment_plan_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_investment_plan_item_ticker", columnNames = {"investment_plan_id", "ticker_code"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentPlanItem {
    @Id
    @Column(name = "investment_plan_item_id", length = 50)
    private String investmentPlanItemId;

    @Column(name = "investment_plan_id", nullable = false, length = 50)
    private String investmentPlanId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_plan_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_plan_items_plan"))
    private InvestmentPlan investmentPlan;

    @Column(name = "investment_id", length = 50)
    private String investmentId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_plan_items_investment"))
    private Investment investment;

    @Column(name = "ticker_code", nullable = false, length = 20)
    private String tickerCode;

    @Column(name = "symbol_name", nullable = false, length = 100)
    private String symbolName;

    @Column(name = "market", length = 30)
    private String market;

    @Enumerated(EnumType.STRING)
    @Column(name = "quote_currency", nullable = false, length = 3)
    private Currency quoteCurrency;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", nullable = false, length = 30)
    private InvestmentAssetClass assetClass;

    @Column(name = "target_ratio", nullable = false, precision = 7, scale = 3)
    private BigDecimal targetRatio;

    @Column(name = "reference_price", nullable = false, precision = 18, scale = 4)
    private BigDecimal referencePrice;

    @Column(name = "exchange_rate", nullable = false, precision = 20, scale = 8)
    private BigDecimal exchangeRate;

    @Column(name = "price_quoted_at")
    private LocalDateTime priceQuotedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (investmentPlanItemId == null) investmentPlanItemId = UUID.randomUUID().toString().replace("-", "");
        if (referencePrice == null) referencePrice = BigDecimal.ZERO;
        if (exchangeRate == null) exchangeRate = BigDecimal.ONE;
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
