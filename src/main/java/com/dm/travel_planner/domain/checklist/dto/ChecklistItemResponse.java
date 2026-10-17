package com.dm.travel_planner.domain.checklist.dto;

import com.dm.travel_planner.domain.checklist.entity.ChecklistScope;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistItemResponse {
    private String itemId;
    private String tripId;
    private String category;
    private String title;
    private boolean isChecked;
    private ChecklistScope scope;
    private String ownerId;
    private String ownerName;
    private String createdById;
    private String createdByName;
    private List<ChecklistAttachmentResponse> attachments;
    private String linkUrl;
    private String memo;
    private int sequence;
    private LocalDateTime createdAt;
    private boolean editable;
    private boolean deletable;
    private boolean toggleable;
    private boolean attachmentEditable;
}
