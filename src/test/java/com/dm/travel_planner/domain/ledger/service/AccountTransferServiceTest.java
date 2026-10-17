package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.AccountTransferRequest;
import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.AccountTransferRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTransaction;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentRepository;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentTransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AccountTransferServiceTest {
    @Mock AccountRepository accountRepository;
    @Mock AccountTransferRepository accountTransferRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock InvestmentRepository investmentRepository;
    @Mock InvestmentTransactionRepository investmentTransactionRepository;

    AccountTransferService service;
    Account source;
    Account destination;

    @BeforeEach
    void setUp() {
        service = new AccountTransferService(accountRepository, accountTransferRepository, transactionRepository,
                investmentRepository, investmentTransactionRepository);
        source = account("a-source", "생활비", new BigDecimal("1000000"));
        destination = account("b-destination", "투자통장", new BigDecimal("100000"));
        when(accountRepository.findForUpdateByAccountIdAndUserId("a-source", "user-1")).thenReturn(Optional.of(source));
        when(accountRepository.findForUpdateByAccountIdAndUserId("b-destination", "user-1")).thenReturn(Optional.of(destination));
    }

    @Test
    void transferMovesBothBalancesAndCreatesLinkedDirections() {
        when(accountTransferRepository.save(any(AccountTransfer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var result = service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("300000"), BigDecimal.ZERO,
                LocalDateTime.of(2026, 8, 13, 12, 0), "투자 예수금 이동"));

        assertThat(source.getCachedBookBalance()).isEqualByComparingTo("700000");
        assertThat(destination.getCachedBookBalance()).isEqualByComparingTo("400000");
        assertThat(result.sourceTransaction().getTransactionType()).isEqualTo(TransactionType.TRANSFER);
        assertThat(result.sourceTransaction().getTransferDirection()).isEqualTo(TransferDirection.OUT);
        assertThat(result.destinationTransaction().getTransferDirection()).isEqualTo(TransferDirection.IN);
        verify(transactionRepository, times(2)).save(any(Transaction.class));
    }

    @Test
    void transferRejectsInsufficientBalanceWithoutWritingLedger() {
        assertThatThrownBy(() -> service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("1000001"), BigDecimal.ZERO,
                LocalDateTime.now(), null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("잔액이 부족");

        verify(accountTransferRepository, never()).save(any());
        verify(transactionRepository, never()).save(any());
        assertThat(source.getCachedBookBalance()).isEqualByComparingTo("1000000");
        assertThat(destination.getCachedBookBalance()).isEqualByComparingTo("100000");
    }

    @Test
    void transferToDebtAccountRepaysPrincipalAndWritesBothLegs() {
        destination = account("b-destination", "주택담보대출", new BigDecimal("-500000"),
                AccountType.DEBT, AccountPurpose.LOAN);
        when(accountRepository.findForUpdateByAccountIdAndUserId("b-destination", "user-1"))
                .thenReturn(Optional.of(destination));
        when(accountTransferRepository.save(any(AccountTransfer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("200000"), BigDecimal.ZERO,
                LocalDateTime.of(2026, 8, 13, 12, 0), "8월 원금 상환"));

        assertThat(source.getCachedBookBalance()).isEqualByComparingTo("800000");
        assertThat(destination.getCachedBookBalance()).isEqualByComparingTo("-300000");
        assertThat(result.destinationTransaction().getTransferDirection()).isEqualTo(TransferDirection.IN);
        assertThat(result.destinationTransaction().getTitle()).contains("대출 상환");
    }

    @Test
    void transferFromCreditLineRecordsLimitUse() {
        source = account("a-source", "마이너스통장", new BigDecimal("-500000"),
                AccountType.DEBT, AccountPurpose.CREDIT_LINE);
        when(accountRepository.findForUpdateByAccountIdAndUserId("a-source", "user-1"))
                .thenReturn(Optional.of(source));
        when(accountTransferRepository.save(any(AccountTransfer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("200000"), BigDecimal.ZERO,
                LocalDateTime.of(2026, 8, 13, 12, 0), "한도 사용"));

        assertThat(source.getCachedBookBalance()).isEqualByComparingTo("-700000");
        assertThat(destination.getCachedBookBalance()).isEqualByComparingTo("300000");
        assertThat(result.sourceTransaction().getTransferDirection()).isEqualTo(TransferDirection.OUT);
        assertThat(result.sourceTransaction().getTitle()).contains("한도 사용");
    }

    @Test
    void transferRejectsWithdrawalFromRegularLoan() {
        source = account("a-source", "일반 신용대출", new BigDecimal("-500000"),
                AccountType.DEBT, AccountPurpose.LOAN);
        when(accountRepository.findForUpdateByAccountIdAndUserId("a-source", "user-1"))
                .thenReturn(Optional.of(source));

        assertThatThrownBy(() -> service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("100000"), BigDecimal.ZERO,
                LocalDateTime.now(), null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("일반 대출 계좌에서는 출금할 수 없습니다");

        verify(accountTransferRepository, never()).save(any());
    }

    @Test
    void transferFromInvestmentAccountCreatesCashWithdrawalHistory() {
        source = account("a-source", "투자통장", new BigDecimal("500000"),
                AccountType.INVESTMENT, AccountPurpose.STOCK_BROKERAGE);
        Investment cash = Investment.builder().investmentId("cash-1").userId("user-1")
                .accountId("a-source").tickerCode("CASH").symbolName("예수금").build();
        when(accountRepository.findForUpdateByAccountIdAndUserId("a-source", "user-1"))
                .thenReturn(Optional.of(source));
        when(accountTransferRepository.save(any(AccountTransfer.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> {
            Transaction transaction = invocation.getArgument(0);
            transaction.prePersist();
            return transaction;
        });
        when(investmentRepository.findByAccountIdAndUserIdAndTickerCode("a-source", "user-1", "CASH"))
                .thenReturn(Optional.of(cash));
        when(investmentTransactionRepository.save(any(InvestmentTransaction.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        service.executeTransfer("user-1", new AccountTransferRequest(
                "a-source", "b-destination", new BigDecimal("100000"), BigDecimal.ZERO,
                LocalDateTime.of(2026, 8, 13, 12, 0), "생활비 이동"));

        verify(investmentTransactionRepository).save(argThat(item ->
                item.getTradeType() == com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType.WITHDRAWAL
                        && item.getNetAmount().compareTo(new BigDecimal("-100000")) == 0
                        && item.getTransactionId() != null));
    }

    private Account account(String id, String name, BigDecimal balance) {
        return account(id, name, balance, AccountType.CHECKING, AccountPurpose.GENERAL_CHECKING);
    }

    private Account account(String id, String name, BigDecimal balance, AccountType type, AccountPurpose purpose) {
        return Account.builder()
                .accountId(id)
                .userId("user-1")
                .accountName(name)
                .accountType(type)
                .accountPurpose(purpose)
                .currency(Currency.KRW)
                .cachedBookBalance(balance)
                .isActive(true)
                .build();
    }
}
