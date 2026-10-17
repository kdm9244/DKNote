package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_transactions", indexes = {
        @Index(name = "idx_investment_tx_investment_date", columnList = "investment_id,trade_date"),
        @Index(name = "idx_investment_tx_trade_type", columnList = "trade_type")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentTransaction {
    @Id
    @Column(name = "investment_transaction_id", length = 50)
    private String investmentTransactionId;

    @Column(name = "investment_id", nullable = false, length = 50)
    private String investmentId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_transactions_investment"))
    private Investment investment;

    @Column(name = "transaction_id", length = 50)
    private String transactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_type", nullable = false, length = 20)
    private InvestmentTradeType tradeType;

    @Column(name = "trade_date", nullable = false)
    private LocalDateTime tradeDate;

    @Column(name = "quantity", nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(name = "unit_price", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "gross_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal grossAmount = BigDecimal.ZERO;

    @Column(name = "fee_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal feeAmount = BigDecimal.ZERO;

    @Column(name = "tax_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal taxAmount = BigDecimal.ZERO;

    @Column(name = "net_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal netAmount = BigDecimal.ZERO;

    @Column(name = "realized_profit_loss", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal realizedProfitLoss = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private Currency currency = Currency.KRW;

    @Column(name = "exchange_rate", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal exchangeRate = BigDecimal.ONE;

    @Column(name = "external_transaction_key", length = 100, unique = true)
    private String externalTransactionKey;

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (investmentTransactionId == null) investmentTransactionId = UUID.randomUUID().toString().replace("-", "");
        if (tradeDate == null) tradeDate = LocalDateTime.now();
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
