package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.*;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountPurpose;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.ReconciliationLog;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentService;
import com.dm.travel_planner.domain.ledger.foreign.repository.ForeignCurrencyTransactionRepository;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.ReconciliationRepository;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentCleanupService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountService {

    private final AccountRepository accountRepository;
    private final ReconciliationRepository reconciliationRepository;
    private final TransactionRepository transactionRepository;
    private final InvestmentCleanupService investmentCleanupService;
    private final InvestmentService investmentService;
    private final ForeignCurrencyTransactionRepository foreignCurrencyTransactionRepository;

    /**
     * 신규 가계부 계좌를 생성합니다.
     */
    @Transactional
    public AccountResponse createAccount(String userId, AccountCreateRequest request) {
        String normalizedAccountName = request.getAccountName().trim();
        if (accountRepository.existsByUserIdAndAccountName(userId, normalizedAccountName)) {
            throw new IllegalArgumentException("같은 이름의 계좌가 이미 등록되어 있습니다.");
        }
        BigDecimal initialBal = request.getInitialBalance() != null ? request.getInitialBalance() : BigDecimal.ZERO;
        if (request.getAccountType() == AccountType.DEBT) {
            initialBal = initialBal.abs().negate();
        }
        LocalDate initialDate = request.getInitialBalanceDate() != null ? request.getInitialBalanceDate() : LocalDate.now();
        Currency curr = request.getCurrency() != null ? request.getCurrency() : Currency.KRW;
        Integer order = request.getDisplayOrder() != null ? request.getDisplayOrder() : 1;
        if (request.getAccountType() == AccountType.FOREIGN_CURRENCY) {
            if (curr != Currency.KRW && initialBal.signum() > 0
                    && (request.getInitialExchangeRate() == null || request.getInitialExchangeRate().signum() <= 0)) {
                throw new IllegalArgumentException("초기 외화 잔액이 있으면 취득환율도 입력해 주세요.");
            }
        }

        Account account = Account.builder()
                .userId(userId)
                .accountName(normalizedAccountName)
                .bankName(request.getBankName())
                .accountType(request.getAccountType())
                .accountPurpose(request.getAccountPurpose())
                .currency(curr)
                .initialBalance(initialBal)
                .initialBalanceDate(initialDate)
                .initialExchangeRate(request.getInitialExchangeRate())
                .cachedBookBalance(initialBal)
                .minimumBalance(request.getMinimumBalance())
                .targetBalance(request.getTargetBalance())
                .accountNumberMasked(request.getAccountNumberMasked())
                .displayOrder(order)
                .isActive(true)
                .balanceUpdatedAt(LocalDateTime.now())
                .interestRate(request.getInterestRate())
                .maturityDate(request.getMaturityDate())
                .interestType(request.getInterestType() != null ? request.getInterestType() : "SIMPLE")
                .monthlyPayment(request.getMonthlyPayment())
                .build();

        account.configureBrokerage(request.getBrokerageCountry(),request.getBrokerageTaxType());
        Account savedAccount = accountRepository.save(account);
        log.info("가계부 계좌 생성 완료 - userId: {}, accountId: {}, name: {}", userId, savedAccount.getAccountId(), savedAccount.getAccountName());
        return AccountResponse.from(savedAccount);
    }

    /**
     * 사용자의 계좌 목록 및 요약 정보를 조회합니다.
     * 현금 또는 교통카드 계좌가 없으면 자동으로 보충 생성합니다.
     */
    @Transactional
    public AccountSummaryResponse getAccounts(String userId, boolean includeInactive) {
        ensureDefaultAccounts(userId);

        List<Account> accounts = includeInactive
                ? accountRepository.findByUserIdOrderByDisplayOrderAsc(userId)
                : accountRepository.findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(userId);

        List<AccountResponse> responseList = accounts.stream()
                .map(AccountResponse::from)
                .toList();

        return AccountSummaryResponse.from(responseList);
    }

    /**
     * 필수 기본 계좌(현금, 교통카드)가 누락되어 있다면 자동으로 생성해 보충합니다.
     * 신규 유저는 물론 기존 유저도 현금/교통카드가 없는 경우 안전하게 추가됩니다.
     */
    @Transactional
    public void ensureDefaultAccounts(String userId) {
        boolean hasCash = accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.CASH)
                || accountRepository.existsByUserIdAndAccountName(userId, "현금");
        if (!hasCash) {
            Account cashAccount = Account.builder()
                    .userId(userId)
                    .accountName("현금")
                    .bankName("지갑 / 현금")
                    .accountType(AccountType.CHECKING)
                    .accountPurpose(AccountPurpose.CASH)
                    .currency(Currency.KRW)
                    .initialBalance(BigDecimal.ZERO)
                    .initialBalanceDate(LocalDate.now())
                    .cachedBookBalance(BigDecimal.ZERO)
                    .displayOrder(1)
                    .isActive(true)
                    .balanceUpdatedAt(LocalDateTime.now())
                    .build();
            accountRepository.save(cashAccount);
            log.info("사용자 현금 계좌 자동 생성 완료 - userId: {}", userId);
        }

        boolean hasTransit = accountRepository.existsByUserIdAndAccountPurpose(userId, AccountPurpose.TRANSIT_CARD)
                || accountRepository.existsByUserIdAndAccountName(userId, "교통카드");
        if (!hasTransit) {
            Account transitCard = Account.builder()
                    .userId(userId)
                    .accountName("교통카드")
                    .bankName("교통 / 선불카드")
                    .accountType(AccountType.CHECKING)
                    .accountPurpose(AccountPurpose.TRANSIT_CARD)
                    .currency(Currency.KRW)
                    .initialBalance(BigDecimal.ZERO)
                    .initialBalanceDate(LocalDate.now())
                    .cachedBookBalance(BigDecimal.ZERO)
                    .displayOrder(2)
                    .isActive(true)
                    .balanceUpdatedAt(LocalDateTime.now())
                    .build();
            accountRepository.save(transitCard);
            log.info("사용자 교통카드 계좌 자동 생성 완료 - userId: {}", userId);
        }
    }

    /**
     * 사용자의 기본 스타터 계좌(현금, 교통카드)를 생성합니다. (호환용)
     */
    @Transactional
    public List<Account> createDefaultStarterAccounts(String userId) {
        ensureDefaultAccounts(userId);
        return accountRepository.findByUserIdOrderByDisplayOrderAsc(userId);
    }

    /**
     * 사용자의 기본 '현금' 계좌를 생성합니다. (단건 호환용)
     */
    @Transactional
    public Account createDefaultCashAccount(String userId) {
        ensureDefaultAccounts(userId);
        return accountRepository.findByUserIdOrderByDisplayOrderAsc(userId).stream()
                .filter(a -> a.getAccountPurpose() == AccountPurpose.CASH || "현금".equals(a.getAccountName()))
                .findFirst()
                .orElse(null);
    }

    /**
     * 계좌 단건 정보를 조회합니다.
     */
    public AccountResponse getAccount(String accountId, String userId) {
        Account account = findAccountOrThrow(accountId, userId);
        return AccountResponse.from(account);
    }

    /**
     * 계좌 정보를 수정합니다.
     */
    @Transactional
    public AccountResponse updateAccount(String accountId, String userId, AccountUpdateRequest request) {
        Account account = findAccountOrThrow(accountId, userId);

        account.updateInfo(
                request.getAccountName(),
                request.getBankName(),
                request.getAccountType(),
                request.getAccountPurpose(),
                request.getCurrency(),
                request.getMinimumBalance(),
                request.getTargetBalance(),
                request.getAccountNumberMasked(),
                request.getDisplayOrder(),
                request.getInterestRate(),
                request.getMaturityDate(),
                request.getInterestType(),
                request.getMonthlyPayment()
                , request.getInitialExchangeRate()
        );

        account.configureBrokerage(request.getBrokerageCountry(),request.getBrokerageTaxType());
        log.info("가계부 계좌 정보 수정 - accountId: {}, name: {}", accountId, account.getAccountName());
        return AccountResponse.from(account);
    }

    /**
     * 실제 계좌 잔액 맞춤(Reconcile)을 처리하고 대조 이력을 DB에 기록합니다.
     */
    @Transactional
    public AccountResponse reconcileBalance(String accountId, String userId, AccountBalanceReconcileRequest request) {
        Account account = findAccountOrThrow(accountId, userId);
        BigDecimal bookBal = account.getCachedBookBalance();
        BigDecimal actualBal = request.getActualBalance();
        BigDecimal diff = actualBal.subtract(bookBal);

        account.reconcileBalance(actualBal);

        ReconciliationLog logEntry = ReconciliationLog.builder()
                .userId(userId)
                .accountId(accountId)
                .bookBalance(bookBal)
                .actualBalance(actualBal)
                .diffAmount(diff)
                .reasonCode(diff.compareTo(BigDecimal.ZERO) == 0 ? "MATCHED" : "DISCREPANCY")
                .memo("인터넷 뱅킹 잔액 검증 실행")
                .build();
        reconciliationRepository.save(logEntry);

        log.info("가계부 계좌 잔액 맞춰보기(Reconcile) 및 이력 저장 - accountId: {}, actualBalance: {}", accountId, actualBal);
        return AccountResponse.from(account);
    }

    /**
     * 차액 발생 시 장부 잔액을 실제 뱅킹 잔액과 100% 동기화하는 상계 처리(Auto Adjustment)를 수행합니다.
     */
    @Transactional
    public AccountResponse adjustBalanceToActual(String accountId, String userId) {
        Account account = findAccountOrThrow(accountId, userId);
        if (account.getLastActualBalance() == null) {
            throw new IllegalStateException("등록된 실제 인터넷 뱅킹 잔액이 없습니다. 먼저 잔액 대조를 입력해 주세요.");
        }
        return reconcileAndAdjustBalance(accountId, userId, BalanceAdjustmentRequest.builder()
                .actualBalance(account.getLastActualBalance())
                .reason("이전 방식 자동 조정")
                .memo("실제 잔액 기준 자동 조정")
                .build());
    }

    /**
     * 실제 잔액 대조와 조정 거래 생성을 한 트랜잭션으로 처리합니다.
     * 장부 잔액을 직접 덮어쓰지 않아 모든 조정이 거래 내역에 남습니다.
     */
    @Transactional
    public AccountResponse reconcileAndAdjustBalance(
            String accountId, String userId, BalanceAdjustmentRequest request) {
        Account account = findAccountOrThrow(accountId, userId);
        BigDecimal bookBalance = account.getCachedBookBalance();
        BigDecimal actualBalance = request.getActualBalance();
        BigDecimal adjustmentAmount = actualBalance.subtract(bookBalance);
        String reason = request.getReason().trim();
        String memo = request.getMemo() == null ? "" : request.getMemo().trim();
        if ("기타".equals(reason) && memo.isBlank()) {
            throw new IllegalArgumentException("조정 이유가 기타인 경우 상세 메모를 입력해 주세요.");
        }

        boolean allowsNegativeBalance = account.getAccountType() == AccountType.DEBT
                || account.getAccountPurpose() == com.dm.travel_planner.domain.ledger.entity.AccountPurpose.CREDIT_LINE;
        if (!allowsNegativeBalance && actualBalance.signum() < 0) {
            throw new IllegalArgumentException("일반 계좌의 실제 잔액은 0원 미만일 수 없습니다.");
        }

        account.reconcileBalance(actualBalance);
        ReconciliationLog reconciliation = reconciliationRepository.save(ReconciliationLog.builder()
                .userId(userId)
                .accountId(accountId)
                .bookBalance(bookBalance)
                .actualBalance(actualBalance)
                .diffAmount(adjustmentAmount)
                .reasonCode(adjustmentAmount.signum() == 0 ? "MATCHED" : "ADJUSTED")
                .memo("잔액 조정 사유: " + reason + (memo.isBlank() ? "" : " · " + memo))
                .build());

        if (adjustmentAmount.signum() == 0) {
            return AccountResponse.from(account);
        }

        if (account.getAccountType() == AccountType.INVESTMENT) {
            investmentService.createCashAdjustment(
                    accountId, userId, adjustmentAmount, reason, memo, reconciliation.getReconciliationId());
        } else {
            boolean isIncome = adjustmentAmount.signum() > 0;
            Transaction adjustment = Transaction.builder()
                    .userId(userId)
                    .accountId(accountId)
                    .transactionDate(LocalDateTime.now())
                    .transactionType(isIncome ? TransactionType.INCOME : TransactionType.EXPENSE)
                    .title("잔액 조정 · " + reason)
                    .categoryId(null)
                    .amount(adjustmentAmount.abs())
                    .currency(account.getCurrency())
                    .memo("[잔액 조정] 사유: " + reason + (memo.isBlank() ? "" : " · " + memo))
                    .reconciliationId(reconciliation.getReconciliationId())
                    .build();
            transactionRepository.save(adjustment);
            account.applyQuickTransaction(adjustmentAmount.abs(), isIncome);
        }

        log.info("잔액 대조 조정 거래 생성 - accountId: {}, adjustment: {}, reason: {}",
                accountId, adjustmentAmount, reason);
        return AccountResponse.from(account);
    }

    public List<ReconciliationLogResponse> getReconciliationLogs(String accountId, String userId) {
        findAccountOrThrow(accountId, userId);
        return reconciliationRepository.findByAccountIdOrderByReconciledAtDesc(accountId)
                .stream()
                .map(ReconciliationLogResponse::from)
                .toList();
    }

    /**
     * 선택한 계좌에 빠른 수입/지출을 직접 반영합니다.
     */
    @Transactional
    public AccountResponse applyQuickTransaction(String accountId, String userId, QuickTransactionRequest request) {
        Account account = findAccountOrThrow(accountId, userId);
        account.applyQuickTransaction(request.getAmount(), Boolean.TRUE.equals(request.getIsIncome()));
        log.info("계좌 빠른 입출금 반영 - accountId: {}, isIncome: {}, amount: {}", accountId, request.getIsIncome(), request.getAmount());
        return AccountResponse.from(account);
    }

    /**
     * 적금/목적 저축 계좌의 목표 잔액(Target Balance)을 설정/갱신합니다.
     */
    @Transactional
    public AccountResponse updateTargetBalance(String accountId, String userId, TargetBalanceUpdateRequest request) {
        Account account = findAccountOrThrow(accountId, userId);
        account.updateTargetBalance(request.getTargetBalance());
        log.info("목표 저축 금액 갱신 - accountId: {}, targetBalance: {}", accountId, request.getTargetBalance());
        return AccountResponse.from(account);
    }

    /**
     * 계좌를 비활성화(Soft Delete) 처리합니다.
     */
    @Transactional
    public void deactivateAccount(String accountId, String userId) {
        Account account = findAccountOrThrow(accountId, userId);
        account.deactivate();
        log.info("가계부 계좌 비활성화 완료 - accountId: {}", accountId);
    }

    /**
     * 비활성화된 계좌를 다시 활성화합니다.
     */
    @Transactional
    public void activateAccount(String accountId, String userId) {
        Account account = findAccountOrThrow(accountId, userId);
        account.activate();
        log.info("가계부 계좌 재활성화 완료 - accountId: {}", accountId);
    }

    /**
     * 계좌 및 관련 데이터(거래내역, 대조이력)를 DB에서 완전히 영구 삭제합니다.
     */
    @Transactional
    public void deleteAccountPermanently(String accountId, String userId) {
        Account account = findAccountOrThrow(accountId, userId);
        // 연관 데이터 삭제
        investmentCleanupService.deleteAccountData(accountId, userId);
        foreignCurrencyTransactionRepository.deleteByAccountId(accountId);
        transactionRepository.deleteByAccountId(accountId);
        reconciliationRepository.deleteByAccountId(accountId);
        // 계좌 엔티티 삭제
        accountRepository.delete(account);
        log.info("가계부 계좌 영구 삭제 완료 - accountId: {}", accountId);
    }

    private Account findAccountOrThrow(String accountId, String userId) {
        return accountRepository.findByAccountIdAndUserId(accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없거나 접근 권한이 없습니다. accountId: " + accountId));
    }
}
