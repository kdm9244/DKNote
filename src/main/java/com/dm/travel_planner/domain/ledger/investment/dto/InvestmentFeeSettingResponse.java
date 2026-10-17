package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentMarketGroup;

import java.math.BigDecimal;

public record InvestmentFeeSettingResponse(
        InvestmentMarketGroup marketGroup,
        BigDecimal buyFeeRate,
        BigDecimal sellFeeRate,
        BigDecimal sellTaxRate,
        BigDecimal dividendTaxRate
) {
}
