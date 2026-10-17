package com.dm.travel_planner.domain.travel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TravelReservationRepository extends JpaRepository<TravelReservation,String> {
    List<TravelReservation> findByTrip_TripIdOrderByStartsAtAsc(String id);
}
