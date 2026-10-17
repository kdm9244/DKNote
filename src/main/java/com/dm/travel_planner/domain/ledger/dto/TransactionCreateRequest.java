package com.dm.travel_planner.domain.ledger.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransactionCreateRequest {

    @NotBlank(message = "계좌 ID는 필수 항목입니다.")
    private String accountId;

    @NotNull(message = "거래 금액은 필수 항목입니다.")
    @Positive(message = "거래 금액은 0보다 커야 합니다.")
    private BigDecimal amount;

    @NotNull(message = "거래 유형(수입/지출)은 필수 선택 항목입니다.")
    private TransactionType transactionType;

    @NotBlank(message = "거래처/제목은 필수 입력 항목입니다.")
    private String title;

    private String categoryId;

    @Builder.Default
    private Currency currency = Currency.KRW;

    private String memo;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm[:ss[.SSS]]")
    private LocalDateTime transactionDate;
}
