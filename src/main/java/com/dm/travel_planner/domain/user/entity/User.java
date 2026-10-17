package com.dm.travel_planner.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "user_id", length = 50)
    private String userId;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "password", length = 255)
    private String password;

    @Column(name = "nickname", nullable = false, length = 50)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 20)
    private AuthProvider provider;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private UserRole role;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // 🌟 [추가] 구글 API 호출을 위한 OAuth2 토큰 정보들
    @Column(name = "google_access_token", length = 512)
    private String googleAccessToken;

    @Column(name = "google_refresh_token", length = 512)
    private String googleRefreshToken;

    @Column(name = "google_token_expires_at")
    private LocalDateTime googleTokenExpiresAt;
    @Column(name = "google_granted_scopes", length = 2000)
    private String googleGrantedScopes;

    /**
     * 🌟 [비즈니스 메서드] 구글 계정 연동 시 토큰 정보를 갱신합니다.
     */
    public void updateGoogleTokens(String googleAccessToken, String googleRefreshToken, LocalDateTime googleTokenExpiresAt) {
        this.googleAccessToken = googleAccessToken;
        this.googleRefreshToken = googleRefreshToken;
        this.googleTokenExpiresAt = googleTokenExpiresAt;
        if (googleAccessToken == null) this.googleGrantedScopes = null;
    }
    public void updateGoogleTokens(String access, String refresh, LocalDateTime expiry, String scopes) {
        updateGoogleTokens(access, refresh, expiry); this.googleGrantedScopes = scopes;
    }

    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }

    public void changePassword(String encodedPassword) {
        this.password = encodedPassword;
    }
}
