package com.dm.travel_planner.domain.ledger.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FixedExpenseApplyRequest {

    @NotNull(message = "반영할 결제 예정일은 필수입니다.")
    private LocalDate expectedPaymentDate;
}
