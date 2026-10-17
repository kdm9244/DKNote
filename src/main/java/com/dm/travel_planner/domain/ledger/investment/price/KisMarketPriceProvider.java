package com.dm.travel_planner.domain.ledger.investment.price;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import java.util.zip.ZipInputStream;
import java.util.stream.Stream;

@Component
public class KisMarketPriceProvider implements MarketPriceProvider {
    private static final Logger log = LoggerFactory.getLogger(KisMarketPriceProvider.class);
    private static final String DOMESTIC_PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-price";
    private static final String DOMESTIC_PRODUCT_PATH = "/uapi/domestic-stock/v1/quotations/search-stock-info";
    private static final String OVERSEAS_PRICE_PATH = "/uapi/overseas-price/v1/quotations/price";
    private static final String OVERSEAS_PRODUCT_PATH = "/uapi/overseas-price/v1/quotations/search-info";
    private static final String EXCHANGE_RATE_PATH = "/uapi/overseas-price/v1/quotations/inquire-daily-chartprice";
    private static final String KOSPI_MASTER_URL =
            "https://new.real.download.dws.co.kr/common/master/kospi_code.mst.zip";
    private static final String KOSDAQ_MASTER_URL =
            "https://new.real.download.dws.co.kr/common/master/kosdaq_code.mst.zip";

    private final RestClient restClient;
    private final RestClient masterClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String appKey;
    private final String appSecret;
    private final Path tokenCacheFile;
    private final Object requestRateLock = new Object();
    private volatile String accessToken;
    private volatile Instant tokenExpiresAt = Instant.EPOCH;
    private volatile boolean tokenCacheLoaded;
    private volatile String lastFailureMessage;
    private volatile long lastKisRequestNanos;
    private volatile List<DomesticMasterEntry> domesticMaster = List.of();
    private volatile Instant domesticMasterExpiresAt = Instant.EPOCH;
    private volatile List<OverseasMasterEntry> overseasMaster = List.of();
    private volatile Instant overseasMasterExpiresAt = Instant.EPOCH;

    public KisMarketPriceProvider(
            @Value("${market-data.kis.base-url:https://openapi.koreainvestment.com:9443}") String baseUrl,
            @Value("${market-data.kis.app-key:}") String appKey,
            @Value("${market-data.kis.app-secret:}") String appSecret,
            @Value("${market-data.kis.token-cache-file:./.local/kis-token.json}") String tokenCacheFile) {
        this.restClient = RestClient.builder().baseUrl(baseUrl).build();
        this.appKey = appKey == null ? "" : appKey.trim();
        this.appSecret = appSecret == null ? "" : appSecret.trim();
        this.tokenCacheFile = Path.of(tokenCacheFile).toAbsolutePath().normalize();
    }

    @Override
    public String providerName() {
        return "KIS";
    }

    @Override
    public boolean isConfigured() {
        return StringUtils.hasText(appKey) && StringUtils.hasText(appSecret);
    }

    @Override
    public Optional<String> getLastFailureMessage() {
        return Optional.ofNullable(lastFailureMessage).filter(StringUtils::hasText);
    }

    @Override
    public Optional<MarketQuote> getLatestPrice(Investment investment) {
        if (!isConfigured()) return Optional.empty();
        return getTradePrice(investment.getTickerCode(), investment.getMarket(), investment.getCurrency())
                .map(quote -> new MarketQuote(
                        quote.preferredPrice(), quote.currency(), quote.quotedAt(), quote.source()));
    }

    @Override
    public Optional<TradePriceQuote> getTradePrice(String tickerCode, String market, Currency currency) {
        if (!isConfigured()) return Optional.empty();
        return currency == Currency.KRW
                ? requestDomesticTradePrice(tickerCode)
                : requestOverseasTradePrice(tickerCode, market, currency);
    }

