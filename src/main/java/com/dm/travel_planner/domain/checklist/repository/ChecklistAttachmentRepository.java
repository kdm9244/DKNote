package com.dm.travel_planner.domain.checklist.repository;

import com.dm.travel_planner.domain.checklist.entity.ChecklistAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistAttachmentRepository extends JpaRepository<ChecklistAttachment, String> {
    List<ChecklistAttachment> findByChecklistItem_ItemIdOrderByCreatedAtAsc(String itemId);

    List<ChecklistAttachment> findByChecklistItem_ItemIdAndUploadedBy_UserIdOrderByCreatedAtAsc(
            String itemId,
            String userId);
}
