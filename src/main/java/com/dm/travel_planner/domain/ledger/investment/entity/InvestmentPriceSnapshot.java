package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_price_snapshots", indexes = {
        @Index(name = "idx_investment_price_investment_quoted", columnList = "investment_id,quoted_at")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentPriceSnapshot {
    @Id
    @Column(name = "price_snapshot_id", length = 50)
    private String priceSnapshotId;

    @Column(name = "investment_id", nullable = false, length = 50)
    private String investmentId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_prices_investment"))
    private Investment investment;

    @Column(name = "price", nullable = false, precision = 18, scale = 4)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    private Currency currency;

    @Column(name = "exchange_rate", nullable = false, precision = 20, scale = 8)
    private BigDecimal exchangeRate;

    @Column(name = "source", nullable = false, length = 30)
    private String source;

    @Column(name = "quoted_at", nullable = false)
    private LocalDateTime quotedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (priceSnapshotId == null) priceSnapshotId = UUID.randomUUID().toString().replace("-", "");
        if (quotedAt == null) quotedAt = LocalDateTime.now();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
