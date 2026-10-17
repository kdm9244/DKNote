package com.dm.travel_planner.global.config;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

@Component
@Profile("prod")
public class ProductionSettingsGuard {
    public ProductionSettingsGuard(ApplicationOrigins origins) {
        URI url = URI.create(origins.publicUrl());
        String host = url.getHost();
        if (!"https".equals(url.getScheme()) || host == null
                || Set.of("localhost", "127.0.0.1", "::1", "[::1]").contains(host.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("운영 APP_PUBLIC_URL은 실제 서비스의 HTTPS 주소로 설정하세요.");
        }
    }
}
