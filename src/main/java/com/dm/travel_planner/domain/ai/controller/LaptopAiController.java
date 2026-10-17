package com.dm.travel_planner.domain.ai.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.InputStream;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@RestController
@RequestMapping("/api/ai/ollama")
public class LaptopAiController {
    private static final int MAX_MESSAGES = 20;
    private static final int MAX_MESSAGE_CHARS = 16000;
    private static final int MAX_TOTAL_CHARS = 32000;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final ObjectMapper json = new ObjectMapper();
    private final Semaphore generation = new Semaphore(1);
    private final ScheduledThreadPoolExecutor deadlines = deadlineExecutor();
    private static ScheduledThreadPoolExecutor deadlineExecutor() {
        var executor=new ScheduledThreadPoolExecutor(1,Thread.ofPlatform().daemon(true).name("laptop-ai-deadline").factory());
        executor.setRemoveOnCancelPolicy(true);
        return executor;
    }
    @Value("${app.ai.ollama-base-url:http://localhost:11434}") private String baseUrl;
    @Value("${app.ai.ollama-token:}") private String token;
    @Value("${app.ai.allowed-models:qwen35-9b-uncensored:latest,qwen3:8b}")
    private String modelNames = "qwen35-9b-uncensored:latest,qwen3:8b";
    @Value("${app.ai.max-output-tokens:4096}") private int maxOutputTokens = 4096;
    @Value("${app.ai.context-tokens:8192}") private int contextTokens = 8192;
    @Value("${app.ai.generation-timeout-seconds:600}") private long generationTimeoutSeconds = 600;

    @PostConstruct
    void validateEndpoint() {
        URI endpoint = URI.create(baseUrl);
        boolean loopback = Set.of("localhost", "127.0.0.1", "[::1]", "::1").contains(
                Optional.ofNullable(endpoint.getHost()).orElse("").toLowerCase(Locale.ROOT));
        if (endpoint.getHost() == null || endpoint.getUserInfo() != null || endpoint.getQuery() != null || endpoint.getFragment() != null
                || !("https".equals(endpoint.getScheme()) || loopback && "http".equals(endpoint.getScheme()))) {
            throw new IllegalArgumentException("Ollama는 로컬 HTTP 또는 인증된 HTTPS 게이트웨이를 사용하세요.");
        }
        if (!loopback && token.isBlank()) throw new IllegalArgumentException("원격 Ollama 게이트웨이의 인증 토큰이 필요합니다.");
        if (allowedModels().isEmpty()) throw new IllegalArgumentException("사용할 Ollama 모델을 설정하세요.");
        if (maxOutputTokens < 128 || maxOutputTokens > 16384 || contextTokens < 2048 || contextTokens > 65536
                || maxOutputTokens >= contextTokens || generationTimeoutSeconds < 30 || generationTimeoutSeconds > 1800)
            throw new IllegalArgumentException("AI 출력은 128~16384토큰이며 컨텍스트보다 작아야 합니다. 컨텍스트는 2048~65536토큰, 생성 시간은 30~1800초로 설정하세요.");
    }

    @PreDestroy
    void close() { deadlines.shutdownNow(); }

    private Set<String> allowedModels() {
        var models = new HashSet<String>();
        for (String name : modelNames.split(",")) if (!name.isBlank()) models.add(name.trim());
        return models;
    }

    private HttpRequest.Builder request(String path) {
        var builder = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/+$", "") + path));
        if (!token.isBlank()) builder.header("Authorization", "Bearer " + token);
        return builder;
    }

