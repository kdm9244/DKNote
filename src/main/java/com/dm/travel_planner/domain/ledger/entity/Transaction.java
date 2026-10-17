package com.dm.travel_planner.domain.ledger.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @Column(name = "transaction_id", length = 50)
    private String transactionId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "account_id", length = 50)
    private String accountId;

    @Column(name = "transaction_date", nullable = false)
    private LocalDateTime transactionDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 30)
    private TransactionType transactionType;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "category_id", length = 50)
    private String categoryId;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "base_currency_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal baseCurrencyAmount = BigDecimal.ZERO;

    @Column(name = "exchange_rate", precision = 18, scale = 8)
    @Builder.Default
    private BigDecimal exchangeRate = BigDecimal.ONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private Currency currency = Currency.KRW;

    @Column(name = "status", length = 30)
    @Builder.Default
    private String status = "CONFIRMED";

    @Column(name = "payment_method", length = 50)
    @Builder.Default
    private String paymentMethod = "ACCOUNT_TRANSFER";

    @Column(name = "memo")
    private String memo;

    @Column(name = "is_fixed_expense", nullable = false)
    @Builder.Default
    private Boolean isFixedExpense = false;

    @Column(name = "reconciliation_id", length = 50)
    private String reconciliationId;

    @Column(name = "transfer_id", length = 50)
    private String transferId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_direction", length = 10)
    private TransferDirection transferDirection;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.transactionId == null) {
            this.transactionId = UUID.randomUUID().toString().replace("-", "");
        }
        if (this.transactionDate == null) {
            this.transactionDate = LocalDateTime.now();
        }
        if (this.baseCurrencyAmount == null || this.baseCurrencyAmount.compareTo(BigDecimal.ZERO) == 0) {
            this.baseCurrencyAmount = this.amount != null ? this.amount : BigDecimal.ZERO;
        }
        if (this.exchangeRate == null) {
            this.exchangeRate = BigDecimal.ONE;
        }
        if (this.status == null) {
            this.status = "CONFIRMED";
        }
        if (this.paymentMethod == null) {
            this.paymentMethod = "ACCOUNT_TRANSFER";
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // 거래 내역 수정 메서드
    public void updateTransaction(String title, BigDecimal amount, TransactionType transactionType,
                                   String categoryLabel, LocalDateTime transactionDate, String memo) {
        if (title != null && !title.isBlank()) this.title = title;
        if (transactionType != null) this.transactionType = transactionType;
        if (amount != null) {
            this.amount = amount;
            this.baseCurrencyAmount = amount;
        }
        if (transactionDate != null) this.transactionDate = transactionDate;
        if (categoryLabel != null && !categoryLabel.isBlank()) {
            this.categoryId = categoryLabel;
        }
        String currentMemo = memo != null ? memo : (this.memo != null ? this.memo : "");
        String cleanMemo = currentMemo.replaceFirst("^\\[.*?\\]\\s*", "").trim();
        String cat = (this.categoryId != null && !this.categoryId.isBlank()) ? this.categoryId : "기타";
        this.memo = cleanMemo.isBlank() ? "[" + cat + "]" : "[" + cat + "] " + cleanMemo;
    }
}
