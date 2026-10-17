package com.dm.travel_planner.domain.budget.entity;

import com.dm.travel_planner.domain.trip.entity.Trip;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 개인 여행의 실제 지출
 */
@Entity
@Table(name = "budget_items")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class BudgetItem {

    @Id
    @Column(name = "budget_id", length = 50)
    private String budgetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(name = "category", nullable = false, length = 50)
    private String category; // "MEAL", "HOTEL", "TRANSPORT", "SPOT", "SHOPPING", "MEETING", "OTHER"

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private java.math.BigDecimal amount; // 지출 금액

    @Column(name = "currency", nullable = false, length = 10)
    @Builder.Default
    private String currency = "KRW"; // "KRW", "JPY", "USD"

    @Column(name = "payment_method", length = 50)
    @Builder.Default
    private String paymentMethod = "CASH"; // "CASH", "PERSONAL_CARD", "OTHER"


    @Column(name = "expense_date")
    private LocalDate expenseDate;

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo;

    @Version @Builder.Default private long version = 0;
    @Column(name = "fx_rate", precision = 18, scale = 6) private java.math.BigDecimal fxRate;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.budgetId == null) {
            this.budgetId = UUID.randomUUID().toString().replace("-", "");
        }
    }
}
