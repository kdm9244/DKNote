package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.domain.trip.entity.Trip;
import jakarta.persistence.*;
import lombok.*;
@Entity @Table(name="travel_places",indexes=@Index(name="travel_places_trip_idx",columnList="trip_id")) @Getter @Setter @NoArgsConstructor
public class TravelPlace {
    @Id @Column(length=50) private String id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="trip_id",nullable=false) private Trip trip;
    @Column(nullable=false,length=100) private String title;
    @Column(length=200) private String address;
    @Column(length=500) private String url;
    @Column(columnDefinition="TEXT") private String memo;
    @Version private long version;
}
