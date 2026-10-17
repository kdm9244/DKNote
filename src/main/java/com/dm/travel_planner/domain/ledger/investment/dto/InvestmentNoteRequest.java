package com.dm.travel_planner.domain.ledger.investment.dto;

import jakarta.validation.constraints.NotBlank;

public record InvestmentNoteRequest(
        @NotBlank String title,
        String content,
        Boolean pinned
) {
}
