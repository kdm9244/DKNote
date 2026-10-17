package com.dm.travel_planner.domain.ledger.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuickTransactionRequest {

    @NotNull(message = "거래 금액은 필수 입력 항목입니다.")
    @Positive(message = "거래 금액은 0보다 커야 합니다.")
    private BigDecimal amount;

    @NotNull(message = "수입/지출 여부는 필수 선택 항목입니다.")
    private Boolean isIncome;

    private String category;

    private String description;
}
