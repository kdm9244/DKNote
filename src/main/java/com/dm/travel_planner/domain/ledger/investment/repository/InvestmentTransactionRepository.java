package com.dm.travel_planner.domain.ledger.investment.repository;

import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface InvestmentTransactionRepository extends JpaRepository<InvestmentTransaction, String> {
    Optional<InvestmentTransaction> findFirstByTransactionId(String transactionId);

    List<InvestmentTransaction> findTop10ByInvestmentIdInOrderByTradeDateDesc(List<String> investmentIds);

    List<InvestmentTransaction> findTop10ByInvestmentIdInAndTradeDateGreaterThanEqualAndTradeDateLessThanOrderByTradeDateDesc(
            List<String> investmentIds, LocalDateTime from, LocalDateTime to);

    List<InvestmentTransaction> findByInvestmentIdInAndTradeDateGreaterThanEqualAndTradeDateLessThanOrderByTradeDateDesc(
            List<String> investmentIds, LocalDateTime from, LocalDateTime to);

    Page<InvestmentTransaction> findByInvestmentIdInAndTradeDateBetween(
            List<String> investmentIds, LocalDateTime from, LocalDateTime to, Pageable pageable);

    Page<InvestmentTransaction> findByInvestmentIdInAndTradeTypeAndTradeDateBetween(
            List<String> investmentIds, InvestmentTradeType tradeType,
            LocalDateTime from, LocalDateTime to, Pageable pageable);

    @Query("SELECT COALESCE(SUM(t.realizedProfitLoss), 0) FROM InvestmentTransaction t " +
            "WHERE t.investmentId IN :investmentIds AND t.tradeType = :tradeType")
    BigDecimal sumRealizedProfitLoss(@Param("investmentIds") List<String> investmentIds,
                                    @Param("tradeType") InvestmentTradeType tradeType);

    @Query("SELECT COALESCE(SUM(t.netAmount), 0) FROM InvestmentTransaction t " +
            "WHERE t.investmentId IN :investmentIds AND t.tradeType = :tradeType " +
            "AND t.tradeDate >= :from AND t.tradeDate < :to")
    BigDecimal sumDividendBetween(@Param("investmentIds") List<String> investmentIds,
                                  @Param("tradeType") InvestmentTradeType tradeType,
                                  @Param("from") LocalDateTime from,
                                  @Param("to") LocalDateTime to);

    void deleteByInvestmentIdIn(List<String> investmentIds);
}
