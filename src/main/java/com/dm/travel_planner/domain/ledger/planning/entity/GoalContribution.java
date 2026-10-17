package com.dm.travel_planner.domain.ledger.planning.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "goal_contributions")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoalContribution {
    @Id
    @Column(name = "contribution_id", length = 50)
    private String contributionId;

    @Column(name = "goal_id", nullable = false, length = 50)
    private String goalId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "source_account_id", length = 50)
    private String sourceAccountId;

    @Column(name = "transfer_id", length = 50)
    private String transferId;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "contributed_at", nullable = false)
    private LocalDateTime contributedAt;

    @Column(name = "memo", length = 500)
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (contributionId == null) contributionId = UUID.randomUUID().toString().replace("-", "");
        if (contributedAt == null) contributedAt = LocalDateTime.now();
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
