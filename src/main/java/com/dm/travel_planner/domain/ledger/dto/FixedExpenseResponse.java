package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.FixedExpense;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class FixedExpenseResponse {

    private String fixedExpenseId;
    private String userId;
    private String title;
    private BigDecimal amount;
    private Currency currency;
    private Integer paymentDayOfMonth;
    private LocalDate nextPaymentDate;
    private String accountId;
    private Boolean isActive;
    private LocalDateTime createdAt;

    public static FixedExpenseResponse from(FixedExpense entity) {
        return FixedExpenseResponse.builder()
                .fixedExpenseId(entity.getFixedExpenseId())
                .userId(entity.getUserId())
                .title(entity.getTitle())
                .amount(entity.getAmount())
                .currency(entity.getCurrency())
                .paymentDayOfMonth(entity.getPaymentDayOfMonth())
                .nextPaymentDate(entity.getNextPaymentDate())
                .accountId(entity.getAccountId())
                .isActive(entity.getIsActive())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
