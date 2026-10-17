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
@Table(name = "reconciliations")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReconciliationLog {

    @Id
    @Column(name = "reconciliation_id", length = 50)
    private String reconciliationId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @Column(name = "book_balance", nullable = false, precision = 18, scale = 2)
    private BigDecimal bookBalance;

    @Column(name = "actual_balance", nullable = false, precision = 18, scale = 2)
    private BigDecimal actualBalance;

    @Column(name = "diff_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal diffAmount;

    @Column(name = "reason_code", nullable = false, length = 30)
    @Builder.Default
    private String reasonCode = "RECONCILE_CHECK";

    @Column(name = "memo")
    private String memo;

    @Column(name = "reconciled_at", nullable = false)
    @Builder.Default
    private LocalDateTime reconciledAt = LocalDateTime.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.reconciliationId == null) {
            this.reconciliationId = UUID.randomUUID().toString().replace("-", "");
        }
        if (this.reconciledAt == null) {
            this.reconciledAt = LocalDateTime.now();
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }
}
