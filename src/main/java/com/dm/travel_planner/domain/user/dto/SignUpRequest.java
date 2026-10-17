package com.dm.travel_planner.domain.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SignUpRequest {

    @NotBlank(message = "이메일은 필수 입력 사항입니다.")
    @Email(message = "올바른 이메일 형식이어야 합니다.")
    @Size(max = 100)
    private String email;

    @NotBlank(message = "비밀번호는 필수 입력 사항입니다.")
    @Size(min = 4, max = 100, message = "비밀번호는 4자 이상 100자 이하이어야 합니다.")
    private String password;

    @NotBlank(message = "닉네임은 필수 입력 사항입니다.")
    @Size(max = 50)
    private String nickname;
}
