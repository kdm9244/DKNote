package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ExchangeRateQuote(
        Currency baseCurrency,
        Currency quoteCurrency,
        BigDecimal rate,
        BigDecimal previousClose,
        BigDecimal change,
        BigDecimal changePercent,
        LocalDateTime quotedAt,
        String provider
) {
}
