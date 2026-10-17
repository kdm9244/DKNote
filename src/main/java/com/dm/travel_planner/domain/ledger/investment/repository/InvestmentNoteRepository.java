package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestmentNoteRepository extends JpaRepository<InvestmentNote, String> {
    List<InvestmentNote> findTop10ByAccountIdAndUserIdOrderByIsPinnedDescUpdatedAtDesc(String accountId, String userId);
    Optional<InvestmentNote> findByNoteIdAndUserId(String noteId, String userId);
    void deleteByAccountIdAndUserId(String accountId, String userId);
}
