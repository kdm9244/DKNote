package com.dm.travel_planner.domain.user.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum UserRole {
    USER("ROLE_USER"),
    ADMIN("ROLE_ADMIN"),
    NOTICE_PUBLISHER("ROLE_NOTICE_PUBLISHER");

    private final String authority;
}