    @Override
    public Optional<BigDecimal> getExchangeRate(Currency from, Currency to) {
        return getExchangeRateQuote(from, to).map(ExchangeRateQuote::rate);
        // KIS 종목 시세와 환율 시세는 서로 다른 API다. 환율이 없으면 서비스가
        // 해당 종목에 마지막으로 저장된 환율을 사용하도록 비워서 반환한다.
    }

    @Override
    public Optional<ExchangeRateQuote> getExchangeRateQuote(Currency from, Currency to) {
        if (from == to) {
            return Optional.of(new ExchangeRateQuote(from, to, BigDecimal.ONE, BigDecimal.ONE,
                    BigDecimal.ZERO, BigDecimal.ZERO, LocalDateTime.now(), providerName()));
        }
        if (!isConfigured()) return Optional.empty();

        RateSymbol direct = resolveRateSymbol(from, to);
        if (direct != null) return requestExchangeRate(direct, from, to, false);

        RateSymbol inverse = resolveRateSymbol(to, from);
        if (inverse != null) return requestExchangeRate(inverse, from, to, true);
        return Optional.empty();
    }

    private RateSymbol resolveRateSymbol(Currency from, Currency to) {
        if (from == Currency.USD && to == Currency.KRW) return new RateSymbol("FX@KRWKFTC", BigDecimal.ONE);
        if (from == Currency.JPY && to == Currency.KRW) return new RateSymbol("FX@KRWJS", BigDecimal.ONE);
        if (from == Currency.USD && to == Currency.JPY) return new RateSymbol("FX@JPY", BigDecimal.ONE);
        return null;
    }

    private Optional<ExchangeRateQuote> requestExchangeRate(
            RateSymbol symbol, Currency requestedBase, Currency requestedQuote, boolean inverse) {
        try {
            LocalDateTime now = LocalDateTime.now();
            String today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
            String start = java.time.LocalDate.now().minusDays(14)
                    .format(java.time.format.DateTimeFormatter.BASIC_ISO_DATE);
            JsonNode response = executeKisRequest(() -> restClient.get()
                    .uri(builder -> builder.path(EXCHANGE_RATE_PATH)
                            .queryParam("FID_COND_MRKT_DIV_CODE", "X")
                            .queryParam("FID_INPUT_ISCD", symbol.code())
                            .queryParam("FID_INPUT_DATE_1", start)
                            .queryParam("FID_INPUT_DATE_2", today)
                            .queryParam("FID_PERIOD_DIV_CODE", "D")
                            .build())
                    .headers(headers -> applyQuoteHeaders(headers, "FHKST03030100"))
                    .retrieve()
                    .body(JsonNode.class));
            if (response == null || !"0".equals(response.path("rt_cd").asText())) {
                recordRejectedResponse("환율", response);
                return Optional.empty();
            }
            JsonNode output = response.path("output1");
            BigDecimal current = decimal(output, "ovrs_nmix_prpr");
            BigDecimal previous = decimal(output, "ovrs_nmix_prdy_clpr");
            if (current == null || current.signum() <= 0) {
                log.warn("KIS exchange-rate response has no current value. pair={}/{}, symbol={}",
                        requestedBase, requestedQuote, symbol.code());
                recordFailure("KIS 환율 응답에 현재 환율 값이 없습니다.");
                return Optional.empty();
            }
            current = current.divide(symbol.unit(), 8, java.math.RoundingMode.HALF_UP);
            if (previous != null && previous.signum() > 0) {
                previous = previous.divide(symbol.unit(), 8, java.math.RoundingMode.HALF_UP);
            }
            if (inverse) {
                current = BigDecimal.ONE.divide(current, 8, java.math.RoundingMode.HALF_UP);
                previous = previous == null ? null
                        : BigDecimal.ONE.divide(previous, 8, java.math.RoundingMode.HALF_UP);
            }
            BigDecimal change = previous == null ? null : current.subtract(previous);
            BigDecimal changePercent = previous == null || previous.signum() == 0 ? null
                    : change.multiply(new BigDecimal("100"))
                            .divide(previous, 4, java.math.RoundingMode.HALF_UP);
            clearFailure();
            return Optional.of(new ExchangeRateQuote(requestedBase, requestedQuote, current, previous,
                    change, changePercent, now, providerName()));
        } catch (RuntimeException exception) {
            recordException("환율", exception);
            return Optional.empty();
        }
    }

