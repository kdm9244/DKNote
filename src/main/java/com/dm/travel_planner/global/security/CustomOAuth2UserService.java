package com.dm.travel_planner.global.security;

import com.dm.travel_planner.domain.user.entity.AuthProvider;
import com.dm.travel_planner.domain.user.entity.User;
import com.dm.travel_planner.domain.user.entity.UserRole;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {
	
    private final UserRepository userRepository;
    private final LoginPolicy loginPolicy;

    @Override
    @Transactional
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        // Google 리소스 서버에서 사용자 정보를 받아옵니다.
        OAuth2User oAuth2User = super.loadUser(userRequest);

        try {
            return processOAuth2User(userRequest, oAuth2User);
        } catch (Exception ex) {
            log.error("OAuth2 로그인 처리 에러: ", ex);
            // 시큐리티 내부에서 예외를 캐치해 실패 핸들러로 넘겨주기 위해 OAuth2AuthenticationException로 던집니다.
            throw new OAuth2AuthenticationException(ex.getMessage());
        }
    }

    /**
     * 받아온 소셜 정보를 검증하고, 회원가입 또는 기존 회원 반환 처리를 수행합니다.
     */
    private OAuth2User processOAuth2User(OAuth2UserRequest userRequest, OAuth2User oAuth2User) {
        String registrationId = userRequest.getClientRegistration().getRegistrationId(); // "google"
        Map<String, Object> attributes = oAuth2User.getAttributes();

        if (!"google".equalsIgnoreCase(registrationId)) {
            throw new IllegalArgumentException("지원하지 않는 소셜 로그인 제공자입니다: " + registrationId);
        }

        String email = (String) attributes.get("email");
        String name = (String) attributes.get("name");

        if (email == null) {
            throw new IllegalArgumentException("구글 소셜 계정의 이메일 정보가 비어있습니다.");
        }
        if(!Boolean.TRUE.equals(attributes.get("email_verified"))&&!Boolean.TRUE.equals(attributes.get("verified_email")))throw new IllegalArgumentException("인증된 구글 이메일이 필요합니다.");
        loginPolicy.requireAllowed(email);

        // DB에서 사용자 조회
        User user = userRepository.findByEmail(email)
                .map(existingUser -> {
                    // LOCAL 계정으로 동일 이메일이 가입되어 있다면 예외 발생
                    if (existingUser.getProvider() != AuthProvider.GOOGLE) {
                        throw new IllegalArgumentException("이미 이메일 회원가입으로 등록된 계정입니다. 일반 로그인을 해주세요.");
                    }
                    return existingUser;
                })
                .orElseGet(() -> registerNewGoogleUser(email, name)); // 신규 구글 회원이면 자동 회원가입

        return new UserPrincipal(user, attributes);
    }

    /**
     * 신규 구글 회원을 가입 처리합니다.
     */
    private User registerNewGoogleUser(String email, String name) {
        // 하이픈(-)을 제외한 32자리 UUID 식별키 생성
        String cleanUuid = UUID.randomUUID().toString().replace("-", "");

        User newGoogleUser = User.builder()
                .userId(cleanUuid)
                .email(email)
                .nickname(name != null ? name : "GoogleUser")
                .provider(AuthProvider.GOOGLE)
                .role(UserRole.USER)
                .build();

        log.info("새로운 구글 유저 등록 완료 - email: {}", email);
        User savedUser = userRepository.save(newGoogleUser);
        

        
        return savedUser;
    }
    

}
