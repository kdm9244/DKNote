package com.dm.travel_planner.domain.trip.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.dm.travel_planner.domain.trip.entity.Day;

@Repository
public interface DayRepository extends JpaRepository<Day, String> {
    java.util.List<Day> findByTrip_TripIdOrderByDayNumberAsc(String tripId);
}
