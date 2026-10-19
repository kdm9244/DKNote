package com.dm.travel_planner.domain.user.service;
import com.dm.travel_planner.domain.user.dto.LoginRequest;
import com.dm.travel_planner.domain.user.entity.*;
import com.dm.travel_planner.domain.user.repository.UserRepository;
import com.dm.travel_planner.global.security.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
class PublisherLoginTest {
    @Test void publisherUsesUsernameWhileOrdinaryUsersStillFollowAllowlist(){
        var users=mock(UserRepository.class);var encoder=mock(PasswordEncoder.class);var jwt=mock(JwtTokenProvider.class);
        var service=new UserService(users,encoder,jwt,new LoginPolicy("owner@example.com"));
        var publisher=User.builder().userId("p").email("kdeok").role(UserRole.NOTICE_PUBLISHER).provider(AuthProvider.LOCAL).password("hash").build();
        when(users.findByEmail("kdeok")).thenReturn(Optional.of(publisher));when(encoder.matches("password","hash")).thenReturn(true);when(jwt.createToken("p","kdeok","NOTICE_PUBLISHER")).thenReturn("jwt");
        assertThat(service.login(new LoginRequest("kdeok","password")).getAccessToken()).isEqualTo("jwt");
        when(users.findByEmail("kdeok")).thenReturn(Optional.of(User.builder().email("kdeok").role(UserRole.USER).provider(AuthProvider.LOCAL).build()));
        assertThatThrownBy(()->service.login(new LoginRequest("kdeok","password"))).hasMessageContaining("403");
    }
    @Test void wrongPasswordDoesNotIssueToken(){
        var users=mock(UserRepository.class);var encoder=mock(PasswordEncoder.class);var jwt=mock(JwtTokenProvider.class);
        when(users.findByEmail("publisher")).thenReturn(Optional.of(User.builder().email("publisher").role(UserRole.NOTICE_PUBLISHER).provider(AuthProvider.LOCAL).password("hash").build()));
        assertThatThrownBy(()->new UserService(users,encoder,jwt,new LoginPolicy("")).login(new LoginRequest("publisher","wrong"))).isInstanceOf(IllegalArgumentException.class);verifyNoInteractions(jwt);
    }
}
