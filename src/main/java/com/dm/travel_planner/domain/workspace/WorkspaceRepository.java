package com.dm.travel_planner.domain.workspace;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface WorkspaceRepository extends JpaRepository<WorkspaceEntry, String> {
    List<WorkspaceEntry> findByUserIdOrderByPositionAscCreatedAtAsc(String userId);
    Optional<WorkspaceEntry> findByIdAndUserId(String id, String userId);
    List<WorkspaceEntry> findByParentIdAndUserId(String parentId, String userId);
}
