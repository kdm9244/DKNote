package com.dm.travel_planner.domain.ledger.foreign.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.foreign.entity.ForeignTransactionType;
import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ForeignTransactionRequest {
    @NotNull
    private ForeignTransactionType transactionType;

    @NotBlank
    private String purpose;

    @NotBlank
    private String title;

    @NotNull
    @DecimalMin(value = "0.0001")
    private BigDecimal amount;

    @NotNull
    private Currency currency;

    @DecimalMin(value = "0.00000001")
    private BigDecimal exchangeRate;

    private Currency exchangeRateCurrency;

    @DecimalMin(value = "0.00000001")
    private BigDecimal krwExchangeRate;

    @DecimalMin(value = "0")
    private BigDecimal feeKrw;

    @NotNull
    private LocalDateTime transactionDate;

    @Size(max = 1000)
    private String memo;
}
