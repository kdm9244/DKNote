package com.dm.travel_planner.global.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Arrays;
import java.util.List;

@Component
public class ApplicationOrigins {
    private final List<String> allowed;
    private final String publicUrl;

    public ApplicationOrigins(
            @Value("${app.security.allowed-origins:http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080,https://dknote.tech}") String origins,
            @Value("${app.public-url:}") String publicUrl) {
        this.allowed = Arrays.stream(origins.split(",")).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        this.publicUrl = publicUrl.strip().replaceAll("/+$", "");
        for (String origin : allowed) validate(origin);
        if (!this.publicUrl.isEmpty()) validate(this.publicUrl);
        if (allowed.isEmpty()) throw new IllegalArgumentException("허용할 웹사이트 주소를 설정하세요.");
    }

    private void validate(String origin) {
        URI uri = URI.create(origin);
        if (uri.getHost() == null || !("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))
                || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || uri.getRawPath() != null && !uri.getRawPath().isEmpty()) {
            throw new IllegalArgumentException("웹사이트 주소는 경로 없이 정확한 http(s) origin으로 설정하세요.");
        }
    }

    public List<String> allowed() { return allowed; }
    public boolean allows(String origin) { return allowed.contains(origin); }
    public String publicUrl() { return publicUrl; }
}
