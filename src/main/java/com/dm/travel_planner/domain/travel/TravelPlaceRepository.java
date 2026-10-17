package com.dm.travel_planner.domain.travel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TravelPlaceRepository extends JpaRepository<TravelPlace,String> {
    List<TravelPlace> findByTrip_TripIdOrderByTitleAsc(String id);
}
