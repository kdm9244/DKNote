package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.*;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountPurpose;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.dm.travel_planner.domain.ledger.repository.ReconciliationRepository;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentCleanupService;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentService;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;

@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private ReconciliationRepository reconciliationRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private InvestmentCleanupService investmentCleanupService;

    @Mock
    private InvestmentService investmentService;

    @InjectMocks
    private AccountService accountService;

    @Test
    @DisplayName("계좌 생성 성공 - 초기 잔액 및 필수 속성이 올바르게 등록된다")
    void createAccount_success() {
        // given
        String userId = "user123";
        AccountCreateRequest request = AccountCreateRequest.builder()
                .accountName("신한 주계좌")
                .bankName("신한은행")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.SALARY_CHECKING)
                .currency(Currency.KRW)
                .initialBalance(new BigDecimal("1000000"))
                .initialBalanceDate(LocalDate.of(2026, 8, 1))
                .displayOrder(1)
                .build();

        given(accountRepository.save(any(Account.class))).willAnswer(invocation -> {
            Account account = invocation.getArgument(0);
            return Account.builder()
                    .accountId("acc_1111")
                    .userId(account.getUserId())
                    .accountName(account.getAccountName())
                    .bankName(account.getBankName())
                    .accountType(account.getAccountType())
                    .accountPurpose(account.getAccountPurpose())
                    .currency(account.getCurrency())
                    .initialBalance(account.getInitialBalance())
                    .initialBalanceDate(account.getInitialBalanceDate())
                    .cachedBookBalance(account.getCachedBookBalance())
                    .displayOrder(account.getDisplayOrder())
                    .isActive(true)
                    .build();
        });

        // when
        AccountResponse response = accountService.createAccount(userId, request);

        // then
        assertThat(response).isNotNull();
        assertThat(response.getAccountId()).isEqualTo("acc_1111");
        assertThat(response.getAccountName()).isEqualTo("신한 주계좌");
        assertThat(response.getCachedBookBalance()).isEqualByComparingTo("1000000");

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        Account capturedAccount = captor.getValue();
        assertThat(capturedAccount.getUserId()).isEqualTo(userId);
        assertThat(capturedAccount.getCachedBookBalance()).isEqualByComparingTo("1000000");
    }

    @Test
    @DisplayName("부채 계좌 생성 - 사용자가 입력한 남은 부채는 음수 장부 잔액으로 저장된다")
    void createDebtAccount_normalizesBalance() {
        AccountCreateRequest request = AccountCreateRequest.builder()
                .accountName("주택담보대출")
                .bankName("테스트은행")
                .accountType(AccountType.DEBT)
                .accountPurpose(AccountPurpose.LOAN)
                .currency(Currency.KRW)
                .initialBalance(new BigDecimal("120000000"))
                .interestRate(new BigDecimal("3.8"))
                .monthlyPayment(new BigDecimal("850000"))
                .build();
        given(accountRepository.save(any(Account.class))).willAnswer(invocation -> invocation.getArgument(0));

        AccountResponse response = accountService.createAccount("user123", request);

        assertThat(response.getInitialBalance()).isEqualByComparingTo("-120000000");
        assertThat(response.getCachedBookBalance()).isEqualByComparingTo("-120000000");
        assertThat(response.getInterestRate()).isEqualByComparingTo("3.8");
        assertThat(response.getMonthlyPayment()).isEqualByComparingTo("850000");
    }

    @Test
    @DisplayName("계좌 목록 조회 - 활성 계좌와 요약 정보(총 잔액)가 반환된다")
    void getAccounts_success() {
        // given
        String userId = "user123";
        Account acc1 = Account.builder()
                .accountId("acc_1")
                .userId(userId)
                .accountName("월급 통장")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.SALARY_CHECKING)
                .currency(Currency.KRW)
                .initialBalance(new BigDecimal("500000"))
                .cachedBookBalance(new BigDecimal("500000"))
                .displayOrder(1)
                .isActive(true)
                .build();

        Account acc2 = Account.builder()
                .accountId("acc_2")
                .userId(userId)
                .accountName("비상금 통장")
                .accountType(AccountType.SAVINGS)
                .accountPurpose(AccountPurpose.EMERGENCY_CHECKING)
                .currency(Currency.KRW)
                .initialBalance(new BigDecimal("1500000"))
                .cachedBookBalance(new BigDecimal("1500000"))
                .displayOrder(2)
                .isActive(true)
                .build();

        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.CASH)).willReturn(true);
        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.TRANSIT_CARD)).willReturn(true);
        given(accountRepository.findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(userId))
                .willReturn(List.of(acc1, acc2));

        // when
        AccountSummaryResponse summary = accountService.getAccounts(userId, false);

        // then
        assertThat(summary.getTotalAccounts()).isEqualTo(2);
        assertThat(summary.getTotalCachedBalance()).isEqualByComparingTo("2000000");
        assertThat(summary.getAccounts()).hasSize(2);
    }

    @Test
    @DisplayName("계좌 목록 조회 - 등록된 계좌가 없으면 기본 현금 및 교통카드 계좌를 자동으로 생성한다")
    void getAccounts_whenNoAccounts_createsDefaultStarterAccounts() {
        // given
        String userId = "new_user";
        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.CASH)).willReturn(false);
        given(accountRepository.existsByUserIdAndAccountName(userId, "현금")).willReturn(false);
        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.TRANSIT_CARD)).willReturn(false);
        given(accountRepository.existsByUserIdAndAccountName(userId, "교통카드")).willReturn(false);

        Account cashAccount = Account.builder()
                .accountId("cash_acc_1")
                .userId(userId)
                .accountName("현금")
                .bankName("지갑 / 현금")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.CASH)
                .currency(Currency.KRW)
                .initialBalance(BigDecimal.ZERO)
                .cachedBookBalance(BigDecimal.ZERO)
                .displayOrder(1)
                .isActive(true)
                .build();

        Account transitAccount = Account.builder()
                .accountId("transit_acc_2")
                .userId(userId)
                .accountName("교통카드")
                .bankName("교통 / 선불카드")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.TRANSIT_CARD)
                .currency(Currency.KRW)
                .initialBalance(BigDecimal.ZERO)
                .cachedBookBalance(BigDecimal.ZERO)
                .displayOrder(2)
                .isActive(true)
                .build();

        given(accountRepository.save(any(Account.class))).willAnswer(invocation -> invocation.getArgument(0));
        given(accountRepository.findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(userId))
                .willReturn(List.of(cashAccount, transitAccount));

        // when
        AccountSummaryResponse summary = accountService.getAccounts(userId, false);

        // then
        assertThat(summary.getTotalAccounts()).isEqualTo(2);
        assertThat(summary.getAccounts()).hasSize(2);

        AccountResponse cashResponse = summary.getAccounts().get(0);
        assertThat(cashResponse.getAccountName()).isEqualTo("현금");
        assertThat(cashResponse.getAccountPurpose()).isEqualTo(AccountPurpose.CASH);

        AccountResponse transitResponse = summary.getAccounts().get(1);
        assertThat(transitResponse.getAccountName()).isEqualTo("교통카드");
        assertThat(transitResponse.getAccountPurpose()).isEqualTo(AccountPurpose.TRANSIT_CARD);

        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        List<Account> savedList = captor.getAllValues();
        assertThat(savedList).hasSize(2);
        assertThat(savedList.get(0).getAccountPurpose()).isEqualTo(AccountPurpose.CASH);
        assertThat(savedList.get(1).getAccountPurpose()).isEqualTo(AccountPurpose.TRANSIT_CARD);
    }

    @Test
    @DisplayName("계좌 목록 조회 - 기존 유저가 현금 계좌가 없으면 현금 계좌를 보충 생성한다")
    void getAccounts_whenExistingUserMissingCash_createsCashAccount() {
        // given
        String userId = "existing_user";
        Account salaryAccount = Account.builder()
                .accountId("salary_1")
                .userId(userId)
                .accountName("급여통장")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.SALARY_CHECKING)
                .currency(Currency.KRW)
                .initialBalance(new BigDecimal("2000000"))
                .cachedBookBalance(new BigDecimal("2000000"))
                .displayOrder(1)
                .isActive(true)
                .build();

        Account cashAccount = Account.builder()
                .accountId("cash_acc_1")
                .userId(userId)
                .accountName("현금")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.CASH)
                .currency(Currency.KRW)
                .initialBalance(BigDecimal.ZERO)
                .cachedBookBalance(BigDecimal.ZERO)
                .displayOrder(1)
                .isActive(true)
                .build();

        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.CASH)).willReturn(false);
        given(accountRepository.existsByUserIdAndAccountName(userId, "현금")).willReturn(false);
        given(accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.TRANSIT_CARD)).willReturn(true);

        given(accountRepository.save(any(Account.class))).willAnswer(invocation -> invocation.getArgument(0));
        given(accountRepository.findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(userId))
                .willReturn(List.of(cashAccount, salaryAccount));

        // when
        AccountSummaryResponse summary = accountService.getAccounts(userId, false);

        // then
        assertThat(summary.getTotalAccounts()).isEqualTo(2);
        ArgumentCaptor<Account> captor = ArgumentCaptor.forClass(Account.class);
        verify(accountRepository).save(captor.capture());
        assertThat(captor.getValue().getAccountPurpose()).isEqualTo(AccountPurpose.CASH);
    }

    @Test
    @DisplayName("존재하지 않는 계좌 조회 시 예외가 발생한다")
    void getAccount_notFound() {
        // given
        given(accountRepository.findByAccountIdAndUserId("invalid_acc", "user123"))
                .willReturn(Optional.empty());

        // when & then
        assertThatThrownBy(() -> accountService.getAccount("invalid_acc", "user123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("계좌를 찾을 수 없거나 접근 권한이 없습니다.");
    }

    @Test
    @DisplayName("계좌 정보 수정 - 계좌명과 은행정보 등이 변경된다")
    void updateAccount_success() {
        // given
        String userId = "user123";
        String accountId = "acc_1";

        Account account = Account.builder()
                .accountId(accountId)
                .userId(userId)
                .accountName("구 계좌명")
                .bankName("구 은행")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.LIVING_CHECKING)
                .currency(Currency.KRW)
                .cachedBookBalance(new BigDecimal("100000"))
                .isActive(true)
                .build();

        given(accountRepository.findByAccountIdAndUserId(accountId, userId))
                .willReturn(Optional.of(account));

        AccountUpdateRequest updateRequest = AccountUpdateRequest.builder()
                .accountName("신 계좌명")
                .bankName("카카오뱅크")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.ALLOWANCE_CHECKING)
                .currency(Currency.KRW)
                .build();

        // when
        AccountResponse response = accountService.updateAccount(accountId, userId, updateRequest);

        // then
        assertThat(response.getAccountName()).isEqualTo("신 계좌명");
        assertThat(response.getBankName()).isEqualTo("카카오뱅크");
        assertThat(response.getAccountPurpose()).isEqualTo(AccountPurpose.ALLOWANCE_CHECKING);
    }

    @Test
    @DisplayName("실잔액 맞춤(Reconcile) - 실제 잔액이 기록되고 시각이 갱신된다")
    void reconcileBalance_success() {
        // given
        String userId = "user123";
        String accountId = "acc_1";

        Account account = Account.builder()
                .accountId(accountId)
                .userId(userId)
                .accountName("자유 통장")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.LIVING_CHECKING)
                .currency(Currency.KRW)
                .cachedBookBalance(new BigDecimal("1000000"))
                .isActive(true)
                .build();

        given(accountRepository.findByAccountIdAndUserId(accountId, userId))
                .willReturn(Optional.of(account));

        AccountBalanceReconcileRequest request = AccountBalanceReconcileRequest.builder()
                .actualBalance(new BigDecimal("980000"))
                .build();

        // when
        AccountResponse response = accountService.reconcileBalance(accountId, userId, request);

        // then
        assertThat(response.getLastActualBalance()).isEqualByComparingTo("980000");
        assertThat(response.getLastReconciledAt()).isNotNull();
        assertThat(response.getBalanceDifference()).isEqualByComparingTo("20000"); // 1000000 - 980000
    }

    @Test
    @DisplayName("잔액 조정 - 차액과 이유가 거래 내역으로 생성되고 장부 잔액에 반영된다")
    void reconcileAndAdjustBalance_createsTraceableTransaction() {
        String userId = "user123";
        String accountId = "acc_1";
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
        given(accountRepository.findByAccountIdAndUserId(accountId, userId)).willReturn(Optional.of(account));
        given(reconciliationRepository.save(any())).willAnswer(invocation -> invocation.getArgument(0));

        AccountResponse response = accountService.reconcileAndAdjustBalance(accountId, userId,
                BalanceAdjustmentRequest.builder()
                        .actualBalance(new BigDecimal("103500"))
                        .reason("이자·수수료 반영")
                        .memo("예금 이자 누락")
                        .build());

        assertThat(response.getCachedBookBalance()).isEqualByComparingTo("103500");
        ArgumentCaptor<Transaction> transactionCaptor = ArgumentCaptor.forClass(Transaction.class);
        verify(transactionRepository).save(transactionCaptor.capture());
        Transaction adjustment = transactionCaptor.getValue();
        assertThat(adjustment.getTransactionType()).isEqualTo(TransactionType.INCOME);
        assertThat(adjustment.getAmount()).isEqualByComparingTo("3500");
        assertThat(adjustment.getTitle()).contains("이자·수수료 반영");
        assertThat(adjustment.getMemo()).contains("예금 이자 누락");
    }

    @Test
    @DisplayName("계좌 비활성화(Soft Delete) - isActive가 false로 변경된다")
    void deactivateAccount_success() {
        // given
        String userId = "user123";
        String accountId = "acc_1";

        Account account = Account.builder()
                .accountId(accountId)
                .userId(userId)
                .accountName("해지할 통장")
                .accountType(AccountType.CHECKING)
                .accountPurpose(AccountPurpose.GENERAL_CHECKING)
                .currency(Currency.KRW)
                .isActive(true)
                .build();

        given(accountRepository.findByAccountIdAndUserId(accountId, userId))
                .willReturn(Optional.of(account));

        // when
        accountService.deactivateAccount(accountId, userId);

        // then
        assertThat(account.getIsActive()).isFalse();
    }
}
