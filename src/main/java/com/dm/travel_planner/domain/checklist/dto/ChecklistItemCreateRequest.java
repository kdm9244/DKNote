package com.dm.travel_planner.domain.checklist.dto;

import com.dm.travel_planner.domain.checklist.entity.ChecklistScope;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistItemCreateRequest {

    @NotBlank(message = "카테고리는 필수 입력 값입니다.")
    private String category; // "서류/티켓", "전자기기", "의류/세면", "비상약/기타"

    @NotBlank(message = "준비물 제목은 필수 입력 값입니다.")
    private String title;

    private ChecklistScope scope;
    private String linkUrl;
    private String memo;
}
