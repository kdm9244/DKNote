package com.dm.travel_planner.domain.checklist.dto;

import org.springframework.core.io.Resource;

public record ChecklistAttachmentDownload(
        Resource resource,
        String fileName,
        String contentType) {
}
