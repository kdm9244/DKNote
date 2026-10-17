package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.DebtMonthlyRepaymentResponse;
import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private AccountRepository accountRepository;

    @InjectMocks
    private TransactionService transactionService;

    @Test
    @DisplayName("부채 월 상환 - 계획금액이 거래로 저장되고 남은 부채가 감소한다")
    void applyDebtMonthlyRepayment_success() {
        Account account = debtAccount(new BigDecimal("-10000000"), new BigDecimal("500000"));
        given(accountRepository.findForUpdateByAccountIdAndUserId("debt-1", "user-1"))
                .willReturn(Optional.of(account));
        given(transactionRepository
                .findFirstByAccountIdAndTransactionTypeAndTransactionDateGreaterThanEqualAndTransactionDateLessThanAndTitle(
                        eq("debt-1"), eq(TransactionType.INCOME), any(LocalDateTime.class),
                        any(LocalDateTime.class), anyString()))
                .willReturn(Optional.empty());
        given(transactionRepository.save(any(Transaction.class))).willAnswer(invocation -> invocation.getArgument(0));

        DebtMonthlyRepaymentResponse response = transactionService
                .applyDebtMonthlyRepayment("debt-1", "user-1");

        assertThat(response.applied()).isTrue();
        assertThat(response.transaction().getAmount()).isEqualByComparingTo("500000");
        assertThat(response.transaction().getTransactionType()).isEqualTo(TransactionType.INCOME);
        assertThat(account.getCachedBookBalance()).isEqualByComparingTo("-9500000");
        verify(transactionRepository).save(any(Transaction.class));
    }

    @Test
    @DisplayName("부채 월 상환 - 마지막 달에는 남은 부채만 상환한다")
    void applyDebtMonthlyRepayment_capsAtOutstandingDebt() {
        Account account = debtAccount(new BigDecimal("-120000"), new BigDecimal("500000"));
        given(accountRepository.findForUpdateByAccountIdAndUserId("debt-1", "user-1"))
                .willReturn(Optional.of(account));
        given(transactionRepository
                .findFirstByAccountIdAndTransactionTypeAndTransactionDateGreaterThanEqualAndTransactionDateLessThanAndTitle(
                        anyString(), any(), any(), any(), anyString()))
                .willReturn(Optional.empty());
        given(transactionRepository.save(any(Transaction.class))).willAnswer(invocation -> invocation.getArgument(0));

        DebtMonthlyRepaymentResponse response = transactionService
                .applyDebtMonthlyRepayment("debt-1", "user-1");

        assertThat(response.transaction().getAmount()).isEqualByComparingTo("120000");
        assertThat(account.getCachedBookBalance()).isZero();
    }

    private Account debtAccount(BigDecimal balance, BigDecimal monthlyPayment) {
        return Account.builder()
                .accountId("debt-1")
                .userId("user-1")
                .accountName("주택담보대출")
                .accountType(AccountType.DEBT)
                .accountPurpose(AccountPurpose.LOAN)
                .currency(Currency.KRW)
                .initialBalance(balance)
                .cachedBookBalance(balance)
                .monthlyPayment(monthlyPayment)
                .isActive(true)
                .build();
    }
}
