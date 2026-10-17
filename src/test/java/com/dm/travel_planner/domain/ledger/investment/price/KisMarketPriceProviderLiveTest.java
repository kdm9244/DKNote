package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "KIS_LIVE_TEST", matches = "true")
class KisMarketPriceProviderLiveTest {

    @Test
    void loadsDomesticPriceAndMajorExchangeRates() {
        KisMarketPriceProvider provider = new KisMarketPriceProvider(
                System.getenv().getOrDefault(
                        "KIS_BASE_URL", "https://openapi.koreainvestment.com:9443"),
                System.getenv("KIS_APP_KEY"),
                System.getenv("KIS_APP_SECRET"),
                "./.local/kis-token.json");

        assertTrue(provider.isConfigured(), "KIS_APP_KEY와 KIS_APP_SECRET이 테스트 프로세스에 없습니다.");
        assertTrue(provider.getTradePrice("005930", "KOSPI", Currency.KRW).isPresent(),
                () -> provider.getLastFailureMessage().orElse("삼성전자 시세 응답이 없습니다."));
        assertTrue(provider.getExchangeRateQuote(Currency.USD, Currency.KRW).isPresent(),
                () -> provider.getLastFailureMessage().orElse("원/달러 환율 응답이 없습니다."));
        assertTrue(provider.getExchangeRateQuote(Currency.JPY, Currency.KRW).isPresent(),
                () -> provider.getLastFailureMessage().orElse("원/엔 환율 응답이 없습니다."));
    }
}
