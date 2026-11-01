package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.*;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import com.dm.travel_planner.domain.ledger.foreign.entity.*;
import com.dm.travel_planner.domain.ledger.foreign.repository.ForeignCurrencyTransactionRepository;
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
class LedgerPeriodTest {
    @Mock AccountRepository accounts;
    @Mock TransactionRepository transactions;
    @Mock InvestmentRepository holdings;
    @Mock InvestmentTransactionRepository investmentTransactions;
    @Mock ForeignCurrencyTransactionRepository foreignTransactions;
    @InjectMocks LedgerDashboardService service;
    Transaction tx(String id,TransactionType type,String category,String amount,String account) {
        return Transaction.builder().transactionId(id).accountId(account).transactionType(type).categoryId(category)
                .amount(new BigDecimal(amount)).currency(Currency.KRW).transactionDate(LocalDateTime.of(2026,11,1,23,59)).build();
    }
    @Test void endDateIncludesWholeDayAndTransfersAndAdjustmentsDoNotInflateSpending() {
        var from=LocalDate.of(2026,11,1);var to=from;
        when(transactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc("u",from.atStartOfDay(),from.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(tx("food",TransactionType.EXPENSE,"식비","10000","checking"),tx("transfer",TransactionType.TRANSFER,"이체","500000","checking"),tx("adjust",TransactionType.EXPENSE,"잔액 조정","3000","checking"),tx("deposit",TransactionType.EXPENSE,"투자 예수금","200000","broker"),tx("salary",TransactionType.INCOME,"급여","1000000","checking")));
        var result=service.getPeriod("u",from,to);
        assertThat(result.monthlyExpense().get(Currency.KRW)).isEqualByComparingTo("10000");
        assertThat(result.monthlyIncome().get(Currency.KRW)).isEqualByComparingTo("1000000");
        assertThat(result.categorySpending()).hasSize(1);
    }
    @Test void archivedDebtIsStillExcludedFromHistoricalLivingExpenses() {
        var day=LocalDate.of(2026,11,1);
        var debt=Account.builder().accountId("debt").accountType(AccountType.DEBT).isActive(false).build();
        when(accounts.findByUserIdOrderByDisplayOrderAsc("u")).thenReturn(List.of(debt));
        when(transactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(anyString(),any(),any()))
                .thenReturn(List.of(tx("loan",TransactionType.EXPENSE,"대출","200000","debt")));
        assertThat(service.getPeriod("u",day,day).monthlyExpense()).isEmpty();
    }
    @Test void reversedOrIncompleteRangeIsRejected() {
        assertThatThrownBy(()->service.getPeriod("u",LocalDate.of(2026,11,2),LocalDate.of(2026,11,1))).hasMessageContaining("400");
        assertThatThrownBy(()->service.getPeriod("u",null,LocalDate.now())).hasMessageContaining("400");
    }
    @Test void allCategoriesAndTransactionsRemainAvailableForStatistics() {
        var day=LocalDate.of(2026,11,1);
        List<Transaction> rows=new ArrayList<>();for(int i=0;i<15;i++)rows.add(tx("t"+i,TransactionType.EXPENSE,"category"+i,"100","c"));
        when(transactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(anyString(),any(),any())).thenReturn(rows);
        var result=service.getPeriod("u",day,day);assertThat(result.categorySpending()).hasSize(15);assertThat(result.recentTransactions()).hasSize(15);
    }
    ForeignCurrencyTransaction foreign(String id,ForeignTransactionType type,String purpose,String amount,Currency currency) {
        return ForeignCurrencyTransaction.builder().transactionId(id).userId("u").accountId("foreign")
                .transactionDate(LocalDateTime.of(2026,11,1,23,59)).transactionType(type).purpose(purpose)
                .title(purpose).amount(new BigDecimal(amount)).currency(currency).build();
    }
    @Test void foreignWalletSpendingAndSalaryAreIncludedInOriginalCurrencies() {
        var day=LocalDate.of(2026,11,1);
        when(foreignTransactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc("u",day.atStartOfDay(),day.plusDays(1).atStartOfDay()))
                .thenReturn(List.of(foreign("spend",ForeignTransactionType.WITHDRAWAL,"FOREIGN_SPENDING","1500",Currency.JPY),foreign("salary",ForeignTransactionType.DEPOSIT,"FOREIGN_SALARY","2500",Currency.USD)));
        var result=service.getPeriod("u",day,day);
        assertThat(result.monthlyExpense().get(Currency.JPY)).isEqualByComparingTo("1500");
        assertThat(result.monthlyIncome().get(Currency.USD)).isEqualByComparingTo("2500");
        assertThat(result.recentTransactions()).hasSize(2).anyMatch(tx->tx.transactionId().equals("foreign-spend")&&tx.currency()==Currency.JPY);
        assertThat(result.categorySpending()).anyMatch(row->row.category().equals("해외 결제·사용"));
    }
    @Test void foreignExchangeTransfersAndCashWithdrawalsAreMovementsButTheirFeesAreExpenses() {
        var day=LocalDate.of(2026,11,1);
        var exchange=foreign("exchange",ForeignTransactionType.DEPOSIT,"EXCHANGE_DEPOSIT","1000",Currency.JPY);
        exchange.update(ForeignTransactionType.DEPOSIT,"EXCHANGE_DEPOSIT","환전",new BigDecimal("1000"),Currency.JPY,null,null,null,new BigDecimal("100"),exchange.getTransactionDate(),null);
        when(foreignTransactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(anyString(),any(),any()))
                .thenReturn(List.of(exchange,foreign("transfer",ForeignTransactionType.WITHDRAWAL,"FOREIGN_TRANSFER_OUT","300",Currency.USD),foreign("cash",ForeignTransactionType.WITHDRAWAL,"CASH_WITHDRAWAL","500",Currency.JPY)));
        var result=service.getPeriod("u",day,day);
        assertThat(result.monthlyIncome()).isEmpty();assertThat(result.monthlyExpense()).hasSize(1);
        assertThat(result.monthlyExpense().get(Currency.KRW)).isEqualByComparingTo("100");
        assertThat(result.recentTransactions()).hasSize(4).filteredOn(t->t.transactionType()==TransactionType.TRANSFER).hasSize(3);
    }
    @Test void legacyForeignCurrencyAndArchivedAccountsRemainVisible() {
        var day=LocalDate.of(2026,11,1);
        var account=Account.builder().accountId("foreign").accountName("일본 생활비").accountType(AccountType.FOREIGN_CURRENCY).currency(Currency.JPY).isActive(false).build();
        when(accounts.findByUserIdOrderByDisplayOrderAsc("u")).thenReturn(List.of(account));
        when(foreignTransactions.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(anyString(),any(),any()))
                .thenReturn(List.of(foreign("legacy",ForeignTransactionType.WITHDRAWAL,"FOREIGN_SPENDING","1000",null)));
        var result=service.getPeriod("u",day,day);
        assertThat(result.monthlyExpense().get(Currency.JPY)).isEqualByComparingTo("1000");
        assertThat(result.recentTransactions().getFirst().accountName()).isEqualTo("일본 생활비");
    }
}
