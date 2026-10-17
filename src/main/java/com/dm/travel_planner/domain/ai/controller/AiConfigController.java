package com.dm.travel_planner.domain.ai.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;
import com.dm.travel_planner.domain.ledger.investment.price.MarketPriceProvider;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
public class AiConfigController {

    private static final Logger log = LoggerFactory.getLogger(AiConfigController.class);

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired(required = false)
    private MarketPriceProvider marketPriceProvider;

    @GetMapping("/exchange-rate")
    public ResponseEntity<Map<String, Object>> getExchangeRate(
            @RequestParam(value = "base", defaultValue = "JPY") String base,
            @RequestParam(value = "quote", defaultValue = "KRW") String quote) {

        // 1. KIS API 제공자 시도
        if (marketPriceProvider != null) {
            try {
                Currency baseCurr = Currency.valueOf(base.toUpperCase());
                Currency quoteCurr = Currency.valueOf(quote.toUpperCase());
                var optQuote = marketPriceProvider.getExchangeRateQuote(baseCurr, quoteCurr);
                if (optQuote.isPresent()) {
                    var q = optQuote.get();
                    Map<String, Object> data = new HashMap<>();
                    data.put("base", baseCurr.name());
                    data.put("quote", quoteCurr.name());
                    data.put("rate", q.rate());
                    data.put("baseUnit", 1);
                    data.put("previousClose", q.previousClose());
                    data.put("change", q.change());
                    data.put("changePercent", q.changePercent());
                    data.put("provider", "KIS");
                    data.put("updatedAt", q.quotedAt().toString());
                    return ResponseEntity.ok(data);
                }
            } catch (Exception e) {
                log.warn("KIS exchange rate lookup failed, falling back to market index: {}", e.getMessage());
            }
        }

        // 2. 실시간 외환 시세 API 폴백 (Naver FX)
        try {
            String reutersCode = "FX_" + base.toUpperCase() + quote.toUpperCase();
            URI fxUri = URI.create("https://m.stock.naver.com/front-api/marketIndex/prices?category=exchange&reutersCode=" + reutersCode);

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Referer", "https://m.stock.naver.com/");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> fxEntity = restTemplate.exchange(fxUri, HttpMethod.GET, entity, String.class);
            String fxJson = fxEntity.getBody();
            if (fxJson != null) {
                JsonNode root = objectMapper.readTree(fxJson);
                JsonNode resultArr = root.path("result");
                if (resultArr.isArray() && !resultArr.isEmpty()) {
                    JsonNode latest = resultArr.get(0);
                    double closePrice = Double.parseDouble(latest.path("closePrice").asText("0").replace(",", ""));
                    double change = Double.parseDouble(latest.path("fluctuations").asText("0").replace(",", ""));
                    double changePercent = Double.parseDouble(latest.path("fluctuationsRatio").asText("0").replace(",", ""));
                    String tradedAt = latest.path("localTradedAt").asText("");

                    Map<String, Object> data = new HashMap<>();
                    data.put("base", base.toUpperCase());
                    data.put("quote", quote.toUpperCase());
                    data.put("rate", closePrice);
                    data.put("baseUnit", "JPY".equalsIgnoreCase(base) && "KRW".equalsIgnoreCase(quote) ? 100 : 1);
                    data.put("change", change);
                    data.put("changePercent", changePercent);
                    data.put("provider", "외환 시장 실시세");
                    data.put("updatedAt", tradedAt);
                    return ResponseEntity.ok(data);
                }
            }
        } catch (Exception e) {
            log.error("Failed to fetch FX rate for {}_{}: {}", base, quote, e.getMessage());
        }

        return ResponseEntity.notFound().build();
    }

    @GetMapping("/config")
    public ResponseEntity<Map<String, Object>> getAiConfig() {
        Map<String, Object> result = new HashMap<>();
        result.put("hasGeminiEnv", false);
        result.put("mode", "laptop-only");
        return ResponseEntity.ok(result);
    }

