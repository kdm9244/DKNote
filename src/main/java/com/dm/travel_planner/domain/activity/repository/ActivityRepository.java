package com.dm.travel_planner.domain.activity.repository;
import com.dm.travel_planner.domain.activity.entity.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ActivityRepository extends JpaRepository<Activity,String> {
    List<Activity> findByDay_DayIdOrderBySequenceAsc(String dayId);
}
