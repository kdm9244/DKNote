package com.dm.travel_planner.domain.ledger.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "account_transfers", indexes = {
        @Index(name = "idx_account_transfer_user_date", columnList = "user_id,transferred_at"),
        @Index(name = "idx_account_transfer_source", columnList = "source_account_id"),
        @Index(name = "idx_account_transfer_destination", columnList = "destination_account_id")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountTransfer {
    @Id
    @Column(name = "transfer_id", length = 50)
    private String transferId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "source_account_id", nullable = false, length = 50)
    private String sourceAccountId;

    @Column(name = "destination_account_id", nullable = false, length = 50)
    private String destinationAccountId;

    @Column(name = "source_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal sourceAmount;

    @Column(name = "destination_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal destinationAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_currency", nullable = false, length = 3)
    private Currency sourceCurrency;

    @Enumerated(EnumType.STRING)
    @Column(name = "destination_currency", nullable = false, length = 3)
    private Currency destinationCurrency;

    @Column(name = "exchange_rate", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal exchangeRate = BigDecimal.ONE;

    @Column(name = "fee_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal feeAmount = BigDecimal.ZERO;

    @Column(name = "transferred_at", nullable = false)
    private LocalDateTime transferredAt;

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "COMPLETED";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (transferId == null) transferId = UUID.randomUUID().toString().replace("-", "");
        if (transferredAt == null) transferredAt = LocalDateTime.now();
        if (exchangeRate == null) exchangeRate = BigDecimal.ONE;
        if (feeAmount == null) feeAmount = BigDecimal.ZERO;
        if (status == null) status = "COMPLETED";
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
