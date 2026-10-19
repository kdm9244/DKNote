package com.dm.travel_planner.global.config;

import com.dm.travel_planner.global.security.CustomOAuth2UserService;
import com.dm.travel_planner.global.security.JwtAuthenticationFilter;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import com.dm.travel_planner.global.security.OAuth2SuccessHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver;
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver;
import java.util.LinkedHashSet;
import com.dm.travel_planner.domain.workspace.GoogleCalendarService;

import jakarta.servlet.http.HttpServletResponse; // 서블릿 응답 상수(SC_UNAUTHORIZED) 조작을 위해 임포트합니다.
import java.util.List;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final ApplicationOrigins applicationOrigins;
    private final JwtTokenProvider jwtTokenProvider;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oAuth2SuccessHandler;
    @org.springframework.beans.factory.annotation.Value("${app.security.cloudflare-required:false}") private boolean cloudflareRequired;
    @org.springframework.beans.factory.annotation.Value("${app.security.cloudflare-issuer:}") private String cloudflareIssuer;
    @org.springframework.beans.factory.annotation.Value("${app.security.cloudflare-audience:}") private String cloudflareAudience;

    /**
     * 비밀번호를 암호화하기 위한 빈입니다.
     * 일반 회원가입 시 유저 비밀번호를 단방향 해시 암호화(BCrypt) 처리할 때 사용합니다.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 스프링 시큐리티의 모든 보안 필터 체인을 관리하는 빈 설정입니다.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, OAuth2AuthorizationRequestResolver calendarLoginResolver) throws Exception {
        http
            // 1. CSRF 기능 비활성화 (Rest API + JWT 방식이기 때문에 불필요)
            .csrf(AbstractHttpConfigurer::disable)
            .headers(headers -> headers.referrerPolicy(ref -> ref.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER)))
            
            // 2. CORS 설정 연동
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            
            // 3. 세션을 사용하지 않고 Stateless 모드로 설정
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // 4. API별 인증 인가 권한 설정
            .authorizeHttpRequests(auth -> auth
                // 회원가입, 일반 로그인, 구글 로그인 및 주요 개발 API 경로 허용
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.GET,"/api/notices/public").permitAll()
                .requestMatchers("/api/auth/**", "/oauth2/**", "/login/oauth2/code/**", "/error").permitAll()
                .requestMatchers(
                        "/", "/health", "/index.html", "/assets/**", "/favicon.ico", "/favicon.svg",
                        "/login", "/signup", "/news", "/oauth2/redirect",
                        "/mypage", "/planner", "/ledger/**", "/trips/**", "/calendar/**", "/learning/**", "/settings", "/updates", "/api/calendar/google/callback"
                ).permitAll()
                // 이외의 모든 API 요청은 JWT 토큰 인증 처리
                .anyRequest().authenticated()
            )
            
            // 5. 소셜 로그인 기능 활성화 및 설정
            .oauth2Login(oauth2 -> oauth2
                .authorizationEndpoint(endpoint -> endpoint.authorizationRequestResolver(calendarLoginResolver))
                .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService)) // 구글 회원 정보 처리 서비스 등록
                .successHandler(oAuth2SuccessHandler)                                         // 로그인 성공 시 JWT 발급 핸들러 등록
            )
            
            // 7. [추가] 인증 예외 처리 (EntryPoint) 설정
            // 인증되지 않은 사용자가 보호된 API에 접근했을 때, 구글 로그인 창으로 리다이렉트 시키는 대신 401 Unauthorized 에러 코드를 반환합니다.
            .exceptionHandling(exception -> exception
                .authenticationEntryPoint((request, response, authException) -> {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unauthorized");
                })
            )
            
            // 6. JWT 인증 필터를 UsernamePasswordAuthenticationFilter 전단계에 추가
            .addFilterBefore(new JwtAuthenticationFilter(jwtTokenProvider), UsernamePasswordAuthenticationFilter.class);
        if(cloudflareRequired)http.addFilterBefore(new com.dm.travel_planner.global.security.CloudflareAccessFilter(cloudflareIssuer,cloudflareAudience),JwtAuthenticationFilter.class);
        http.addFilterAfter(new com.dm.travel_planner.global.security.ApiRequestLimitFilter(),JwtAuthenticationFilter.class);
        http.addFilterAfter(new com.dm.travel_planner.global.security.NoticePublisherFilter(),JwtAuthenticationFilter.class);
        http.addFilterAfter(new com.dm.travel_planner.global.security.AiRequestBodyLimitFilter(), com.dm.travel_planner.global.security.ApiRequestLimitFilter.class);

        return http.build();
    }

    @Bean
    public OAuth2AuthorizationRequestResolver calendarLoginResolver(ClientRegistrationRepository registrations) {
        var resolver = new DefaultOAuth2AuthorizationRequestResolver(registrations, "/oauth2/authorization");
        var scopes = new LinkedHashSet<>(registrations.findByRegistrationId("google").getScopes());
        // Preserve the existing OAuth2 UserPrincipal mapper and success handler (not the default OIDC principal).
        scopes.remove("openid");scopes.add("profile");scopes.add("email");
        scopes.add(GoogleCalendarService.CALENDAR_EVENTS_SCOPE);scopes.add(GoogleCalendarService.CALENDAR_LIST_SCOPE);
        resolver.setAuthorizationRequestCustomizer(builder -> builder.scopes(scopes).additionalParameters(params -> {
            params.put("access_type", "offline");params.put("include_granted_scopes", "true");
            // Explicit consent returns a refresh token for existing accounts that used profile-only login.
            params.put("prompt", "consent");
        }));
        return resolver;
    }

    /**
     * React 프론트엔드 도메인에서 백엔드 API를 호출할 수 있도록 허용하는 CORS 설정 소스입니다.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        
        // 개발 단계의 리액트 로컬 포트 허용 (3000, 5173)
        configuration.setAllowedOrigins(applicationOrigins.allowed());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Cache-Control"));
        configuration.setExposedHeaders(List.of("Authorization"));
        configuration.setAllowCredentials(true); // 쿠키나 인증 정보를 포함한 요청 허용
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration); // 모든 경로에 적용
        return source;
    }
}
