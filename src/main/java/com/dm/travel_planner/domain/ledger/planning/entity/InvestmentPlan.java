package com.dm.travel_planner.domain.ledger.planning.entity;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_plans", indexes = {
        @Index(name = "idx_investment_plans_user_status", columnList = "user_id,status")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentPlan {
    @Id
    @Column(name = "investment_plan_id", length = 50)
    private String investmentPlanId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_plans_user"))
    private User user;

    @Column(name = "investment_account_id", nullable = false, length = 50)
    private String investmentAccountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_plans_account"))
    private Account investmentAccount;

    @Column(name = "source_account_id", length = 50)
    private String sourceAccountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_plans_source_account"))
    private Account sourceAccount;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "monthly_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal monthlyAmount;

    @Column(name = "target_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "execution_day", nullable = false)
    private Integer executionDay;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "memo", columnDefinition = "text")
    private String memo;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (investmentPlanId == null) investmentPlanId = UUID.randomUUID().toString().replace("-", "");
        if (status == null) status = "ACTIVE";
        if (createdAt == null) createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }

    public void update(String investmentAccountId, String sourceAccountId, String title,
                       BigDecimal monthlyAmount, BigDecimal targetAmount, LocalDate startDate,
                       LocalDate targetDate, Integer executionDay, String status, String memo) {
        this.investmentAccountId = investmentAccountId;
        this.sourceAccountId = sourceAccountId;
        this.title = title.trim();
        this.monthlyAmount = monthlyAmount;
        this.targetAmount = targetAmount;
        this.startDate = startDate;
        this.targetDate = targetDate;
        this.executionDay = executionDay;
        this.status = status == null || status.isBlank() ? "ACTIVE" : status;
        this.memo = memo == null || memo.isBlank() ? null : memo.trim();
    }

    public void archive() { status = "ARCHIVED"; }
}
