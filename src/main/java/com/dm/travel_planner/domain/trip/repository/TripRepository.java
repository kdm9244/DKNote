package com.dm.travel_planner.domain.trip.repository;
import com.dm.travel_planner.domain.trip.entity.Trip;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface TripRepository extends JpaRepository<Trip,String> {
    List<Trip> findByOwnerIdOrderByStartDateDesc(String ownerId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select t from Trip t where t.tripId = :id")
    Optional<Trip> lockById(@org.springframework.data.repository.query.Param("id") String id);
}
