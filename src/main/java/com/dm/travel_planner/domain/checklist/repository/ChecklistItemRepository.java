package com.dm.travel_planner.domain.checklist.repository;

import com.dm.travel_planner.domain.checklist.entity.ChecklistItem;
import com.dm.travel_planner.domain.checklist.entity.ChecklistScope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, String> {
    List<ChecklistItem> findByTrip_TripIdOrderByCategoryAscSequenceAscCreatedAtAsc(String tripId);

    @Query("""
        select c from ChecklistItem c
        where c.trip.tripId = :tripId
          and (c.scope = com.dm.travel_planner.domain.checklist.entity.ChecklistScope.SHARED
               or c.scope is null
               or (c.scope = com.dm.travel_planner.domain.checklist.entity.ChecklistScope.PERSONAL
                   and c.owner.userId = :userId))
        order by c.category asc, c.sequence asc, c.createdAt asc
        """)
    List<ChecklistItem> findVisibleItems(
            @Param("tripId") String tripId,
            @Param("userId") String userId);

    @Query("""
        select c from ChecklistItem c
        where c.trip.tripId = :tripId
          and (c.scope = :scope or (:scope = com.dm.travel_planner.domain.checklist.entity.ChecklistScope.SHARED and c.scope is null))
          and (:scope = com.dm.travel_planner.domain.checklist.entity.ChecklistScope.SHARED or c.owner.userId = :userId)
        order by c.category asc, c.sequence asc, c.createdAt asc
        """)
    List<ChecklistItem> findByScopeForUser(
            @Param("tripId") String tripId,
            @Param("scope") ChecklistScope scope,
            @Param("userId") String userId);

}
