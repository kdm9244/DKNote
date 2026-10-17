package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FixedExpenseCreateRequest {

    @NotBlank(message = "고정지출 명칭은 필수 입력 항목입니다.")
    private String title;

    @NotNull(message = "결제 금액은 필수 입력 항목입니다.")
    @Positive(message = "결제 금액은 0보다 커야 합니다.")
    private BigDecimal amount;

    @Builder.Default
    private Currency currency = Currency.KRW;

    @Min(value = 1, message = "결제일은 1일 이상이어야 합니다.")
    @Max(value = 31, message = "결제일은 31일 이하여야 합니다.")
    private Integer paymentDayOfMonth;

    private LocalDate nextPaymentDate;

    private String accountId;
}
