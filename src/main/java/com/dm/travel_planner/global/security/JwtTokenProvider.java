package com.dm.travel_planner.global.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.security.SecurityException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Arrays;
import java.util.Collection;
import java.util.Date;
import java.util.stream.Collectors;

@Slf4j
@Component
public class JwtTokenProvider {

    private final String secretKeyPlain;
    private final long expirationMs;
    private SecretKey key;

    // 생성자를 통해 application.yml 설정 주입
    public JwtTokenProvider(
            @Value("${jwt.secret}") String secretKeyPlain,
            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.secretKeyPlain = secretKeyPlain;
        this.expirationMs = expirationMs;
    }

    /**
     * 의존성 주입이 완료된 후, Base64로 인코딩되어 있는 시크릿 키를 안전하게 디코딩하여
     * HMAC-SHA 알고리즘용 SecretKey 객체로 변환합니다.
     */
    @PostConstruct
    public void init() {
        byte[] keyBytes = Decoders.BASE64.decode(this.secretKeyPlain);
        this.key = Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * 사용자의 고유 ID(userId), 이메일, 역할을 받아 JWT Access Token을 발급합니다.
     */
    public String createToken(String userId, String email, String role) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(userId)                            // 토큰 주체(PK인 userId 저장)
                .claim("email", email)                      // 클레임: 이메일
                .claim("role", role)                        // 클레임: 역할 (예: ROLE_USER)
                .issuedAt(now)                              // 발행 시간
                .expiration(expiryDate)                     // 만료 시간
                .signWith(key)                              // 디코딩한 SecretKey로 서명 (JJWT 0.12.x 스펙)
                .compact();
    }

    /**
     * 토큰 복호화를 통해 토큰 본문(Claims)을 가져옵니다.
     */
    public Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)                            // 서명 키 등록
                .build()
                .parseSignedClaims(token)                   // 서명 검증 및 파싱
                .getPayload();                              // Claims 본문 반환 (JJWT 0.12.x 스펙)
    }

    /**
     * JWT 토큰에서 사용자 식별 정보와 권한을 꺼내 스프링 시큐리티의 Authentication 객체를 생성합니다.
     */
    public Authentication getAuthentication(String token) {
        Claims claims = getClaims(token);

        String roleStr = claims.get("role", String.class);
        if (roleStr != null && roleStr.startsWith("ROLE_")) {
            roleStr = roleStr.substring(5);
        }
        com.dm.travel_planner.domain.user.entity.UserRole roleEnum = com.dm.travel_planner.domain.user.entity.UserRole.USER;
        if (roleStr != null) {
            try {
                roleEnum = com.dm.travel_planner.domain.user.entity.UserRole.valueOf(roleStr);
            } catch (Exception ignored) {}
        }
        
        // 1. 토큰 내 식별 데이터로 도메인 유저 임시 더미 객체 빌드 (근본 해결: 안전한 roleEnum 매칭)
        com.dm.travel_planner.domain.user.entity.User dummyUser = 
                com.dm.travel_planner.domain.user.entity.User.builder()
                .userId(claims.getSubject())
                .email(claims.get("email", String.class))
                .nickname("")
                .role(roleEnum)
                .build();
                
        // 2. 도메인 유저 객체로 커스텀 UserPrincipal 엠블럼 생성
        UserPrincipal principal = new UserPrincipal(dummyUser);
        Collection<? extends GrantedAuthority> authorities = principal.getAuthorities();

        // 3. 커스텀 UserPrincipal을 principal로 전달하여 컨트롤러 형변환 오류 해결
        return new UsernamePasswordAuthenticationToken(principal, token, authorities);
    }

    /**
     * JWT 토큰의 유효성(서명 검증, 만료일 검사 등)을 판단합니다.
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (SecurityException | MalformedJwtException e) {
            log.error("잘못된 JWT 서명입니다.");
        } catch (ExpiredJwtException e) {
            log.error("만료된 JWT 토큰입니다.");
        } catch (UnsupportedJwtException e) {
            log.error("지원되지 않는 JWT 토큰입니다.");
        } catch (IllegalArgumentException e) {
            log.error("JWT 토큰 구조가 잘못되었습니다.");
        }
        return false;
    }
}
