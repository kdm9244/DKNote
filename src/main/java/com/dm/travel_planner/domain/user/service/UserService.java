package com.dm.travel_planner.domain.user.service;

import com.dm.travel_planner.domain.user.dto.LoginRequest;
import com.dm.travel_planner.domain.user.dto.SignUpRequest;
import com.dm.travel_planner.domain.user.dto.TokenResponse;
import com.dm.travel_planner.domain.user.dto.UserResponse;
import com.dm.travel_planner.domain.user.dto.UserProfileUpdateRequest;
import com.dm.travel_planner.domain.user.dto.PasswordChangeRequest;
import com.dm.travel_planner.domain.user.entity.AuthProvider;
import com.dm.travel_planner.domain.user.entity.User;
import com.dm.travel_planner.domain.user.entity.UserRole;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
   

    /**
     * 로컬(이메일) 회원가입을 수행합니다.
     */
    @Transactional
    public UserResponse signUp(SignUpRequest request) {
        // 1. 이메일 중복 체크
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("이미 사용 중인 이메일 주소입니다.");
        }

        // 2. 비밀번호 BCrypt 단방향 암호화
        String encodedPassword = passwordEncoder.encode(request.getPassword());
        String cleanUuid = UUID.randomUUID().toString().replace("-", "");

        // 4. User 객체 빌드 및 저장 (LOCAL 방식)
        User user = User.builder()
                .userId(cleanUuid)
                .email(request.getEmail())
                .password(encodedPassword)
                .nickname(request.getNickname())
                .provider(AuthProvider.LOCAL)
                .role(UserRole.USER)
                .build();

        User savedUser = userRepository.save(user);
        log.info("로컬 회원가입 완료 - email: {}", savedUser.getEmail());



        return UserResponse.from(savedUser);
    }

    /**
     * 로컬(이메일) 로그인을 수행하고 JWT 토큰을 발급합니다.
     */
    public TokenResponse login(LoginRequest request) {
        // 1. 이메일로 사용자 조회
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다."));

        // 2. 가입 공급자(Provider) 검증
        if (user.getProvider() != AuthProvider.LOCAL) {
            throw new IllegalArgumentException("소셜 로그인(Google)으로 가입된 계정입니다. 소셜 로그인을 이용해 주세요.");
        }

        // 3. 비밀번호 대조
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 4. JWT 토큰 발급 (근본 원인 해결: ROLE_USER가 아닌 USER로 저장)
        String accessToken = jwtTokenProvider.createToken(
                user.getUserId(),
                user.getEmail(),
                user.getRole().name()
        );

        log.info("로컬 로그인 성공 - email: {}", user.getEmail());

        return TokenResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .build();
    }

    @Transactional
    public UserResponse updateProfile(String userId, UserProfileUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        user.updateNickname(request.getNickname().trim());
        return UserResponse.from(userRepository.save(user));
    }

    @Transactional
    public void changePassword(String userId, PasswordChangeRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
        if (user.getProvider() != AuthProvider.LOCAL) {
            throw new IllegalArgumentException("Google 로그인 계정은 여기에서 비밀번호를 변경할 수 없습니다.");
        }
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new IllegalArgumentException("현재 비밀번호가 올바르지 않습니다.");
        }
        user.changePassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    /**
     * 신규 가입 유저의 개인 팀(워크스페이스)을 만들어 주는 메서드입니다.
     */

}
