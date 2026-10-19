package com.dm.travel_planner.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {

    @NotBlank(message = "아이디 또는 이메일을 입력하세요.")
    private String email;

    @NotBlank(message = "비밀번호는 필수 입력 사항입니다.")
    private String password;
}
