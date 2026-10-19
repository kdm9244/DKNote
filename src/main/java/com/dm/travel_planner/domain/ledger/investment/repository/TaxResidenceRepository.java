package com.dm.travel_planner.domain.ledger.investment.repository;
import com.dm.travel_planner.domain.ledger.investment.entity.TaxResidence;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TaxResidenceRepository extends JpaRepository<TaxResidence,String> {
    List<TaxResidence> findByUserIdOrderByEffectiveFromAsc(String userId);
}
