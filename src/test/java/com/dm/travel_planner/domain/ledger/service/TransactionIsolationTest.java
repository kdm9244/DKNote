package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.TransactionCreateRequest;
import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class TransactionIsolationTest {
    @Mock AccountRepository accounts;
    @Mock TransactionRepository transactions;
    @InjectMocks TransactionService service;
    @Test void anotherUsersAccountCannotReceiveQuickExpense() {
        var request=TransactionCreateRequest.builder().accountId("other").amount(BigDecimal.TEN).transactionType(TransactionType.EXPENSE).build();
        assertThatThrownBy(()->service.createTransaction("u",request)).isInstanceOf(IllegalArgumentException.class);
        verify(accounts).findForUpdateByAccountIdAndUserId("other","u");verifyNoInteractions(transactions);
    }
    @Test void currencyMismatchDoesNotChangeBalance() {
        var account=Account.builder().currency(Currency.JPY).cachedBookBalance(BigDecimal.TEN).build();
        when(accounts.findForUpdateByAccountIdAndUserId("a","u")).thenReturn(Optional.of(account));
        var request=TransactionCreateRequest.builder().accountId("a").amount(BigDecimal.ONE).transactionType(TransactionType.EXPENSE).currency(Currency.KRW).build();
        assertThatThrownBy(()->service.createTransaction("u",request)).hasMessageContaining("통화");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("10");verifyNoInteractions(transactions);
    }
    @Test void anotherUsersTransactionCannotBeDeleted() {
        when(transactions.findById("t")).thenReturn(Optional.of(Transaction.builder().userId("other").build()));
        assertThatThrownBy(()->service.deleteTransaction("t","u")).hasMessageContaining("404");
        verify(transactions,never()).deleteById(any());verifyNoInteractions(accounts);
    }
    @Test void accountHistoryAndStatsRequireOwnership() {
        assertThatThrownBy(()->service.getTransactionsByAccount("other","u")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->service.getAccountStats("other","u")).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(transactions);
    }
}