    private BigDecimal decimal(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (!StringUtils.hasText(value)) return null;
        try {
            return new BigDecimal(value.replace(",", ""));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    @Override
    public List<MarketSymbol> searchSymbols(String query, String marketGroup) {
        if (!isConfigured() || !StringUtils.hasText(query)) return List.of();
        String normalizedQuery = query.trim().toUpperCase(Locale.ROOT);
        String group = normalize(marketGroup);
        if (group.equals("KR")) {
            if (!normalizedQuery.matches("\\d{6}")) {
                return searchDomesticMaster(normalizedQuery);
            }
            return requestDomesticProductInfo(normalizedQuery).stream().toList();
        }
        List<MarketSymbol> overseasMasterMatches = List.of();
        if (group.equals("US") || group.equals("JP")) {
            overseasMasterMatches = searchOverseasMaster(normalizedQuery, group);
            boolean exactTicker = overseasMasterMatches.stream()
                    .anyMatch(item -> item.tickerCode().equalsIgnoreCase(normalizedQuery));
            if (!normalizedQuery.matches("[A-Z0-9.\\-]{1,20}")
                    || (!overseasMasterMatches.isEmpty() && !exactTicker)) {
                return overseasMasterMatches;
            }
        }
        if (!normalizedQuery.matches("[A-Z0-9.\\-]{1,20}")) return List.of();
        Stream<ProductMarket> candidates = Stream.of(
                new ProductMarket("512", "NAS", "NASDAQ", Currency.USD, "US"),
                new ProductMarket("513", "NYS", "NYSE", Currency.USD, "US"),
                new ProductMarket("529", "AMS", "AMEX", Currency.USD, "US"),
                new ProductMarket("515", "TSE", "TSE", Currency.JPY, "JP"));

        List<MarketSymbol> exactResults = candidates
                .filter(candidate -> group.isBlank() || group.equals("ALL") || candidate.group().equals(group))
                .map(candidate -> requestProductInfo(normalizedQuery, candidate))
                .flatMap(Optional::stream)
                .limit(10)
                .toList();
        if (!exactResults.isEmpty()) return exactResults;
        return overseasMasterMatches.isEmpty()
                ? searchOverseasMaster(normalizedQuery, group)
                : overseasMasterMatches;
    }

    private List<MarketSymbol> searchOverseasMaster(String query, String marketGroup) {
        String compactQuery = query.replace(" ", "").toUpperCase(Locale.ROOT);
        return getOverseasMaster().stream()
                .filter(item -> marketGroup.isBlank() || marketGroup.equals("ALL") || item.marketGroup().equals(marketGroup))
                .filter(item -> item.tickerCode().replace(" ", "").toUpperCase(Locale.ROOT).contains(compactQuery)
                        || item.koreanName().replace(" ", "").toUpperCase(Locale.ROOT).contains(compactQuery)
                        || item.englishName().replace(" ", "").toUpperCase(Locale.ROOT).contains(compactQuery))
                .sorted(Comparator.comparing((OverseasMasterEntry item) ->
                                !item.tickerCode().equalsIgnoreCase(compactQuery))
                        .thenComparing(OverseasMasterEntry::displayName))
                .limit(10)
                .map(item -> new MarketSymbol(item.tickerCode(), item.displayName(), item.market(),
                        item.currency(), null, null, "KIS_MASTER"))
                .toList();
    }

    private synchronized List<OverseasMasterEntry> getOverseasMaster() {
        Instant now = Instant.now();
        if (!overseasMaster.isEmpty() && now.isBefore(overseasMasterExpiresAt)) return overseasMaster;

        List<OverseasMasterEntry> refreshed = new ArrayList<>();
        loadOverseasMaster("nas", "NASDAQ", "US", Currency.USD, refreshed);
        loadOverseasMaster("nys", "NYSE", "US", Currency.USD, refreshed);
        loadOverseasMaster("ams", "AMEX", "US", Currency.USD, refreshed);
        loadOverseasMaster("tse", "TSE", "JP", Currency.JPY, refreshed);
        if (!refreshed.isEmpty()) {
            overseasMaster = List.copyOf(refreshed);
            overseasMasterExpiresAt = now.plus(1, ChronoUnit.DAYS);
        }
        return overseasMaster;
    }

    private void loadOverseasMaster(
            String code, String market, String marketGroup, Currency currency,
            List<OverseasMasterEntry> target) {
        String url = "https://new.real.download.dws.co.kr/common/master/" + code + "mst.cod.zip";
        try {
            masterClient.get().uri(url).exchange((request,response) -> {
                if (!response.getStatusCode().is2xxSuccessful()) throw new java.io.IOException("Master download failed");
                try (ZipInputStream zip = new ZipInputStream(response.getBody())) {
                if (zip.getNextEntry() == null) return null;
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(zip, Charset.forName("MS949")));
                String line;
                while ((line = reader.readLine()) != null) {
                    String[] columns = line.split("\\t", -1);
                    if (columns.length < 10) continue;
                    String ticker = columns[4].trim().toUpperCase(Locale.ROOT);
                    String koreanName = columns[6].trim();
                    String englishName = columns[7].trim();
                    if (StringUtils.hasText(ticker)
                            && (StringUtils.hasText(koreanName) || StringUtils.hasText(englishName))) {
                        target.add(new OverseasMasterEntry(
                                ticker, koreanName, englishName, market, marketGroup, currency));
                    }
                }
                }
                return null;
            });
        } catch (RuntimeException exception) {
            log.warn("KIS overseas master download failed. market={}, cause={}",
                    market, exception.getClass().getSimpleName());
        }
    }

    private List<MarketSymbol> searchDomesticMaster(String query) {
        String compactQuery = query.replace(" ", "").toUpperCase(Locale.ROOT);
        return getDomesticMaster().stream()
                .filter(item -> item.tickerCode().contains(compactQuery)
                        || item.symbolName().replace(" ", "").toUpperCase(Locale.ROOT).contains(compactQuery))
                .sorted(Comparator.comparing((DomesticMasterEntry item) ->
                                !item.symbolName().replace(" ", "").equalsIgnoreCase(compactQuery))
                        .thenComparing(DomesticMasterEntry::symbolName))
                .limit(10)
                .map(item -> new MarketSymbol(item.tickerCode(), item.symbolName(), item.market(),
                        Currency.KRW, null, null, "KIS_MASTER"))
                .toList();
    }

    private synchronized List<DomesticMasterEntry> getDomesticMaster() {
        Instant now = Instant.now();
        if (!domesticMaster.isEmpty() && now.isBefore(domesticMasterExpiresAt)) return domesticMaster;

        List<DomesticMasterEntry> refreshed = new ArrayList<>();
        loadDomesticMaster(KOSPI_MASTER_URL, "KOSPI", 228, refreshed);
        loadDomesticMaster(KOSDAQ_MASTER_URL, "KOSDAQ", 222, refreshed);
        if (!refreshed.isEmpty()) {
            domesticMaster = List.copyOf(refreshed);
            domesticMasterExpiresAt = now.plus(1, ChronoUnit.DAYS);
        }
        return domesticMaster;
    }

    private void loadDomesticMaster(
            String url, String market, int trailingFieldLength, List<DomesticMasterEntry> target) {
        try {
            masterClient.get().uri(url).exchange((request,response) -> {
                if (!response.getStatusCode().is2xxSuccessful()) throw new java.io.IOException("Master download failed");
                try (ZipInputStream zip = new ZipInputStream(response.getBody())) {
                if (zip.getNextEntry() == null) return null;
                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(zip, Charset.forName("MS949")));
                String line;
                while ((line = reader.readLine()) != null) {
                    int nameEnd = line.length() - trailingFieldLength;
                    if (nameEnd <= 21) continue;
                    String ticker = line.substring(0, Math.min(9, line.length()))
                            .replaceAll("[^0-9]", "");
                    String name = line.substring(21, nameEnd).trim();
                    if (ticker.length() == 6 && StringUtils.hasText(name)) {
                        target.add(new DomesticMasterEntry(ticker, name, market));
                    }
                }
                }
                return null;
            });
        } catch (RuntimeException exception) {
            log.warn("KIS domestic master download failed. market={}, cause={}",
                    market, exception.getClass().getSimpleName());
        }
    }

