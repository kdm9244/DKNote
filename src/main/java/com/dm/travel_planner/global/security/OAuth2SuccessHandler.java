package com.dm.travel_planner.global.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.util.UriComponentsBuilder;

import com.dm.travel_planner.domain.user.repository.UserRepository;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final String RETURN_ORIGIN_COOKIE = "dknote_oauth_return_origin";
    private static final Set<String> ALLOWED_DEVELOPMENT_ORIGINS = Set.of(
            "http://localhost:5173",
            "http://127.0.0.1:5173"
    );

    private final com.dm.travel_planner.global.config.ApplicationOrigins origins;
    private final JwtTokenProvider jwtTokenProvider;
    
    // 🌟 [추가] 구글로부터 인증 토큰 정보들을 추출하기 위한 스프링 시큐리티 서비스 주입
    private final OAuth2AuthorizedClientService authorizedClientService;
    
    // 🌟 [추가] 유저 엔티티에 토큰을 반영하고 저장하기 위한 리포지토리 주입
    private final UserRepository userRepository;

    // 소셜 로그인 성공 후 토큰을 담아서 보낼 프론트엔드 리다이렉트 기본 URL
    @Override
    @Transactional // 유저 엔티티의 토큰 수정을 DB에 최종 영속화하기 위해 트랜잭션을 적용합니다.
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException, ServletException {

        // 1. 구글 인증 세부 정보(OAuth2AuthorizedClient)를 추출하여 액세스/리프레시 토큰을 가로챕니다.
        OAuth2AuthenticationToken oauthToken = (OAuth2AuthenticationToken) authentication;
        OAuth2AuthorizedClient authorizedClient = authorizedClientService.loadAuthorizedClient(
                oauthToken.getAuthorizedClientRegistrationId(),
                oauthToken.getName()
        );

        // 구글 Access Token 획득
        final String googleAccessToken = authorizedClient.getAccessToken().getTokenValue();
        
        // 구글 Refresh Token 획득 (람다식 내 참조를 위해 삼항 연산자로 effectively final 보장)
        final String googleRefreshToken = (authorizedClient.getRefreshToken() != null)
                ? authorizedClient.getRefreshToken().getTokenValue()
                : null;

        // 구글 토큰 만료 시각 획득 및 LocalDateTime 변환 (람다식 내 참조를 위해 삼항 연산자로 effectively final 보장)
        final LocalDateTime expiresAt = (authorizedClient.getAccessToken().getExpiresAt() != null)
                ? LocalDateTime.ofInstant(authorizedClient.getAccessToken().getExpiresAt(), ZoneId.systemDefault())
                : null;

        // 2. 인증이 완료된 UserPrincipal 획득
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();

        // 🌟 [추가] 가로챈 구글 토큰 정보를 유저 테이블에 실시간 업데이트 저장합니다.
        userRepository.findById(principal.getUserId()).ifPresent(user -> {
            // 최초 로그인 이후에는 Refresh Token이 새로 내려오지 않고 null이 될 수 있으므로, 
            // 새로 발급된 Refresh Token이 있을 때만 덮어쓰고 없으면 기존 DB에 저장된 값을 보존합니다.
            String finalRefreshToken = (googleRefreshToken != null) ? googleRefreshToken : user.getGoogleRefreshToken();
            user.updateGoogleTokens(googleAccessToken, finalRefreshToken, expiresAt, String.join(" ", authorizedClient.getAccessToken().getScopes()));
            userRepository.save(user); // 변경 감지(더티체킹) 및 DB 저장 반영
            log.info("사용자 구글 OAuth 토큰 갱신 성공 - email: {}", user.getEmail());
        });

        // 3. JWT Access Token 발급 (프론트 리다이렉트용)
        String role = principal.getRole();
        String token = jwtTokenProvider.createToken(principal.getUserId(), principal.getEmail(), role);

        log.info("Google OAuth2 로그인 성공! JWT 발급 완료 - email: {}", principal.getEmail());

        // 4. 쿼리 스트링 형태로 토큰 주입하여 프론트 리다이렉트 URL 생성
        String developmentOrigin = resolveDevelopmentOrigin(request);
        UriComponentsBuilder targetBuilder = developmentOrigin == null
                ? UriComponentsBuilder.fromPath("/oauth2/redirect")
                : UriComponentsBuilder.fromUriString(developmentOrigin).path("/oauth2/redirect");

        String targetUrl = targetBuilder
                .fragment("token=" + token)
                .build()
                .toUriString();

        clearReturnOriginCookie(response);
        response.setHeader("Referrer-Policy", "no-referrer");
        response.setHeader("Cache-Control", "no-store");

        // 5. 리다이렉트 수행
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }

    private String resolveDevelopmentOrigin(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (!RETURN_ORIGIN_COOKIE.equals(cookie.getName())) {
                continue;
            }

            try {
                String origin = URLDecoder.decode(cookie.getValue(), StandardCharsets.UTF_8);
                return origins.allows(origin) && ALLOWED_DEVELOPMENT_ORIGINS.contains(origin) ? origin : null;
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }

    private void clearReturnOriginCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(RETURN_ORIGIN_COOKIE, "");
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}
