package com.dm.travel_planner.domain.workspace;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Private calendar and learning documents share identity, ownership and revision rules. */
@Entity
@Table(name = "workspace_entries", indexes = {
    @Index(name = "idx_workspace_owner_kind", columnList = "user_id,kind"),
    @Index(name = "idx_workspace_parent", columnList = "user_id,parent_id")
})
@Getter @Setter @NoArgsConstructor
public class WorkspaceEntry {
    public enum Kind { EVENT, TEMPLATE, ROADMAP, MILESTONE, TASK, SCHEDULE, RECORD, COMMENT, PDF, WORD, MEMO }
    @Id @Column(length = 36) private String id;
    @Column(name = "user_id", nullable = false, length = 50) private String userId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Kind kind;
    @Column(name = "parent_id", length = 36) private String parentId;
    @Column(nullable = false, length = 200) private String title;
    @Column(columnDefinition = "text", nullable = false) private String body = "";
    private LocalDate startDate;
    private LocalDate endDate;
    private boolean completed;
    private int position;
    @Column(nullable = false, length = 20) private String format = "plain";
    @Column(columnDefinition = "text", nullable = false) private String details = "{}";
    @Column(nullable = false) private LocalDateTime createdAt;
    @Column(nullable = false) private LocalDateTime updatedAt;
    @Version private Long version;
}
