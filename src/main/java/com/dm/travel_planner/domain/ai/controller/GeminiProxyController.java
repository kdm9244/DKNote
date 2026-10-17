package com.dm.travel_planner.domain.ai.controller;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping("/api/ai/gemini")
public class GeminiProxyController {
    @PostMapping("/chat")
    public void chat() {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI는 노트북의 Ollama가 연결되었을 때만 사용할 수 있습니다.");
    }
}
