package com.dm.travel_planner.global.security;

import com.dm.travel_planner.domain.user.entity.User;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

@Getter
public class UserPrincipal implements UserDetails, OAuth2User {

    private final String userId;
    private final String email;
    private final String nickname;
    private final String role; // "USER" 또는 "ADMIN" 표준 이넘명 저장 필드 추가
    private final Collection<? extends GrantedAuthority> authorities;
    private final Map<String, Object> attributes; // 구글 소셜 로그인 시 유저 속성 맵 저장용

    // 일반(Local) 로그인 시 사용하는 생성자
    public UserPrincipal(User user) {
        this.userId = user.getUserId();
        this.email = user.getEmail();
        this.nickname = user.getNickname();
        this.role = user.getRole().name(); // 이넘의 순수 이름("USER") 대입
        this.authorities = Collections.singletonList(new SimpleGrantedAuthority(user.getRole().getAuthority()));
        this.attributes = Collections.emptyMap();
    }

    // 소셜(OAuth2) 로그인 시 사용하는 생성자
    public UserPrincipal(User user, Map<String, Object> attributes) {
        this.userId = user.getUserId();
        this.email = user.getEmail();
        this.nickname = user.getNickname();
        this.role = user.getRole().name(); // 이넘의 순수 이름("USER") 대입
        this.authorities = Collections.singletonList(new SimpleGrantedAuthority(user.getRole().getAuthority()));
        this.attributes = attributes;
    }

    // --- OAuth2User 인터페이스 구현 메서드 ---
    @Override
    public Map<String, Object> getAttributes() {
        return attributes;
    }

    @Override
    public String getName() {
        return userId; // 시큐리티 내부 식별자로 유저 고유 ID(UUID) 사용
    }

    // --- UserDetails 인터페이스 구현 메서드 ---
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return null; // 패스워드는 노출하지 않거나 암호화 검증이 이미 끝난 후 세션 관리용으로만 쓰이므로 null 반환
    }

    @Override
    public String getUsername() {
        return email; // 로그인 아이디인 이메일 반환
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
