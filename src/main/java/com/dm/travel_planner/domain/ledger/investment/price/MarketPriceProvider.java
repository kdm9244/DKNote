package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface MarketPriceProvider {
    String providerName();
    boolean isConfigured();

    default Optional<String> getLastFailureMessage() {
        return Optional.empty();
    }

    Optional<MarketQuote> getLatestPrice(Investment investment);
    Optional<BigDecimal> getExchangeRate(Currency from, Currency to);

    default Optional<TradePriceQuote> getTradePrice(String tickerCode, String market, Currency currency) {
        return Optional.empty();
    }

    default Optional<ExchangeRateQuote> getExchangeRateQuote(Currency from, Currency to) {
        return getExchangeRate(from, to).map(rate -> new ExchangeRateQuote(
                from, to, rate, null, null, null, java.time.LocalDateTime.now(), providerName()));
    }

    default List<MarketSymbol> searchSymbols(String query, String marketGroup) {
        return List.of();
    }
}
