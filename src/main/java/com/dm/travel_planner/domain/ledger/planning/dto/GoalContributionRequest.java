package com.dm.travel_planner.domain.ledger.planning.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record GoalContributionRequest(
        @NotNull @Positive BigDecimal amount,
        String sourceAccountId,
        @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm[:ss[.SSS]]") LocalDateTime contributedAt,
        String memo
) {}