    private Optional<TradePriceQuote> requestDomesticTradePrice(String tickerCode) {
        try {
            JsonNode response = executeKisRequest(() -> restClient.get()
                    .uri(builder -> builder.path(DOMESTIC_PRICE_PATH)
                            .queryParam("FID_COND_MRKT_DIV_CODE", "J")
                            .queryParam("FID_INPUT_ISCD", tickerCode)
                            .build())
                    .headers(headers -> applyQuoteHeaders(headers, "FHKST01010100"))
                    .retrieve()
                    .body(JsonNode.class));
            return readTradePrice(response, "stck_prpr", "stck_oprc", Currency.KRW);
        } catch (RuntimeException exception) {
            recordException("국내 주식 시세", exception);
            return Optional.empty();
        }
    }

    private Optional<TradePriceQuote> requestOverseasTradePrice(String tickerCode, String market, Currency currency) {
        try {
            String symbol = normalizeSymbol(tickerCode, currency);
            JsonNode response = executeKisRequest(() -> restClient.get()
                    .uri(builder -> builder.path(OVERSEAS_PRICE_PATH)
                            .queryParam("AUTH", "")
                            .queryParam("EXCD", toKisExchangeCode(market, currency))
                            .queryParam("SYMB", symbol)
                            .build())
                    .headers(headers -> applyQuoteHeaders(headers, "HHDFS00000300"))
                    .retrieve()
                    .body(JsonNode.class));
            return readTradePrice(response, "last", "open", currency);
        } catch (RuntimeException exception) {
            recordException("해외 주식 시세", exception);
            return Optional.empty();
        }
    }

