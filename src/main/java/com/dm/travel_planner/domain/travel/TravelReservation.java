package com.dm.travel_planner.domain.travel;
import com.dm.travel_planner.domain.trip.entity.Trip;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="travel_reservations",indexes=@Index(name="travel_reservations_trip_idx",columnList="trip_id")) @Getter @Setter @NoArgsConstructor
public class TravelReservation {
    @Id @Column(length=50) private String id;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="trip_id",nullable=false) private Trip trip;
    @Column(nullable=false,length=100) private String title;
    @Column(nullable=false,length=20) private String type;
    @Column(nullable=false,length=20) private String status;
    @Column(length=200) private String address;
    @Column(length=100) private String confirmation;
    @Column(length=500) private String url;
    @Column(columnDefinition="TEXT") private String memo;
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private LocalDateTime cancelBy;
    @Column(length=50) private String activityId;
    @Column(nullable=false,length=50) private String attachmentItemId;
    @Version private long version;
}
