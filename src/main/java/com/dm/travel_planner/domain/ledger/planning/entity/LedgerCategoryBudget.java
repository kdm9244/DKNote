package com.dm.travel_planner.domain.ledger.planning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "budgets",
        uniqueConstraints = @UniqueConstraint(name = "uk_budgets_user_month_category_name",
                columnNames = {"user_id", "target_month", "category_name"}))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LedgerCategoryBudget {
    @Id
    @Column(name = "budget_id", length = 50)
    private String budgetId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "target_month", nullable = false, length = 7)
    private String targetMonth;

    @Column(name = "category_id", length = 50)
    private String categoryId;

    @Column(name = "category_name", nullable = false, length = 50)
    private String categoryName;

    @Column(name = "budget_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal budgetAmount;

    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private String currency = "KRW";

    @Column(name = "rollover_setting", nullable = false, length = 30)
    @Builder.Default
    private String rolloverSetting = "NONE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (budgetId == null) budgetId = UUID.randomUUID().toString().replace("-", "");
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
