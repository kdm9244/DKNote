package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvestmentSymbolResponse(
        String investmentId,
        String tickerCode,
        String symbolName,
        String market,
        Currency currency,
        InvestmentAssetClass assetClass,
        BigDecimal currentPrice,
        BigDecimal openingPrice,
        BigDecimal quantity,
        LocalDateTime priceUpdatedAt,
        String source,
        boolean registered
) {
}
