package com.dm.travel_planner.domain.checklist.dto;

import com.dm.travel_planner.domain.checklist.entity.ChecklistScope;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistItemUpdateRequest {
    private String category;
    private String title;
    private Boolean isChecked;
    private ChecklistScope scope;
    private String linkUrl;
    private String memo;
}
