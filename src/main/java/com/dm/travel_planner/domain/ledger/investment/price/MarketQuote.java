package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MarketQuote(BigDecimal price, Currency currency, LocalDateTime quotedAt, String source) {
}
