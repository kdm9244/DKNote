package com.dm.travel_planner.domain.ledger.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountBalanceReconcileRequest {

    @NotNull(message = "실제 잔액 금액은 필수입니다.")
    private BigDecimal actualBalance;
}
