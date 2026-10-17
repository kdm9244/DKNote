package com.dm.travel_planner.domain.checklist.dto;

import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachmentScope;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistAttachmentResponse {
    private String attachmentId;
    private String fileUrl;
    private String fileName;
    private String contentType;
    private long fileSize;
    private LocalDateTime createdAt;
    private ChecklistAttachmentScope scope;
    private String uploadedByName;
    private boolean deletable;
}
