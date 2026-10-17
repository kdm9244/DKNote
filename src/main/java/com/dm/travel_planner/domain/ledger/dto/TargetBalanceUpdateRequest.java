package com.dm.travel_planner.domain.ledger.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TargetBalanceUpdateRequest {

    @NotNull(message = "목표 저축 금액은 필수 입력 항목입니다.")
    @PositiveOrZero(message = "목표 금액은 0 이상이어야 합니다.")
    private BigDecimal targetBalance;
}
