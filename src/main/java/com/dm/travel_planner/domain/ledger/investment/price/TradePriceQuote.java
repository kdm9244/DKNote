package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record TradePriceQuote(
        BigDecimal currentPrice,
        BigDecimal openingPrice,
        Currency currency,
        LocalDateTime quotedAt,
        String source
) {
    public BigDecimal preferredPrice() {
        if (currentPrice != null && currentPrice.signum() > 0) return currentPrice;
        return openingPrice != null && openingPrice.signum() > 0 ? openingPrice : null;
    }
}
