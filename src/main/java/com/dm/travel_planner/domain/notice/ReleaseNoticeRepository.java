package com.dm.travel_planner.domain.notice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ReleaseNoticeRepository extends JpaRepository<ReleaseNotice,String> {
    List<ReleaseNotice> findTop100ByOrderByCreatedAtDesc();
    List<ReleaseNotice> findTop5ByOrderByCreatedAtDesc();
}
