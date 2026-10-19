package com.dm.travel_planner.domain.notice;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity @Table(name="release_notices") @Getter @Setter @NoArgsConstructor
public class ReleaseNotice {
    @Id @Column(length=36) private String id;
    @Column(nullable=false,length=200) private String title;
    @Column(nullable=false,length=40) private String releaseVersion;
    @Column(nullable=false,columnDefinition="text") private String body;
    @Column(nullable=false,length=50) private String authorId;
    @Column(nullable=false) private LocalDateTime createdAt;
    @Column(nullable=false) private LocalDateTime updatedAt;
    @Version private Long version;
}
