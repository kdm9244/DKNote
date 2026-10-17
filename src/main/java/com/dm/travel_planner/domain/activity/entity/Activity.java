package com.dm.travel_planner.domain.activity.entity;

import com.dm.travel_planner.domain.trip.entity.Day;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "activities")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Activity {

    @Id
    @Column(name = "activity_id", length = 50)
    private String activityId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "day_id", nullable = false)
    private Day day;

    @Column(name = "sequence", nullable = false)
    private int sequence;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_type", nullable = false, length = 20)
    private ActivityType activityType;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "short_intro", columnDefinition = "TEXT")
    private String shortIntro;

    @Column(name = "departure_location", length = 200)
    private String departureLocation;

    @Column(name = "arrival_location", length = 200)
    private String arrivalLocation;

    // 기존 데이터의 저장 위치를 유지하되 애플리케이션에서는 모든 일정의 공통 장소로 사용한다.
    @Column(name = "meeting_location", length = 200)
    private String location;


    @Column(name = "cost", precision = 18, scale = 2)
    @Builder.Default
    private java.math.BigDecimal cost = java.math.BigDecimal.ZERO;

    @Version @Builder.Default private long version = 0;
    @Builder.Default @Column(nullable = false, length = 10) private String currency = "KRW";
    @Column(name = "fx_rate", precision = 18, scale = 6) private java.math.BigDecimal fxRate;
    @Builder.Default @Column(name = "travel_minutes", nullable = false) private int travelMinutes = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (this.activityId == null) {
            this.activityId = UUID.randomUUID().toString().replace("-", "");
        }
    }
}
