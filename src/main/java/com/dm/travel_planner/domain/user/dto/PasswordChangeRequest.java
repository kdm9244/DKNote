package com.dm.travel_planner.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PasswordChangeRequest {
    @NotBlank(message = "현재 비밀번호를 입력해 주세요.")
    private String currentPassword;

    @NotBlank(message = "새 비밀번호를 입력해 주세요.")
    @Size(min = 4, max = 100, message = "새 비밀번호는 4자 이상 100자 이하로 입력해 주세요.")
    private String newPassword;
}
