package com.dm.travel_planner.domain.user.dto;

import com.dm.travel_planner.domain.user.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class UserResponse {
    private String userId;
    private String email;
    private String nickname;
    private String provider;
    private String role;
    private LocalDateTime createdAt;
    /** Access token itself is never exposed to the client. */
    private boolean googleConnected;

    /**
     * User 엔티티 객체를 외부 응답용 UserResponse DTO 객체로 안전하게 변환하는 정적 팩토리 메서드입니다.
     */
    public static UserResponse from(User user) {
        return UserResponse.builder()
                .userId(user.getUserId())
                .email(user.getEmail())
                .nickname(user.getNickname())
                .provider(user.getProvider().name())
                .role(user.getRole().name())
                .createdAt(user.getCreatedAt())
                .googleConnected(user.getGoogleAccessToken() != null && !user.getGoogleAccessToken().isBlank())
                .build();
    }
}
