package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import com.dm.travel_planner.domain.ledger.investment.dto.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class InvestmentSettlementTest {
    @Mock AccountRepository accounts;
    @Mock InvestmentRepository holdings;
    @Mock InvestmentTransactionRepository transactions;
    @Mock InvestmentAccountSnapshotRepository snapshots;
    @InjectMocks InvestmentService service;
    Account account;
    Investment cash;
    static BigDecimal d(String n) { return new BigDecimal(n); }
    @BeforeEach void setup() {
        account=Account.builder().accountId("a").userId("u").accountType(AccountType.INVESTMENT)
                .currency(Currency.KRW).cachedBookBalance(d("1500000")).initialBalanceDate(LocalDate.of(2020,1,1)).build();
        cash=Investment.builder().investmentId("cash").accountId("a").userId("u").assetClass(InvestmentAssetClass.CASH).build();
        when(accounts.findForUpdateByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));
    }
    InvestmentSettlementRequest request(String actual,String profit,String expected,boolean confirmed) {
        return new InvestmentSettlementRequest(d(expected),actual==null?null:d(actual),profit==null?null:d(profit),LocalDate.now(),confirmed,"test","request-1",0L,false);
    }
    void cashHolding() { when(holdings.findByAccountIdAndUserIdAndTickerCode("a","u","CASH")).thenReturn(Optional.of(cash)); }
    InvestmentTransaction settlement(String amount) {
        return InvestmentTransaction.builder().investmentTransactionId("s").investmentId("cash")
                .tradeType(InvestmentTradeType.PROFIT_SETTLEMENT).tradeDate(LocalDate.now().atTime(12,0))
                .netAmount(d(amount)).realizedProfitLoss(d(amount)).grossAmount(d(amount).abs()).build();
    }
    void existing(InvestmentTransaction tx) {
        when(transactions.findById("s")).thenReturn(Optional.of(tx));
        when(holdings.findByInvestmentIdAndUserId("cash","u")).thenReturn(Optional.of(cash));
    }
    @Test void finalCashAfterRecordedDepositAddsOnlyMissingProfit() {
        cashHolding();var result=service.settleProfit("a","u",request("1600000",null,"1500000",true));
        assertThat(result.realizedProfitLoss()).isEqualByComparingTo("100000");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1600000");
        assertThat(result.tradeType()).isEqualTo(InvestmentTradeType.PROFIT_SETTLEMENT);
    }
    @Test void recordsLossWithoutCreatingHouseholdExpense() {
        cashHolding();var result=service.settleProfit("a","u",request("1400000",null,"1500000",true));
        assertThat(result.realizedProfitLoss()).isEqualByComparingTo("-100000");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1400000");
        verify(transactions).save(argThat(tx -> tx.getTransactionId() == null));
    }
    @Test void sameFinalCashCannotCountExistingTradesAgain() {
        assertThatThrownBy(()->service.settleProfit("a","u",request("1500000",null,"1500000",true))).hasMessageContaining("손익이 없습니다");
        verify(transactions,never()).save(any());
    }
    @Test void retryWithSameRequestIdDoesNotApplyProfitTwice() {
        var tx=settlement("100000");when(transactions.findByExternalTransactionKey(anyString())).thenReturn(Optional.of(tx));
        assertThat(service.settleProfit("a","u",request("1600000",null,"1500000",true)).realizedProfitLoss()).isEqualByComparingTo("100000");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1500000");verify(transactions,never()).save(any());
    }
    @Test void rejectsStaleBalanceBeforeChangingAnything() {
        assertThatThrownBy(()->service.settleProfit("a","u",request("1600000",null,"1000000",true))).hasMessageContaining("409");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1500000");
    }
    @Test void requiresUnchangedPositionConfirmationForCashSettlementWithHoldings() {
        var position=Investment.builder().assetClass(InvestmentAssetClass.DOMESTIC_STOCK).cachedQuantity(BigDecimal.ONE).build();
        when(holdings.findByAccountIdAndUserId("a","u")).thenReturn(List.of(position));
        assertThatThrownBy(()->service.settleProfit("a","u",request("1600000",null,"1500000",true))).hasMessageContaining("보유 종목");
    }
    @Test void cashSettlementWithConfirmedUnchangedHoldingsMatchesActualCashWithoutChangingPosition() {
        cashHolding();
        var position=Investment.builder().assetClass(InvestmentAssetClass.DOMESTIC_STOCK).cachedQuantity(BigDecimal.ONE)
                .cachedAvgBuyPrice(d("30000")).build();
        when(holdings.findByAccountIdAndUserId("a","u")).thenReturn(List.of(position));
        var request=new InvestmentSettlementRequest(d("1500000"),d("1580000"),null,LocalDate.now(),true,"거래 종료 후 현금 정산","confirmed-holdings",null,true);
        var result=service.settleProfit("a","u",request);
        assertThat(result.realizedProfitLoss()).isEqualByComparingTo("80000");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1580000");
        assertThat(position.getCachedQuantity()).isEqualByComparingTo("1");
        assertThat(position.getCachedAvgBuyPrice()).isEqualByComparingTo("30000");
    }
    @Test void acceptsExplicitMissingProfitWithOpenPosition() {
        cashHolding();service.settleProfit("a","u",request(null,"-50000","1500000",true));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1450000");
    }
    @Test void requiresCashFlowConfirmation() {
        assertThatThrownBy(()->service.settleProfit("a","u",request("1600000",null,"1500000",false))).hasMessageContaining("입출금");
    }
    @Test void editChangesOnlyDifferenceAndPreservesLaterCashFlows() {
        var tx=settlement("100000");existing(tx);
        service.editSettlement("a","u","s",request(null,"70000","1500000",true));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1470000");
        assertThat(tx.getRealizedProfitLoss()).isEqualByComparingTo("70000");
    }
    @Test void cancellationReversesOnlyOriginalProfit() {
        var tx=settlement("100000");existing(tx);
        service.cancelSettlement("a","u","s",0,d("1500000"));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1400000");verify(transactions).delete(tx);
    }
    @Test void cancellationOfLossRestoresCash() {
        var tx=settlement("-100000");existing(tx);
        service.cancelSettlement("a","u","s",0,d("1500000"));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1600000");
    }
    @Test void staleVersionCannotUndoSettlement() {
        existing(settlement("100000"));assertThatThrownBy(()->service.cancelSettlement("a","u","s",1,d("1500000"))).hasMessageContaining("409");
    }
    @Test void anotherAccountsSettlementCannotBeEdited() {
        existing(settlement("100000"));when(holdings.findByInvestmentIdAndUserId("cash","u"))
                .thenReturn(Optional.of(Investment.builder().accountId("other").build()));
        assertThatThrownBy(()->service.cancelSettlement("a","u","s",0,d("1500000"))).hasMessageContaining("403");
    }
    @Test void cannotCancelProfitAlreadySpentIfItWouldMakeCashNegative() {
        existing(settlement("2000000"));assertThatThrownBy(()->service.cancelSettlement("a","u","s",0,d("1500000"))).hasMessageContaining("음수");
        verify(transactions,never()).delete(any());
    }
}
