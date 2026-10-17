package com.dm.travel_planner.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UserProfileUpdateRequest {
    @NotBlank(message = "닉네임을 입력해 주세요.")
    @Size(max = 50, message = "닉네임은 50자 이하로 입력해 주세요.")
    private String nickname;
}
