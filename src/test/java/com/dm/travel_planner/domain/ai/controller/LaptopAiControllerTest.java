package com.dm.travel_planner.domain.ai.controller;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class LaptopAiControllerTest {
    @Test void configuredLaptopUsesTokenStreamsAndBecomesUnavailableAfterDisconnect() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/tags", exchange -> {
            if (!"Bearer laptop-token".equals(exchange.getRequestHeaders().getFirst("Authorization"))) {
                exchange.sendResponseHeaders(401, -1); exchange.close(); return;
            }
            byte[] body = "{\"models\":[{\"name\":\"qwen3:8b\"}]}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.createContext("/api/chat", exchange -> {
            byte[] body = "{\"message\":{\"content\":\"hello\"}}\n".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body); exchange.close();
        });
        server.start();
        var controller = new LaptopAiController();
        ReflectionTestUtils.setField(controller, "baseUrl", "http://127.0.0.1:" + server.getAddress().getPort());
        ReflectionTestUtils.setField(controller, "token", "laptop-token");
        try {
            assertEquals(true, controller.status().get("available"));
            var output = new ByteArrayOutputStream();
            controller.chat(Map.of("model", "qwen3:8b", "messages", List.of(Map.of("role", "user", "content", "hi")))).writeTo(output);
            assertTrue(output.toString(StandardCharsets.UTF_8).contains("hello"));
            ReflectionTestUtils.setField(controller, "token", "wrong");
            assertEquals(false, controller.status().get("available"));
            assertEquals(503, assertThrows(ResponseStatusException.class, () -> controller.chat(Map.of("model", "qwen3:8b", "messages", List.of(Map.of("role", "user", "content", "hi"))))).getStatusCode().value());
        } finally { server.stop(0); controller.close(); }
        assertEquals(false, controller.status().get("available"));
    }

    @Test void cloudAiCannotBypassLaptopOnlyMode() {
        assertEquals(503, assertThrows(ResponseStatusException.class, () -> new GeminiProxyController().chat()).getStatusCode().value());
    }
}
