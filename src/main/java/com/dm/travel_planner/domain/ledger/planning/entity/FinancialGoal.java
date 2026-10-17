package com.dm.travel_planner.domain.ledger.planning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "wishlists")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FinancialGoal {
    @Id
    @Column(name = "wish_id", length = 50)
    private String goalId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "linked_account_id", length = 50)
    private String linkedAccountId;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "goal_type", nullable = false, length = 30)
    @Builder.Default
    private String goalType = "WISH";

    @Column(name = "target_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "current_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal currentAmount = BigDecimal.ZERO;

    @Column(name = "monthly_target_amount", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal monthlyTargetAmount = BigDecimal.ZERO;

    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private String currency = "KRW";

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "priority", nullable = false)
    @Builder.Default
    private Integer priority = 1;

    @Column(name = "icon_color", length = 20)
    @Builder.Default
    private String iconColor = "GREEN";

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "IN_PROGRESS";

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (goalId == null) goalId = UUID.randomUUID().toString().replace("-", "");
        if (currentAmount == null) currentAmount = BigDecimal.ZERO;
        if (monthlyTargetAmount == null) monthlyTargetAmount = BigDecimal.ZERO;
        if (createdAt == null) createdAt = LocalDateTime.now();
        updateCompletion();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() {
        updateCompletion();
        updatedAt = LocalDateTime.now();
    }

    public void update(String title, String description, String goalType, BigDecimal targetAmount,
                       BigDecimal monthlyTargetAmount, LocalDate targetDate, Integer priority,
                       String linkedAccountId, String iconColor) {
        this.title = title.trim();
        this.description = description == null || description.isBlank() ? null : description.trim();
        this.goalType = goalType;
        this.targetAmount = targetAmount;
        this.monthlyTargetAmount = monthlyTargetAmount == null ? BigDecimal.ZERO : monthlyTargetAmount;
        this.targetDate = targetDate;
        this.priority = priority == null ? 1 : priority;
        this.linkedAccountId = linkedAccountId == null || linkedAccountId.isBlank() ? null : linkedAccountId;
        this.iconColor = iconColor == null || iconColor.isBlank() ? "GREEN" : iconColor;
        updateCompletion();
    }

    public void addContribution(BigDecimal amount) {
        currentAmount = currentAmount.add(amount);
        updateCompletion();
    }

    public void archive() { status = "ARCHIVED"; }

    private void updateCompletion() {
        if (!"ARCHIVED".equals(status) && targetAmount != null && currentAmount != null
                && currentAmount.compareTo(targetAmount) >= 0) {
            status = "COMPLETED";
            if (completedAt == null) completedAt = LocalDateTime.now();
        } else if ("COMPLETED".equals(status) && targetAmount != null && currentAmount.compareTo(targetAmount) < 0) {
            status = "IN_PROGRESS";
            completedAt = null;
        }
    }
}
