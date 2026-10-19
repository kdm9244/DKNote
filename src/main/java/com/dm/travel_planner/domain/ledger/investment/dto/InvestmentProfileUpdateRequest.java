package com.dm.travel_planner.domain.ledger.investment.dto;

public record InvestmentProfileUpdateRequest(
        Boolean primary,
        Boolean autoSyncEnabled,
        String syncProvider,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType taxAccountType
) {
}
