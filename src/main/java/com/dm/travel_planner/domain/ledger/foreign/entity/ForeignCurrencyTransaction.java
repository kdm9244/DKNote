package com.dm.travel_planner.domain.ledger.foreign.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "foreign_currency_transactions", indexes = {
        @Index(name = "idx_foreign_tx_account_date", columnList = "account_id, transaction_date")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForeignCurrencyTransaction {
    @Id
    @Column(name = "foreign_transaction_id", length = 50)
    private String transactionId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @Column(name = "transaction_date", nullable = false)
    private LocalDateTime transactionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 20)
    private ForeignTransactionType transactionType;

    @Column(name = "purpose", nullable = false, length = 40)
    private String purpose;

    @Column(name = "title", nullable = false, length = 150)
    private String title;

    @Column(name = "amount", nullable = false, precision = 20, scale = 4)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", length = 3)
    private Currency currency;

    @Column(name = "exchange_rate", precision = 18, scale = 8)
    private BigDecimal exchangeRate;

    @Enumerated(EnumType.STRING)
    @Column(name = "exchange_rate_currency", length = 3)
    private Currency exchangeRateCurrency;

    @Column(name = "krw_exchange_rate", precision = 18, scale = 8)
    private BigDecimal krwExchangeRate;

    @Column(name = "fee_krw", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal feeKrw = BigDecimal.ZERO;

    @Column(name = "memo", length = 1000)
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (transactionId == null) transactionId = UUID.randomUUID().toString().replace("-", "");
        if (transactionDate == null) transactionDate = LocalDateTime.now();
        if (feeKrw == null) feeKrw = BigDecimal.ZERO;
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void update(ForeignTransactionType type, String purpose, String title, BigDecimal amount, Currency currency,
                       BigDecimal exchangeRate, Currency exchangeRateCurrency, BigDecimal krwExchangeRate,
                       BigDecimal feeKrw, LocalDateTime transactionDate, String memo) {
        this.transactionType = type;
        this.purpose = purpose;
        this.title = title;
        this.amount = amount;
        this.currency = currency;
        this.exchangeRate = exchangeRate;
        this.exchangeRateCurrency = exchangeRateCurrency;
        this.krwExchangeRate = krwExchangeRate;
        this.feeKrw = feeKrw;
        this.transactionDate = transactionDate;
        this.memo = memo;
    }
}
