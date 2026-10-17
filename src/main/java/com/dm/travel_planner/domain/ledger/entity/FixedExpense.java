package com.dm.travel_planner.domain.ledger.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.UUID;

@Entity
@Table(name = "fixed_expenses")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FixedExpense {

    @Id
    @Column(name = "fixed_expense_id", length = 50)
    private String fixedExpenseId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private Currency currency = Currency.KRW;

    @Column(name = "payment_day_of_month")
    private Integer paymentDayOfMonth;

    @Column(name = "start_date", nullable = false)
    @Builder.Default
    private LocalDate startDate = LocalDate.now();

    @Column(name = "next_payment_date", nullable = false)
    private LocalDate nextPaymentDate;

    @Column(name = "account_id", length = 50)
    private String accountId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.fixedExpenseId == null) {
            this.fixedExpenseId = UUID.randomUUID().toString().replace("-", "");
        }
        if (this.nextPaymentDate == null) {
            this.nextPaymentDate = LocalDate.now();
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

    public void deactivate() {
        this.isActive = false;
    }

    public void advanceNextPaymentDate() {
        LocalDate current = this.nextPaymentDate != null ? this.nextPaymentDate : LocalDate.now();
        YearMonth nextMonth = YearMonth.from(current).plusMonths(1);
        int requestedDay = this.paymentDayOfMonth != null ? this.paymentDayOfMonth : current.getDayOfMonth();
        this.nextPaymentDate = nextMonth.atDay(Math.min(requestedDay, nextMonth.lengthOfMonth()));
    }

    public void updateSchedule(String title, BigDecimal amount, LocalDate nextPaymentDate, Integer paymentDayOfMonth) {
        this.title = title.trim();
        this.amount = amount;
        this.nextPaymentDate = nextPaymentDate;
        this.paymentDayOfMonth = paymentDayOfMonth != null
                ? paymentDayOfMonth
                : nextPaymentDate.getDayOfMonth();
    }
}
