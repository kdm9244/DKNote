package com.dm.travel_planner.domain.ledger.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountTransferRequest(
        @NotBlank String sourceAccountId,
        @NotBlank String destinationAccountId,
        @NotNull @Positive BigDecimal amount,
        @PositiveOrZero BigDecimal destinationAmount,
        @PositiveOrZero BigDecimal exchangeRate,
        @PositiveOrZero BigDecimal feeAmount,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm[:ss[.SSS]]") LocalDateTime transferredAt,
        String memo
) {
    public AccountTransferRequest(String sourceAccountId, String destinationAccountId, BigDecimal amount,
                                  BigDecimal feeAmount, LocalDateTime transferredAt, String memo) {
        this(sourceAccountId, destinationAccountId, amount, null, null, feeAmount, transferredAt, memo);
    }
}