    @GetMapping("/stock-quote")
    public ResponseEntity<Map<String, Object>> getStockQuote(@RequestParam("query") String query) {
        if (query == null || query.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        try {
            String cleanQuery = query.trim();
            String encodedQuery = URLEncoder.encode(cleanQuery, StandardCharsets.UTF_8);
            URI searchUri = URI.create("https://m.stock.naver.com/front-api/search/autoComplete?query=" + encodedQuery + "&target=stock");

            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            headers.set("Referer", "https://m.stock.naver.com/");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> searchEntity = restTemplate.exchange(searchUri, HttpMethod.GET, entity, String.class);
            String searchJson = searchEntity.getBody();
            if (searchJson == null) {
                log.warn("Naver stock search returned null body for query: {}", cleanQuery);
                return ResponseEntity.notFound().build();
            }

            JsonNode root = objectMapper.readTree(searchJson);
            JsonNode items = root.path("result").path("items");
            if ((!items.isArray() || items.isEmpty()) && cleanQuery.length() >= 2) {
                String strippedQuery = cleanQuery.replaceAll("(은|는|이|가|을|를|의|에|도)$", "").trim();
                if (!strippedQuery.equals(cleanQuery) && !strippedQuery.isEmpty()) {
                    String encodedStripped = URLEncoder.encode(strippedQuery, StandardCharsets.UTF_8);
                    URI retryUri = URI.create("https://m.stock.naver.com/front-api/search/autoComplete?query=" + encodedStripped + "&target=stock");
                    ResponseEntity<String> retryEntity = restTemplate.exchange(retryUri, HttpMethod.GET, entity, String.class);
                    String retryJson = retryEntity.getBody();
                    if (retryJson != null) {
                        JsonNode retryRoot = objectMapper.readTree(retryJson);
                        JsonNode retryItems = retryRoot.path("result").path("items");
                        if (retryItems.isArray() && !retryItems.isEmpty()) {
                            items = retryItems;
                            cleanQuery = strippedQuery;
                        }
                    }
                }
            }
            if (!items.isArray() || items.isEmpty()) {
                log.warn("Naver stock search items empty for query: {}", cleanQuery);
                return ResponseEntity.notFound().build();
            }

            JsonNode item = items.get(0);
            boolean foundExact = false;
            // 1순위: 종목명이 검색어와 일치하거나 단어 접두어로 시작하는 원주(ADR/ETF 제외)
            for (JsonNode candidateItem : items) {
                String candidateName = candidateItem.path("name").asText("");
                boolean isWordMatch = candidateName.equalsIgnoreCase(cleanQuery)
                        || candidateName.startsWith(cleanQuery + " ")
                        || candidateName.startsWith(cleanQuery + "(");
                if (isWordMatch && !candidateName.contains("ADR") && !candidateName.contains("레버리지") && !candidateName.contains("인버스") && !candidateItem.path("isEtf").asBoolean(false)) {
                    item = candidateItem;
                    foundExact = true;
                    break;
                }
            }
            // 2순위: ADR이라도 검색어 단어와 일치하는 본사 종목 (예: 소니 ADR 등)
            if (!foundExact) {
                for (JsonNode candidateItem : items) {
                    String candidateName = candidateItem.path("name").asText("");
                    if (candidateName.equalsIgnoreCase(cleanQuery) || candidateName.startsWith(cleanQuery + " ")) {
                        item = candidateItem;
                        foundExact = true;
                        break;
                    }
                }
            }
            // 3순위: 검색어를 부분 포함하는 일반 원주
            if (!foundExact) {
                for (JsonNode candidateItem : items) {
                    String candidateName = candidateItem.path("name").asText("");
                    if (candidateName.contains(cleanQuery) && !candidateName.contains("ADR") && !candidateName.contains("레버리지") && !candidateItem.path("isEtf").asBoolean(false)) {
                        item = candidateItem;
                        foundExact = true;
                        break;
                    }
                }
            }

            String code = item.path("code").asText();
            String name = item.path("name").asText(cleanQuery);
            String nationCode = item.path("nationCode").asText("KOR");
            String reutersCode = item.path("reutersCode").asText(code);
            String typeName = item.path("typeName").asText("주식");

            boolean isDomestic = "KOR".equalsIgnoreCase(nationCode);
            String quoteUrlStr = isDomestic
                    ? "https://m.stock.naver.com/api/stock/" + code + "/basic"
                    : "https://api.stock.naver.com/stock/" + (reutersCode.isBlank() ? code : reutersCode) + "/basic";

            URI quoteUri = URI.create(quoteUrlStr);
            ResponseEntity<String> quoteEntity = restTemplate.exchange(quoteUri, HttpMethod.GET, entity, String.class);
            String quoteJson = quoteEntity.getBody();
            if (quoteJson == null) {
                log.warn("Naver stock quote returned null for code: {}", code);
                return ResponseEntity.notFound().build();
            }

            JsonNode quote = objectMapper.readTree(quoteJson);
            String closePriceStr = quote.path("closePrice").asText("0").replace(",", "");
            double price = Double.parseDouble(closePriceStr);

            String fluctRatioStr = quote.path("fluctuationsRatio").asText("0").replace(",", "");
            double changeRate = Double.parseDouble(fluctRatioStr);

            String currency = quote.path("currencyType").path("code").asText(isDomestic ? "KRW" : "USD");

            Map<String, Object> data = new HashMap<>();
            data.put("name", name);
            data.put("ticker", code);
            data.put("market", typeName);
            data.put("price", price);
            data.put("changeRate", changeRate);
            data.put("currency", currency);
            data.put("source", "실시간 시장 시세");

            return ResponseEntity.ok(data);
        } catch (Exception e) {
            log.error("Failed to fetch stock quote for {}: {}", query, e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

}