    private Optional<MarketSymbol> requestProductInfo(String tickerCode, ProductMarket productMarket) {
        try {
            JsonNode response = executeKisRequest(() -> restClient.get()
                    .uri(builder -> builder.path(OVERSEAS_PRODUCT_PATH)
                            .queryParam("PRDT_TYPE_CD", productMarket.productTypeCode())
                            .queryParam("PDNO", normalizeSymbol(tickerCode, productMarket.currency()))
                            .build())
                    .headers(headers -> applyQuoteHeaders(headers, "CTPF1702R"))
                    .retrieve()
                    .body(JsonNode.class));
            if (response == null || !"0".equals(response.path("rt_cd").asText())) {
                return fallbackOverseasSymbol(tickerCode, productMarket);
            }

            JsonNode output = response.path("output");
            String symbolName = firstText(output, "prdt_name", "prdt_eng_name", "ovrs_item_name");
            if (!StringUtils.hasText(symbolName)) symbolName = tickerCode;
            TradePriceQuote quote = requestOverseasTradePrice(
                    tickerCode, productMarket.exchangeCode(), productMarket.currency()).orElse(null);
            BigDecimal price = quote == null ? null : quote.currentPrice();
            BigDecimal openingPrice = quote == null ? null : quote.openingPrice();
            return Optional.of(new MarketSymbol(
                    normalizeSymbol(tickerCode, productMarket.currency()), symbolName,
                    productMarket.market(), productMarket.currency(), price, openingPrice,
                    quote != null ? quote.quotedAt() : null, providerName()));
        } catch (RuntimeException exception) {
            log.warn("KIS overseas symbol info lookup failed. market={}, ticker={}, cause={}",
                    productMarket.market(), tickerCode, exception.getClass().getSimpleName());
            return fallbackOverseasSymbol(tickerCode, productMarket);
        }
    }

