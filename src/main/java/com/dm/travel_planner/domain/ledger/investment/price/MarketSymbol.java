package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MarketSymbol(
        String tickerCode,
        String symbolName,
        String market,
        Currency currency,
        BigDecimal currentPrice,
        BigDecimal openingPrice,
        LocalDateTime quotedAt,
        String source
) {
    public MarketSymbol(String tickerCode, String symbolName, String market, Currency currency,
                        BigDecimal currentPrice, LocalDateTime quotedAt, String source) {
        this(tickerCode, symbolName, market, currency, currentPrice, null, quotedAt, source);
    }
}
