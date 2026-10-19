package com.dm.travel_planner.domain.ledger.investment.repository;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface InvestmentTaxRecordRepository extends JpaRepository<InvestmentTaxRecord,String> {
    List<InvestmentTaxRecord> findByUserIdAndTaxYear(String userId,int taxYear);
}
