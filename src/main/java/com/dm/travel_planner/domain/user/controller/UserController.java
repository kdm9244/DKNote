package com.dm.travel_planner.domain.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.dm.travel_planner.domain.user.dto.UserResponse;
import com.dm.travel_planner.domain.user.dto.UserProfileUpdateRequest;
import com.dm.travel_planner.domain.user.dto.PasswordChangeRequest;
import com.dm.travel_planner.domain.user.entity.User;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.security.UserPrincipal;
import com.dm.travel_planner.domain.user.service.UserService;

import jakarta.validation.Valid;

import lombok.RequiredArgsConstructor;

/**
 * [사용자 정보 조회 컨트롤러]
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final UserService userService;

    /**
     * [현재 로그인한 유저의 프로필 조회 (닉네임 연동)]
     */
    @GetMapping("/myProfile")
    public ResponseEntity<UserResponse> getMyProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        
        UserPrincipal principal = (UserPrincipal) userDetails;
        User user = userRepository.findById(principal.getUserId())
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
                
        return ResponseEntity.ok(UserResponse.from(user));
    }

    @PatchMapping("/myProfile")
    public ResponseEntity<UserResponse> updateMyProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UserProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(principal.getUserId(), request));
    }

    @PatchMapping("/myPassword")
    public ResponseEntity<Void> changeMyPassword(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody PasswordChangeRequest request) {
        userService.changePassword(principal.getUserId(), request);
        return ResponseEntity.noContent().build();
    }
}
