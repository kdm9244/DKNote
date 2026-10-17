package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.FixedExpenseApplyRequest;
import com.dm.travel_planner.domain.ledger.dto.TransactionResponse;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountPurpose;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.FixedExpense;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.FixedExpenseRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class FixedExpenseServiceTest {

    @Mock
    private FixedExpenseRepository fixedExpenseRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @InjectMocks
    private FixedExpenseService fixedExpenseService;

    @Test
    @DisplayName("고정지출 반영 시 출금 거래와 잔액, 다음 결제일이 함께 갱신된다")
    void applyFixedExpense_updatesTransactionBalanceAndSchedule() {
        String userId = "user-1";
        String accountId = "account-1";
        String fixedExpenseId = "fixed-1";
        LocalDate dueDate = LocalDate.of(2026, 8, 31);

        FixedExpense fixedExpense = FixedExpense.builder()
                .fixedExpenseId(fixedExpenseId)
                .userId(userId)
                .title("인터넷 요금")
                .amount(new BigDecimal("35000"))
                .currency(Currency.KRW)
                .paymentDayOfMonth(31)
                .nextPaymentDate(dueDate)
                .accountId(accountId)
                .isActive(true)
                .build();
        Account account = Account.builder()
                .accountId(accountId)
                .userId(userId)
                .accountName("생활비 통장")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.LIVING_CHECKING)
                .currency(Currency.KRW)
                .cachedBookBalance(new BigDecimal("100000"))
                .isActive(true)
                .build();

        given(fixedExpenseRepository.findForUpdate(fixedExpenseId, userId))
                .willReturn(Optional.of(fixedExpense));
        given(accountRepository.findByAccountIdAndUserId(accountId, userId))
                .willReturn(Optional.of(account));
        given(transactionRepository.save(any(Transaction.class)))
                .willAnswer(invocation -> invocation.getArgument(0));

        TransactionResponse response = fixedExpenseService.applyFixedExpense(
                fixedExpenseId,
                userId,
                FixedExpenseApplyRequest.builder().expectedPaymentDate(dueDate).build());

        assertThat(response.getTransactionType()).isEqualTo(TransactionType.EXPENSE);
        assertThat(response.getAmount()).isEqualByComparingTo("35000");
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("65000");
        assertThat(fixedExpense.getNextPaymentDate()).isEqualTo(LocalDate.of(2026, 9, 30));

        ArgumentCaptor<Transaction> captor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(captor.capture());
        assertThat(captor.getValue().getIsFixedExpense()).isTrue();
        assertThat(captor.getValue().getMemo()).contains("2026-08-31");
    }
}