    @GetMapping("/status")
    public Map<String,Object> status() {
        try {
            var response = http.send(request("/api/tags").timeout(Duration.ofSeconds(2)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                var models = json.readTree(response.body()).path("models");
                if (models.isArray()) {
                    var visible = new ArrayList<Map<String,String>>();
                    var allowed = allowedModels();
                    for (var model : models) {
                        String name = model.path("name").asText();
                        if (allowed.contains(name)) visible.add(Map.of("name", name));
                    }
                    return Map.of("available", true, "models", visible);
                }
            }
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        catch (Exception ignored) { }
        return Map.of("available", false, "models", List.of());
    }

    private Map<String,Object> payload(Map<String,Object> body) {
        if (!(body.get("model") instanceof String model) || !allowedModels().contains(model))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "허용되지 않은 AI 모델입니다.");
        if (!(body.get("messages") instanceof List<?> messages) || messages.isEmpty() || messages.size() > MAX_MESSAGES)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대화는 1~20개 메시지로 보내세요.");
        var safeMessages = new ArrayList<Map<String,String>>();
        int total = 0;
        for (int i = 0; i < messages.size(); i++) {
            if (!(messages.get(i) instanceof Map<?,?> message)
                    || !(message.get("role") instanceof String role) || !Set.of("system", "user", "assistant").contains(role)
                    || role.equals("system") && i != 0
                    || !(message.get("content") instanceof String content) || content.isBlank() || content.length() > MAX_MESSAGE_CHARS)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "대화 역할과 내용을 확인하세요. 메시지는 16000자 이하로 보내세요.");
            total += content.length();
            if (total > MAX_TOTAL_CHARS) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "전체 대화는 32000자 이하로 보내세요.");
            safeMessages.add(Map.of("role", role, "content", content));
        }
        if (body.containsKey("think") && !(body.get("think") instanceof Boolean))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "추론 설정은 true 또는 false로 보내세요.");
        double temperature = 0.7;
        if (body.get("options") instanceof Map<?,?> options && options.get("temperature") instanceof Number n) {
            double value = n.doubleValue();
            if (Double.isFinite(value)) temperature = Math.clamp(value, 0.1, 0.8);
        }
        // Never forward arbitrary client options (context, output length, tools, or model overrides).
        return Map.of("model", model, "messages", safeMessages, "think", Boolean.TRUE.equals(body.get("think")),
                "stream", true, "keep_alive", "5m", "options", Map.of("num_ctx", contextTokens, "num_predict", maxOutputTokens,
                "num_batch", 128, "temperature", temperature, "top_p", 0.9, "repeat_penalty", 1.15));
    }

    @PostMapping(value="/chat", produces="application/x-ndjson;charset=UTF-8")
    public StreamingResponseBody chat(@RequestBody Map<String,Object> body) throws Exception {
        var safePayload = payload(body);
        if (!generation.tryAcquire())
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "노트북 AI가 답변 중입니다. 잠시 후 다시 시도하세요.");
        var released = new AtomicBoolean();
        Runnable release = () -> { if (released.compareAndSet(false, true)) generation.release(); };
        long started = System.nanoTime();
        try {
            if (!Boolean.TRUE.equals(status().get("available")))
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "노트북 AI가 연결되지 않았습니다.");
            var response = http.send(request("/api/chat").timeout(Duration.ofSeconds(generationTimeoutSeconds - 2))
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(safePayload))).build(),
                    HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                response.body().close();
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "노트북 AI 모델의 실행 상태를 확인하세요.");
            }
            InputStream input = response.body();
            long remaining = Math.max(1, TimeUnit.SECONDS.toNanos(generationTimeoutSeconds) - (System.nanoTime() - started));
            ScheduledFuture<?> deadline;
            try {
                deadline = deadlines.schedule(() -> {
                    try { input.close(); } catch (java.io.IOException ignored) { }
                    finally { release.run(); }
                }, remaining, TimeUnit.NANOSECONDS);
            } catch (RuntimeException e) { input.close(); throw e; }
            return output -> {
                try (input) {
                    byte[] buffer = new byte[4096];
                    int count;
                    while ((count = input.read(buffer)) != -1) { output.write(buffer, 0, count); output.flush(); }
                } finally { deadline.cancel(false); release.run(); }
            };
        } catch (InterruptedException e) {
            release.run(); Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI 요청이 중단되었습니다.");
        } catch (java.io.IOException e) {
            release.run();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "노트북 AI 연결이 끊어졌습니다.");
        } catch (Exception e) { release.run(); throw e; }
    }
}
