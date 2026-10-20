package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvestmentHoldingsViewTest {
    @Mock AccountRepository accounts;
    @Mock InvestmentRepository holdings;
    @Mock InvestmentTransactionRepository transactions;
    @Mock InvestmentAccountProfileRepository profiles;
    @Mock InvestmentTargetAllocationRepository targets;
    @Mock InvestmentAccountSnapshotRepository snapshots;
    @Mock InvestmentNoteRepository notes;
    @InjectMocks InvestmentService service;
    @Test void partialSaleRemainsFullSaleDisappearsAndRepurchaseReturnsWithoutDeletingHistory() {
        var account=Account.builder().accountId("a").userId("u").accountType(AccountType.INVESTMENT).currency(Currency.JPY).cachedBookBalance(new BigDecimal("1000")).build();
        var stock=Investment.builder().investmentId("h").accountId("a").userId("u").tickerCode("7203").symbolName("日本株").assetClass(InvestmentAssetClass.FOREIGN_STOCK).market("TSE").currency(Currency.JPY).build();
        var cash=Investment.builder().investmentId("c").accountId("a").userId("u").tickerCode("CASH").assetClass(InvestmentAssetClass.CASH).currency(Currency.JPY).build();
        stock.applyBuy(new BigDecimal("2"),new BigDecimal("100"),BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO);
        when(accounts.findByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));
        when(profiles.findById("a")).thenReturn(Optional.of(InvestmentAccountProfile.builder().accountId("a").build()));
        when(holdings.findByAccountIdAndUserIdAndTickerCode("a","u","CASH")).thenReturn(Optional.of(cash));
        when(holdings.findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc("a","u")).thenReturn(List.of(stock,cash));
        when(transactions.sumDividendBetween(anyList(),any(),any(),any())).thenReturn(BigDecimal.ZERO);
        when(transactions.sumRealizedProfitLoss(anyList(),any())).thenReturn(new BigDecimal("100"));
        stock.applySell(BigDecimal.ONE,new BigDecimal("150"),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ONE);
        assertThat(service.getDetail("a","u").holdings()).anyMatch(h->"h".equals(h.investmentId())&&h.quantity().compareTo(BigDecimal.ONE)==0);
        stock.applySell(BigDecimal.ONE,new BigDecimal("150"),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ONE);
        var closed=service.getDetail("a","u");
        assertThat(closed.holdings()).noneMatch(h->"h".equals(h.investmentId()));
        assertThat(closed.performance().realizedProfitLoss()).isEqualByComparingTo("100");
        stock.applyBuy(BigDecimal.ONE,new BigDecimal("120"),BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO);
        assertThat(service.getDetail("a","u").holdings()).anyMatch(h->"h".equals(h.investmentId()));
        verify(holdings,never()).delete(any());
    }
}
