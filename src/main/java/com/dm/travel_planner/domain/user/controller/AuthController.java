package com.dm.travel_planner.domain.user.controller;

import com.dm.travel_planner.domain.user.dto.LoginRequest;
import com.dm.travel_planner.domain.user.dto.SignUpRequest;
import com.dm.travel_planner.domain.user.dto.TokenResponse;
import com.dm.travel_planner.domain.user.dto.UserResponse;
import com.dm.travel_planner.domain.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;
    private final com.dm.travel_planner.global.security.LoginPolicy loginPolicy;
    @org.springframework.beans.factory.annotation.Value("${app.security.signup-enabled:true}") private boolean signupEnabled;
    @org.springframework.web.bind.annotation.GetMapping("/policy") public java.util.Map<String,Boolean> policy(){return java.util.Map.of("signupEnabled",signupEnabled);}

    /**
     * 로컬 회원가입 API
     * POST /api/auth/signup
     */
    @PostMapping("/signup")
    public ResponseEntity<UserResponse> signUp(@RequestBody @Valid SignUpRequest request) {
        if(!signupEnabled)throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"신규 회원가입이 비활성화되어 있습니다.");
        loginPolicy.requireAllowed(request.getEmail());
        UserResponse response = userService.signUp(request);
        // 생성 완료 상태(201 Created)와 가입된 회원 정보를 반환합니다.
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 로컬 로그인 API
     * POST /api/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<TokenResponse> login(@RequestBody @Valid LoginRequest request) {
        TokenResponse response = userService.login(request);
        // 로그인 성공 시 200 OK 상태와 발급된 JWT 토큰을 반환합니다.
        return ResponseEntity.ok(response);
    }
}
