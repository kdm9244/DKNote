package com.dm.travel_planner.domain.checklist.entity;

import com.dm.travel_planner.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "checklist_attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ChecklistAttachment {

    @Id
    @Column(name = "attachment_id", length = 50)
    private String attachmentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "item_id", nullable = false)
    private ChecklistItem checklistItem;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by_id")
    private User uploadedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20, columnDefinition = "varchar(20) default 'PERSONAL'")
    @Builder.Default
    private ChecklistAttachmentScope scope = ChecklistAttachmentScope.PERSONAL;

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 150)
    private String contentType;

    @Column(name = "file_size")
    private long fileSize;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (attachmentId == null) {
            attachmentId = UUID.randomUUID().toString().replace("-", "");
        }
        if (scope == null) {
            scope = ChecklistAttachmentScope.PERSONAL;
        }
    }

    public void relocateFile(String reference) { this.fileUrl=reference; }
}
