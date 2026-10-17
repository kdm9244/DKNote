package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_target_allocations", uniqueConstraints = {
        @UniqueConstraint(name = "uk_investment_target_account_asset", columnNames = {"account_id", "asset_class"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentTargetAllocation {
    @Id
    @Column(name = "target_allocation_id", length = 50)
    private String targetAllocationId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_targets_user"))
    private User user;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_targets_account"))
    private Account account;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", nullable = false, length = 30)
    private InvestmentAssetClass assetClass;

    @Column(name = "target_ratio", nullable = false, precision = 5, scale = 2)
    private BigDecimal targetRatio;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (targetAllocationId == null) targetAllocationId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void updateRatio(BigDecimal ratio) {
        targetRatio = ratio;
    }
}
