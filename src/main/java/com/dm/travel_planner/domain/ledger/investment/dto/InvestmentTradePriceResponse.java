package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvestmentTradePriceResponse(
        String tickerCode,
        String market,
        Currency currency,
        BigDecimal currentPrice,
        BigDecimal openingPrice,
        BigDecimal recommendedPrice,
        String priceBasis,
        LocalDateTime quotedAt,
        String source
) {}