    private Optional<MarketSymbol> fallbackOverseasSymbol(String tickerCode, ProductMarket productMarket) {
        return requestOverseasTradePrice(tickerCode, productMarket.exchangeCode(), productMarket.currency())
                .map(quote -> new MarketSymbol(
                        normalizeSymbol(tickerCode, productMarket.currency()), tickerCode,
                        productMarket.market(), productMarket.currency(), quote.currentPrice(), quote.openingPrice(),
                        quote.quotedAt(), providerName()));
    }

    private Optional<MarketSymbol> requestDomesticProductInfo(String tickerCode) {
        if (!tickerCode.matches("\\d{6}")) return Optional.empty();
        try {
            JsonNode response = executeKisRequest(() -> restClient.get()
                    .uri(builder -> builder.path(DOMESTIC_PRODUCT_PATH)
                            .queryParam("PRDT_TYPE_CD", "300")
                            .queryParam("PDNO", tickerCode)
                            .build())
                    .headers(headers -> applyQuoteHeaders(headers, "CTPF1002R"))
                    .retrieve()
                    .body(JsonNode.class));
            if (response != null && "0".equals(response.path("rt_cd").asText())) {
                JsonNode output = response.path("output");
                String symbolName = firstText(output, "prdt_name", "prdt_name120", "hts_kor_isnm");
                if (!StringUtils.hasText(symbolName)) symbolName = tickerCode;
                TradePriceQuote quote = requestDomesticTradePrice(tickerCode).orElse(null);
                BigDecimal price = quote == null ? null : quote.currentPrice();
                BigDecimal openingPrice = quote == null ? null : quote.openingPrice();
                return Optional.of(new MarketSymbol(
                        tickerCode, symbolName, "KRX", Currency.KRW, price, openingPrice,
                        quote != null ? quote.quotedAt() : null, providerName()));
            }
        } catch (RuntimeException exception) {
            log.warn("KIS domestic symbol info lookup failed. ticker={}, cause={}",
                    tickerCode, exception.getClass().getSimpleName());
        }
        return requestDomesticTradePrice(tickerCode)
                .map(quote -> new MarketSymbol(
                        tickerCode, tickerCode, "KRX", Currency.KRW, quote.currentPrice(), quote.openingPrice(),
                        quote.quotedAt(), providerName()));
    }

