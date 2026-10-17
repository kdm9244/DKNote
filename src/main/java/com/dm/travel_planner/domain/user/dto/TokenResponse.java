package com.dm.travel_planner.domain.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@AllArgsConstructor
@Builder
public class TokenResponse {
    private String accessToken;
    private String tokenType; // "Bearer"로 지정될 예정입니다.
}
