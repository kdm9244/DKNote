package com.dm.travel_planner.domain.workspace;

import jakarta.persistence.*;
import lombok.*;

@Entity @Table(name = "workspace_preferences") @Getter @Setter @NoArgsConstructor
public class WorkspacePreferences {
    @Id @Column(name = "user_id", length = 50) private String userId;
    @Column(columnDefinition = "text", nullable = false) private String settings = "{}";
    @Version private Long version;
}
