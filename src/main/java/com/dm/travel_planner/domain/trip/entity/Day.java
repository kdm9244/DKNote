package com.dm.travel_planner.domain.trip.entity;

import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;
import java.util.UUID;

import com.dm.travel_planner.domain.activity.entity.Activity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "days")
@Getter
@lombok.Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Day {

    @Id
    @Column(name = "day_id", length = 50)
    private String dayId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trip_id", nullable = false)
    private Trip trip;
    
    @Column(name = "day_number", nullable = false)
    private int dayNumber;
    
    @Column(name = "travel_date", nullable = false)
    private LocalDate travelDate;
    
    @OneToMany(mappedBy = "day", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Activity> activities = new ArrayList<>();
    
    @PrePersist
    public void prePersist() {
        if (this.dayId == null) {
            this.dayId = UUID.randomUUID().toString().replace("-", "");
        }
    }
}