    private String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = node.path(field).asText();
            if (StringUtils.hasText(value)) return value;
        }
        return "";
    }

    private Optional<TradePriceQuote> readTradePrice(
            JsonNode response, String currentField, String openingField, Currency currency) {
        if (response == null || !"0".equals(response.path("rt_cd").asText())) {
            recordRejectedResponse("주식 시세", response);
            return Optional.empty();
        }
        JsonNode output = response.path("output");
        BigDecimal currentPrice = decimal(output, currentField);
        BigDecimal openingPrice = decimal(output, openingField);
        if ((currentPrice == null || currentPrice.signum() <= 0)
                && (openingPrice == null || openingPrice.signum() <= 0)) {
            recordFailure("KIS 주식 시세 응답에 현재가와 시초가가 없습니다.");
            return Optional.empty();
        }
        clearFailure();
        return Optional.of(new TradePriceQuote(
                currentPrice, openingPrice, currency, LocalDateTime.now(), providerName()));
    }

    private void applyQuoteHeaders(org.springframework.http.HttpHeaders headers, String transactionId) {
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(getAccessToken());
        headers.set("appkey", appKey);
        headers.set("appsecret", appSecret);
        headers.set("tr_id", transactionId);
        headers.set("custtype", "P");
    }

    private synchronized String getAccessToken() {
        loadCachedTokenOnce();
        if (StringUtils.hasText(accessToken) && Instant.now().isBefore(tokenExpiresAt.minusSeconds(60))) {
            return accessToken;
        }
        try {
            JsonNode response = restClient.post()
                    .uri("/oauth2/tokenP")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "grant_type", "client_credentials",
                            "appkey", appKey,
                            "appsecret", appSecret))
                    .retrieve()
                    .body(JsonNode.class);
            if (response == null || !StringUtils.hasText(response.path("access_token").asText())) {
                recordRejectedResponse("접근 토큰", response);
                throw new IllegalStateException(lastFailureMessage);
            }
            accessToken = response.path("access_token").asText();
            long expiresIn = response.path("expires_in").asLong(86_400);
            tokenExpiresAt = Instant.now().plusSeconds(Math.max(expiresIn, 120));
            saveTokenCache();
            clearFailure();
            return accessToken;
        } catch (RestClientResponseException exception) {
            recordException("접근 토큰", exception);
            throw exception;
        }
    }

    private JsonNode executeKisRequest(Supplier<JsonNode> request) {
        synchronized (requestRateLock) {
            waitForRequestWindow(250);
            JsonNode response;
            try {
                response = request.get();
                lastKisRequestNanos = System.nanoTime();
            } catch (RestClientResponseException exception) {
                lastKisRequestNanos = System.nanoTime();
                if (!isPerSecondLimit(exception)) throw exception;
                log.info("KIS per-second request limit reached. Retrying once after a short delay.");
                waitForRequestWindow(1_100);
                response = request.get();
                lastKisRequestNanos = System.nanoTime();
                return response;
            }
            if (response != null && "EGW00201".equals(response.path("msg_cd").asText())) {
                log.info("KIS per-second request limit reached. Retrying once after a short delay.");
                waitForRequestWindow(1_100);
                response = request.get();
                lastKisRequestNanos = System.nanoTime();
            }
            return response;
        }
    }

    private boolean isPerSecondLimit(RestClientResponseException exception) {
        try {
            JsonNode response = objectMapper.readTree(exception.getResponseBodyAsString());
            return "EGW00201".equals(response.path("msg_cd").asText())
                    || response.path("msg1").asText().contains("초당 거래건수");
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private void waitForRequestWindow(long minimumIntervalMillis) {
        if (lastKisRequestNanos == 0) return;
        long minimumNanos = minimumIntervalMillis * 1_000_000L;
        long remainingNanos = minimumNanos - (System.nanoTime() - lastKisRequestNanos);
        if (remainingNanos <= 0) return;
        try {
            long millis = remainingNanos / 1_000_000L;
            int nanos = (int) (remainingNanos % 1_000_000L);
            Thread.sleep(millis, nanos);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("KIS 시세 조회 대기 중 요청이 중단되었습니다.", exception);
        }
    }

    private void loadCachedTokenOnce() {
        if (tokenCacheLoaded) return;
        tokenCacheLoaded = true;
        if (!Files.isRegularFile(tokenCacheFile)) return;
        try {
            JsonNode cached = objectMapper.readTree(Files.readString(tokenCacheFile, StandardCharsets.UTF_8));
            String cachedFingerprint = cached.path("appKeyFingerprint").asText();
            String cachedToken = cached.path("accessToken").asText();
            Instant cachedExpiry = Instant.parse(cached.path("expiresAt").asText());
            if (fingerprint(appKey).equals(cachedFingerprint)
                    && StringUtils.hasText(cachedToken)
                    && Instant.now().isBefore(cachedExpiry.minusSeconds(60))) {
                accessToken = cachedToken;
                tokenExpiresAt = cachedExpiry;
                log.info("KIS cached access token loaded. expiresAt={}", cachedExpiry);
            }
        } catch (RuntimeException | java.io.IOException exception) {
            log.warn("KIS token cache could not be loaded. cause={}", exception.getClass().getSimpleName());
        }
    }

    private void saveTokenCache() {
        try {
            Path parent = tokenCacheFile.getParent();
            if (parent != null) Files.createDirectories(parent);
            Path temporaryFile = tokenCacheFile.resolveSibling(tokenCacheFile.getFileName() + ".tmp");
            String json = objectMapper.writeValueAsString(Map.of(
                    "appKeyFingerprint", fingerprint(appKey),
                    "accessToken", accessToken,
                    "expiresAt", tokenExpiresAt.toString()));
            Files.writeString(temporaryFile, json, StandardCharsets.UTF_8);
            try {
                Files.move(temporaryFile, tokenCacheFile,
                        StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (java.nio.file.AtomicMoveNotSupportedException exception) {
                Files.move(temporaryFile, tokenCacheFile, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (RuntimeException | java.io.IOException exception) {
            log.warn("KIS token cache could not be saved. cause={}", exception.getClass().getSimpleName());
        }
    }

    private String fingerprint(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private void recordRejectedResponse(String operation, JsonNode response) {
        String code = response == null ? "NO_RESPONSE"
                : firstText(response, "msg_cd", "error_code", "rt_cd");
        String message = response == null ? "응답이 없습니다."
                : firstText(response, "msg1", "error_description", "message");
        recordFailure("KIS " + operation + " 실패"
                + (StringUtils.hasText(code) ? " [" + code + "]" : "")
                + (StringUtils.hasText(message) ? ": " + message : ""));
    }

    private void recordException(String operation, RuntimeException exception) {
        if (exception instanceof RestClientResponseException responseException) {
            try {
                JsonNode response = objectMapper.readTree(responseException.getResponseBodyAsString());
                recordRejectedResponse(operation, response);
                return;
            } catch (RuntimeException ignored) {
                recordFailure("KIS " + operation + " 요청 실패: HTTP " + responseException.getStatusCode().value());
                return;
            }
        }
        recordFailure("KIS " + operation + " 요청 실패: " + exception.getClass().getSimpleName());
    }

    private void recordFailure(String message) {
        lastFailureMessage = message;
        log.warn(message);
    }

    private void clearFailure() {
        lastFailureMessage = null;
    }

    private boolean isDomestic(Investment investment) {
        String market = normalize(investment.getMarket());
        return investment.getCurrency() == Currency.KRW
                || market.contains("KRX") || market.contains("KOSPI") || market.contains("KOSDAQ");
    }

    private String toKisExchangeCode(String market, Currency currency) {
        String normalized = normalize(market);
        if (currency == Currency.JPY || normalized.contains("TSE") || normalized.contains("TOKYO") || normalized.contains("TYO")) return "TSE";
        if (normalized.contains("NYSE") || normalized.equals("NYS")) return "NYS";
        if (normalized.contains("AMEX") || normalized.contains("AMERICAN") || normalized.equals("AMS")) return "AMS";
        return "NAS";
    }

    private String normalizeSymbol(String tickerCode, Currency currency) {
        String symbol = tickerCode == null ? "" : tickerCode.trim().toUpperCase(Locale.ROOT);
        if (currency == Currency.JPY && symbol.endsWith(".T")) return symbol.substring(0, symbol.length() - 2);
        return symbol;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private record ProductMarket(String productTypeCode, String exchangeCode, String market,
                                 Currency currency, String group) {
    }

    private record DomesticMasterEntry(String tickerCode, String symbolName, String market) {
    }

    private record OverseasMasterEntry(
            String tickerCode, String koreanName, String englishName,
            String market, String marketGroup, Currency currency) {
        private String displayName() {
            return StringUtils.hasText(koreanName) ? koreanName : englishName;
        }
    }

    private record RateSymbol(String code, BigDecimal unit) {
    }
}
