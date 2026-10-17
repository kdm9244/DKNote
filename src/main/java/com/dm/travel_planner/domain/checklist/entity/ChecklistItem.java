package com.dm.travel_planner.domain.checklist.entity;

import com.dm.travel_planner.domain.trip.entity.Trip;
import com.dm.travel_planner.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * [여행 준비물 체크리스트 항목 엔티티]
 */
@Entity
@Table(name = "checklist_items")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class ChecklistItem {

    @Id
    @Column(name = "item_id", length = 50)
    private String itemId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;

    @Column(name = "category", nullable = false, length = 50)
    private String category; // 예: "서류/티켓", "전자기기", "의류/세면", "비상약/기타"

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "is_checked", nullable = false)
    @Builder.Default
    private boolean isChecked = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 20, columnDefinition = "varchar(20) default 'SHARED'")
    @Builder.Default
    private ChecklistScope scope = ChecklistScope.SHARED;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_id")
    private User createdBy;



    @Column(name = "link_url", length = 500)
    private String linkUrl; // 외부 링크 URL

    @Column(name = "memo", columnDefinition = "TEXT")
    private String memo; // 세부 메모

    @Column(name = "sequence", nullable = false)
    @Builder.Default
    private int sequence = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.itemId == null) {
            this.itemId = UUID.randomUUID().toString().replace("-", "");
        }
        if (this.scope == null) {
            this.scope = ChecklistScope.SHARED;
        }
    }
}
