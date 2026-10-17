package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.AccountStatsResponse;
import com.dm.travel_planner.domain.ledger.dto.AccountResponse;
import com.dm.travel_planner.domain.ledger.dto.DebtMonthlyRepaymentResponse;
import com.dm.travel_planner.domain.ledger.dto.TransactionCreateRequest;
import com.dm.travel_planner.domain.ledger.dto.TransactionResponse;
import com.dm.travel_planner.domain.ledger.dto.TransactionUpdateRequest;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;

    @Transactional
    public TransactionResponse createTransaction(String userId, TransactionCreateRequest request) {
        if (request.getTransactionType() == TransactionType.TRANSFER) {
            throw new IllegalArgumentException("계좌이체는 출금·입금 계좌를 함께 지정하는 전용 기능에서 등록해 주세요.");
        }
        Account account = accountRepository.findById(request.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다. accountId: " + request.getAccountId()));

        Currency curr = request.getCurrency() != null ? request.getCurrency() : account.getCurrency();
        LocalDateTime txDate = request.getTransactionDate() != null ? request.getTransactionDate() : LocalDateTime.now();

        // 부채 계좌 과다 상환 방지 검증
        boolean isIncome = request.getTransactionType() == TransactionType.INCOME;
        if (account.getAccountType() == com.dm.travel_planner.domain.ledger.entity.AccountType.DEBT
                && isIncome && account.getCachedBookBalance().signum() < 0
                && account.getCachedBookBalance().add(request.getAmount()).signum() > 0) {
            throw new IllegalArgumentException("상환 금액은 현재 남은 부채보다 클 수 없습니다.");
        }

        // fk_transactions_category 외래키 제약조건 방지 및 카테고리 정보 보존
        String inputCategory = request.getCategoryId() != null ? request.getCategoryId() : "기타";
        String rawMemo = request.getMemo() != null ? request.getMemo() : "";
        String formattedMemo = rawMemo.startsWith("[") ? rawMemo : "[" + inputCategory + "] " + rawMemo;

        Transaction tx = Transaction.builder()
                .userId(userId != null ? userId : account.getUserId())
                .accountId(account.getAccountId())
                .transactionDate(txDate)
                .transactionType(request.getTransactionType())
                .title(request.getTitle())
                .categoryId(null) // fk_transactions_category FK 오류 완전 차단
                .amount(request.getAmount())
                .currency(curr)
                .memo(formattedMemo.trim())
                .build();

        Transaction savedTx = transactionRepository.save(tx);

        // 계좌 장부 잔액 업데이트 반영
        account.applyQuickTransaction(request.getAmount(), isIncome);

        log.info("가계부 거래 내역 등록 및 장부 잔액 반영 - accountId: {}, type: {}, amount: {}", account.getAccountId(), request.getTransactionType(), request.getAmount());
        return TransactionResponse.from(savedTx);
    }

    @Transactional
    public DebtMonthlyRepaymentResponse applyDebtMonthlyRepayment(String accountId, String userId) {
        Account account = accountRepository.findForUpdateByAccountIdAndUserId(accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("부채 계좌를 찾을 수 없습니다."));
        if (account.getAccountType() != com.dm.travel_planner.domain.ledger.entity.AccountType.DEBT) {
            throw new IllegalArgumentException("부채 계좌에서만 월 상환을 실행할 수 있습니다.");
        }
        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new IllegalArgumentException("비활성화된 부채 계좌에는 상환을 반영할 수 없습니다.");
        }
        BigDecimal plannedPayment = account.getMonthlyPayment();
        if (plannedPayment == null || plannedPayment.signum() <= 0) {
            throw new IllegalArgumentException("계좌 수정에서 월 상환 계획을 먼저 설정해 주세요.");
        }

        BigDecimal outstanding = account.getCachedBookBalance() == null
                ? BigDecimal.ZERO : account.getCachedBookBalance().abs();
        if (outstanding.signum() == 0) {
            throw new IllegalArgumentException("이미 상환이 완료된 부채 계좌입니다.");
        }

        YearMonth currentMonth = YearMonth.now();
        LocalDateTime from = currentMonth.atDay(1).atStartOfDay();
        LocalDateTime to = currentMonth.plusMonths(1).atDay(1).atStartOfDay();
        String monthLabel = currentMonth.getYear() + "년 " + currentMonth.getMonthValue() + "월";
        String title = monthLabel + " 정기 상환";
        var existing = transactionRepository
                .findFirstByAccountIdAndTransactionTypeAndTransactionDateGreaterThanEqualAndTransactionDateLessThanAndTitle(
                        accountId, TransactionType.INCOME, from, to, title);
        if (existing.isPresent()) {
            return new DebtMonthlyRepaymentResponse(false, "이번 달 정기 상환은 이미 반영되었습니다.",
                    TransactionResponse.from(existing.get()), AccountResponse.from(account));
        }

        BigDecimal repayment = plannedPayment.min(outstanding);
        Transaction saved = transactionRepository.save(Transaction.builder()
                .userId(userId)
                .accountId(accountId)
                .transactionDate(LocalDateTime.now())
                .transactionType(TransactionType.INCOME)
                .title(title)
                .categoryId(null)
                .amount(repayment)
                .currency(account.getCurrency())
                .memo("[부채 월 상환] 월 상환 계획 원클릭 반영")
                .build());
        account.applyQuickTransaction(repayment, true);

        log.info("부채 월 상환 원클릭 반영 - accountId: {}, month: {}, amount: {}",
                accountId, currentMonth, repayment);
        return new DebtMonthlyRepaymentResponse(true, monthLabel + " 정기 상환이 반영되었습니다.",
                TransactionResponse.from(saved), AccountResponse.from(account));
    }

    public List<TransactionResponse> getTransactionsByAccount(String accountId, String userId) {
        return transactionRepository.findByAccountIdOrderByTransactionDateDesc(accountId)
                .stream()
                .map(TransactionResponse::from)
                .toList();
    }

    public List<TransactionResponse> getTransactionsByUser(String userId) {
        return transactionRepository.findByUserIdOrderByTransactionDateDesc(userId)
                .stream()
                .map(TransactionResponse::from)
                .toList();
    }

    @Transactional
    public TransactionResponse updateTransaction(String transactionId, String userId, TransactionUpdateRequest request) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("거래 내역을 찾을 수 없습니다: " + transactionId));
        if (tx.getTransactionType() == TransactionType.TRANSFER
                || request.getTransactionType() == TransactionType.TRANSFER) {
            throw new IllegalArgumentException("연결된 계좌이체는 원본 투자 예수금 거래에서 관리해 주세요.");
        }

        // 원래 금액으로 계좌 잔액 역보정 후 새 금액 반영
        Account account = accountRepository.findById(tx.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다."));

        boolean wasIncome = tx.getTransactionType() == TransactionType.INCOME;
        boolean isIncome = request.getTransactionType() != null
                ? request.getTransactionType() == TransactionType.INCOME
                : wasIncome;
        BigDecimal newAmount = request.getAmount() != null ? request.getAmount() : tx.getAmount();

        // 역보정: 기존 거래 취소
        account.applyQuickTransaction(tx.getAmount(), !wasIncome);
        // 새 금액 반영
        account.applyQuickTransaction(newAmount, isIncome);

        tx.updateTransaction(
                request.getTitle(),
                request.getAmount(),
                request.getTransactionType(),
                request.getCategoryId(),
                request.getTransactionDate(),
                request.getMemo()
        );

        log.info("거래 내역 수정 - transactionId: {}, accountId: {}", transactionId, tx.getAccountId());
        return TransactionResponse.from(transactionRepository.save(tx));
    }

    @Transactional
    public void deleteTransaction(String transactionId, String userId) {
        Transaction tx = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("거래 내역을 찾을 수 없습니다: " + transactionId));
        if (tx.getTransactionType() == TransactionType.TRANSFER) {
            throw new IllegalArgumentException("연결된 계좌이체는 원본 투자 예수금 거래에서 관리해 주세요.");
        }

        // 삭제 전 계좌 잔액 역보정
        Account account = accountRepository.findById(tx.getAccountId())
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다."));
        boolean wasIncome = tx.getTransactionType() == TransactionType.INCOME;
        account.applyQuickTransaction(tx.getAmount(), !wasIncome);

        transactionRepository.deleteById(transactionId);
        log.info("거래 내역 삭제 - transactionId: {}, accountId: {}", transactionId, tx.getAccountId());
    }

    public AccountStatsResponse getAccountStats(String accountId, String userId) {
        LocalDateTime startOfMonth = LocalDateTime.now().withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0);

        BigDecimal incomeTotal = transactionRepository.sumAmountByAccountIdAndTypeAndDateAfter(accountId, TransactionType.INCOME, startOfMonth);
        BigDecimal expenseTotal = transactionRepository.sumAmountByAccountIdAndTypeAndDateAfter(accountId, TransactionType.EXPENSE, startOfMonth);
        long count = transactionRepository.countByAccountIdAndDateAfter(accountId, startOfMonth);

        return AccountStatsResponse.builder()
                .accountId(accountId)
                .monthlyIncomeTotal(incomeTotal != null ? incomeTotal : BigDecimal.ZERO)
                .monthlyExpenseTotal(expenseTotal != null ? expenseTotal : BigDecimal.ZERO)
                .monthlyTransactionCount(count)
                .uncheckedCount(0)
                .build();
    }
}
