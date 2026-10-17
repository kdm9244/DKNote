package com.dm.travel_planner.domain.ledger.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BalanceAdjustmentRequest {

    @NotNull(message = "실제 잔액은 필수 항목입니다.")
    private BigDecimal actualBalance;

    @NotBlank(message = "잔액 조정 이유를 입력해 주세요.")
    @Size(max = 100, message = "조정 이유는 100자 이내로 입력해 주세요.")
    private String reason;

    @Size(max = 500, message = "메모는 500자 이내로 입력해 주세요.")
    private String memo;
}
