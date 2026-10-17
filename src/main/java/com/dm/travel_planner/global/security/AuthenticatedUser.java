package com.dm.travel_planner.global.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class AuthenticatedUser {
    private AuthenticatedUser() {}

    public static String id(Object principal) {
        if (principal instanceof UserPrincipal user && user.getUserId() != null && !user.getUserId().isBlank()) {
            return user.getUserId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다.");
    }
}
