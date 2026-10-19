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
class InvestmentCostCorrectionTest {
    @Mock AccountRepository accounts;
    @Mock InvestmentRepository holdings;
    @Mock InvestmentTransactionRepository transactions;
    @Mock InvestmentAccountProfileRepository profiles;
    @Mock InvestmentAccountSnapshotRepository snapshots;
    @Mock InvestmentFeeSettingRepository fees;
    @InjectMocks InvestmentService service;
    Account account;
    Investment holding;
    InvestmentTransaction buy,sell;
    static BigDecimal d(String s){return new BigDecimal(s);}
    @BeforeEach void prepare(){
        account=Account.builder().accountId("a").userId("u").accountType(AccountType.INVESTMENT).currency(Currency.JPY).cachedBookBalance(d("1000")).build();
        holding=Investment.builder().investmentId("h").accountId("a").userId("u").symbolName("日本株").market("TSE").currency(Currency.JPY).build();
        holding.applyBuy(d("2"),d("100"),BigDecimal.ONE,BigDecimal.ZERO,BigDecimal.ZERO);holding.applySell(BigDecimal.ONE,d("150"),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ONE);
        buy=tx("buy",InvestmentTradeType.BUY,"2","100","-200","0",2025);
        sell=tx("sell",InvestmentTradeType.SELL,"1","150","150","50",2026);
    }
    InvestmentTransaction tx(String id,InvestmentTradeType type,String quantity,String price,String net,String profit,int year){return InvestmentTransaction.builder().investmentTransactionId(id).investmentId("h").tradeType(type).quantity(d(quantity)).unitPrice(d(price)).grossAmount(d(quantity).multiply(d(price))).netAmount(d(net)).realizedProfitLoss(d(profit)).currency(Currency.JPY).exchangeRate(BigDecimal.ONE).createdAt(LocalDateTime.of(year,1,2,12,0)).tradeDate(LocalDateTime.of(year,1,2,12,0)).build();}
    void owner(InvestmentTransaction tx){when(accounts.findForUpdateByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));when(transactions.findById(tx.getInvestmentTransactionId())).thenReturn(Optional.of(tx));when(holdings.findByInvestmentIdAndUserId("h","u")).thenReturn(Optional.of(holding));}
    InvestmentCostEditRequest edit(String fee,String tax,long version){return new InvestmentCostEditRequest(d(fee),d(tax),InvestmentTaxKind.WITHHOLDING_TAX,"証券会社の明細",version);}
    @Test void correctingPastBuyRecalculatesSubsequentSaleAndRemainingBasis(){
        owner(buy);when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("h")).thenReturn(List.of(buy,sell));
        service.correctCosts("a","u","buy",edit("20","0",0));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("980");assertThat(holding.getCachedQuantity()).isEqualByComparingTo("1");assertThat(holding.getCachedAvgBuyPriceBase()).isEqualByComparingTo("110");assertThat(sell.getRealizedProfitLoss()).isEqualByComparingTo("40");
    }
    @Test void correctingSaleTaxUpdatesCashAndProfitWithoutChangingBasis(){
        owner(sell);service.correctCosts("a","u","sell",edit("0","10",0));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("990");assertThat(sell.getRealizedProfitLoss()).isEqualByComparingTo("40");assertThat(sell.getNetAmount()).isEqualByComparingTo("140");assertThat(holding.getCachedAvgBuyPriceBase()).isEqualByComparingTo("100");
    }
    @Test void repeatedSameAmountsDoNotChargeCashTwice(){
        owner(sell);service.correctCosts("a","u","sell",edit("0","10",0));service.correctCosts("a","u","sell",edit("0","10",0));assertThat(account.getCachedBookBalance()).isEqualByComparingTo("990");assertThat(sell.getRealizedProfitLoss()).isEqualByComparingTo("40");
    }
    @Test void refusesStaleRevision(){owner(sell);assertThatThrownBy(()->service.correctCosts("a","u","sell",edit("0","10",3))).hasMessageContaining("409");assertThat(account.getCachedBookBalance()).isEqualByComparingTo("1000");}
    @Test void rejectsCostsExceedingSaleProceeds(){owner(sell);assertThatThrownBy(()->service.correctCosts("a","u","sell",edit("0","151",0))).hasMessageContaining("400");assertThat(sell.getTaxAmount()).isZero();}
    @Test void refusesBuyReplayWithMissingHistory(){owner(buy);when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("h")).thenReturn(List.of(buy));assertThatThrownBy(()->service.correctCosts("a","u","buy",edit("20","0",0))).hasMessageContaining("409");assertThat(buy.getFeeAmount()).isZero();}
    @Test void insufficientCashDoesNotMutateTrade(){owner(sell);account.applyQuickTransaction(d("999"),false);assertThatThrownBy(()->service.correctCosts("a","u","sell",edit("0","10",0))).hasMessageContaining("400");assertThat(sell.getTaxAmount()).isZero();}
    @Test void refusesAnotherAccountsTransaction(){owner(sell);holding=Investment.builder().investmentId("h").accountId("other").build();when(holdings.findByInvestmentIdAndUserId("h","u")).thenReturn(Optional.of(holding));assertThatThrownBy(()->service.correctCosts("a","u","sell",edit("0","10",0))).hasMessageContaining("403");}
    @Test void annualSummaryReadsAllYearsAndKeepsTaxCategoriesSeparate(){
        sell.correctCosts(BigDecimal.ZERO,d("10"),InvestmentTaxKind.WITHHOLDING_TAX,"");sell.correctRealizedProfitLoss(d("40"));
        when(accounts.findByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));when(holdings.findByAccountIdAndUserId("a","u")).thenReturn(List.of(holding));when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("h")).thenReturn(List.of(buy,sell));
        var report=service.annualSummary("a","u",2026);assertThat(report.trades()).hasSize(1);assertThat(report.realizedBeforeTax()).isEqualByComparingTo("50");assertThat(report.realizedAfterTax()).isEqualByComparingTo("40");assertThat(report.currencies().getFirst().taxBreakdown().get(InvestmentTaxKind.WITHHOLDING_TAX)).isEqualByComparingTo("10");assertThat(report.currencies().getFirst().purchases()).isZero();
    }
    @Test void correctingBuyAfterFullySellingStillRecalculatesClosedPositionProfit(){
        sell=tx("sell",InvestmentTradeType.SELL,"2","150","300","100",2026);
        holding.applySell(BigDecimal.ONE,d("150"),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ONE);
        owner(buy);when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("h")).thenReturn(List.of(buy,sell));
        service.correctCosts("a","u","buy",edit("20","0",0));
        assertThat(holding.getCachedQuantity()).isZero();assertThat(holding.getCachedAvgBuyPriceBase()).isZero();assertThat(sell.getRealizedProfitLoss()).isEqualByComparingTo("80");
    }
    InvestmentTransactionResponse recordJapaneseSale(BigDecimal tax){
        when(accounts.findForUpdateByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));
        when(holdings.findByInvestmentIdAndUserId("h","u")).thenReturn(Optional.of(holding));
        when(fees.findByAccountIdAndUserIdAndMarketGroup("a","u",InvestmentMarketGroup.JP)).thenReturn(Optional.of(InvestmentFeeSetting.builder().sellTaxRate(d("20.315")).build()));
        when(transactions.save(any())).thenAnswer(i->i.getArgument(0));
        return service.recordTransaction("a","u",new InvestmentTradeRequest(InvestmentTradeType.SELL,"h",null,null,null,null,BigDecimal.ONE,d("150"),null,null,tax,true,Currency.JPY,BigDecimal.ONE,LocalDateTime.now(),null,null,null));
    }
    @Test void japanDoesNotMultiplySaleProceedsByIncomeTaxRate(){assertThat(recordJapaneseSale(null).taxAmount()).isZero();}
    @Test void japanAcceptsActualTaxFromBrokerStatement(){assertThat(recordJapaneseSale(d("7")).taxAmount()).isEqualByComparingTo("7");}
    @Test void foreignCurrencyCorrectionUsesRecordedExchangeRate(){
        sell=InvestmentTransaction.builder().investmentTransactionId("sell").investmentId("h").tradeType(InvestmentTradeType.SELL).quantity(BigDecimal.ONE).unitPrice(d("150")).grossAmount(d("150")).netAmount(d("15000")).realizedProfitLoss(d("5000")).currency(Currency.USD).exchangeRate(d("100")).build();
        owner(sell);service.correctCosts("a","u","sell",edit("0","1",0));
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("900");assertThat(sell.getNetAmount()).isEqualByComparingTo("14900");assertThat(sell.getRealizedProfitLoss()).isEqualByComparingTo("4900");
    }
    @Test void annualSummaryDoesNotMixDifferentNativeCurrencies(){
        var us=Investment.builder().investmentId("us").accountId("a").userId("u").symbolName("US stock").market("NYSE").currency(Currency.USD).build();
        var dividend=InvestmentTransaction.builder().investmentTransactionId("div").investmentId("us").tradeType(InvestmentTradeType.DIVIDEND).quantity(BigDecimal.ZERO).unitPrice(BigDecimal.ZERO).grossAmount(d("10")).feeAmount(d("1")).taxAmount(d("2")).netAmount(d("700")).currency(Currency.USD).exchangeRate(d("100")).tradeDate(LocalDateTime.of(2026,12,31,23,59)).build();
        when(accounts.findByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));when(holdings.findByAccountIdAndUserId("a","u")).thenReturn(List.of(holding,us));when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("h")).thenReturn(List.of(buy,sell));when(transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc("us")).thenReturn(List.of(dividend));
        var report=service.annualSummary("a","u",2026);assertThat(report.currencies()).hasSize(2);assertThat(report.currencies().stream().filter(c->c.currency()==Currency.USD).findFirst().orElseThrow().dividends()).isEqualByComparingTo("10");assertThat(report.realizedAfterTax()).isEqualByComparingTo("50");
    }
}
