package com.dm.travel_planner.domain.ledger.planning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "monthly_financial_plans",
        uniqueConstraints = @UniqueConstraint(name = "uk_monthly_plan_user_month", columnNames = {"user_id", "target_month"}))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MonthlyFinancialPlan {
    @Id
    @Column(name = "plan_id", length = 50)
    private String planId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "target_month", nullable = false, length = 7)
    private String targetMonth;

    @Column(name = "expected_income", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal expectedIncome = BigDecimal.ZERO;

    @Column(name = "savings_target", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal savingsTarget = BigDecimal.ZERO;

    @Column(name = "investment_target", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal investmentTarget = BigDecimal.ZERO;

    @Column(name = "debt_repayment_target", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal debtRepaymentTarget = BigDecimal.ZERO;

    @Column(name = "memo", length = 1000)
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (planId == null) planId = UUID.randomUUID().toString().replace("-", "");
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void update(BigDecimal expectedIncome, BigDecimal savingsTarget,
                       BigDecimal investmentTarget, BigDecimal debtRepaymentTarget, String memo) {
        this.expectedIncome = nonNegative(expectedIncome);
        this.savingsTarget = nonNegative(savingsTarget);
        this.investmentTarget = nonNegative(investmentTarget);
        this.debtRepaymentTarget = nonNegative(debtRepaymentTarget);
        this.memo = memo == null || memo.isBlank() ? null : memo.trim();
    }

    private BigDecimal nonNegative(BigDecimal value) {
        return value == null || value.signum() < 0 ? BigDecimal.ZERO : value;
    }
}
