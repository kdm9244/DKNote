package com.dm.travel_planner.domain.trip.entity;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "trips")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Trip {

    @Id
    @Column(name = "trip_id", length = 50)
    private String tripId;

    @Column(name = "owner_id", nullable = false, length = 50)
    private String ownerId;

    @Column(length = 200) private String destination;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "legacy_archive", columnDefinition = "TEXT") private String legacyArchive;
    @Builder.Default @Column(nullable = false, length = 60) private String timezone = "Asia/Seoul";

    @Column(name = "title", nullable = false, length = 100)
    private String title;


    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;



    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 0;
    
    @Column(name ="description", length = 255)
    private String description;


    @Setter
    @Column(name = "custom_target_budget")
    private Integer customTargetBudget;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "trip", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Day> days = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        if (this.tripId == null) {
            this.tripId = UUID.randomUUID().toString().replace("-", "");
        }
    }
}