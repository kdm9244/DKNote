package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.FixedExpenseApplyRequest;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseCreateRequest;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseResponse;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseUpdateRequest;
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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FixedExpenseService {

    private final FixedExpenseRepository fixedExpenseRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    @Transactional
    public FixedExpenseResponse createFixedExpense(String userId, FixedExpenseCreateRequest request) {
        Account account = null;
        if (request.getAccountId() != null && !request.getAccountId().isBlank()) {
            account = accountRepository.findByAccountIdAndUserId(request.getAccountId(), userId)
                    .orElseThrow(() -> new IllegalArgumentException("고정지출을 연결할 계좌를 찾을 수 없습니다."));
        }
        Currency curr = request.getCurrency() != null
                ? request.getCurrency()
                : account != null ? account.getCurrency() : Currency.KRW;
        if (account != null && account.getCurrency() != curr) {
            throw new IllegalArgumentException("고정지출 통화는 연결 계좌의 통화와 같아야 합니다.");
        }
        LocalDate nextDate = request.getNextPaymentDate() != null ? request.getNextPaymentDate() : LocalDate.now();
        Integer paymentDay = request.getPaymentDayOfMonth() != null
                ? request.getPaymentDayOfMonth()
                : nextDate.getDayOfMonth();

        FixedExpense fixedExpense = FixedExpense.builder()
                .userId(userId)
                .title(request.getTitle())
                .amount(request.getAmount())
                .currency(curr)
                .paymentDayOfMonth(paymentDay)
                .nextPaymentDate(nextDate)
                .accountId(request.getAccountId())
                .isActive(true)
                .build();

        FixedExpense saved = fixedExpenseRepository.save(fixedExpense);
        log.info("고정지출 등록 완료 - userId: {}, id: {}, title: {}", userId, saved.getFixedExpenseId(), saved.getTitle());
        return FixedExpenseResponse.from(saved);
    }

    @Transactional
    public TransactionResponse applyFixedExpense(
            String fixedExpenseId, String userId, FixedExpenseApplyRequest request) {
        FixedExpense expense = fixedExpenseRepository.findForUpdate(fixedExpenseId, userId)
                .orElseThrow(() -> new IllegalArgumentException("고정지출 항목을 찾을 수 없습니다."));
        if (!Boolean.TRUE.equals(expense.getIsActive())) {
            throw new IllegalStateException("비활성화된 고정지출은 반영할 수 없습니다.");
        }
        if (expense.getAccountId() == null || expense.getAccountId().isBlank()) {
            throw new IllegalStateException("고정지출에 연결된 계좌가 없습니다.");
        }
        if (!expense.getNextPaymentDate().equals(request.getExpectedPaymentDate())) {
            throw new IllegalStateException("이미 반영되었거나 결제 예정일이 변경되었습니다. 목록을 새로고침해 주세요.");
        }

        Account account = accountRepository.findByAccountIdAndUserId(expense.getAccountId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("연결된 계좌를 찾을 수 없습니다."));
        if (account.getCurrency() != expense.getCurrency()) {
            throw new IllegalStateException("고정지출과 계좌의 통화가 일치하지 않습니다.");
        }

        boolean allowsNegativeBalance = account.getAccountType() == AccountType.DEBT
                || account.getAccountPurpose() == AccountPurpose.CREDIT_LINE;
        if (!allowsNegativeBalance
                && account.getCachedBookBalance().subtract(expense.getAmount()).signum() < 0) {
            throw new IllegalArgumentException("잔액이 부족해 고정지출을 반영할 수 없습니다.");
        }

        LocalDate dueDate = expense.getNextPaymentDate();
        Transaction transaction = Transaction.builder()
                .userId(userId)
                .accountId(account.getAccountId())
                .transactionDate(LocalDateTime.now())
                .transactionType(TransactionType.EXPENSE)
                .title(expense.getTitle())
                .categoryId(null)
                .amount(expense.getAmount())
                .currency(expense.getCurrency())
                .memo("[고정지출] " + dueDate + " 결제 반영")
                .isFixedExpense(true)
                .build();
        Transaction savedTransaction = transactionRepository.save(transaction);
        account.applyQuickTransaction(expense.getAmount(), false);
        expense.advanceNextPaymentDate();

        log.info("고정지출 거래 반영 - fixedExpenseId: {}, accountId: {}, dueDate: {}, amount: {}",
                fixedExpenseId, account.getAccountId(), dueDate, expense.getAmount());
        return TransactionResponse.from(savedTransaction);
    }

    public List<FixedExpenseResponse> getFixedExpenses(String userId) {
        return fixedExpenseRepository.findByUserIdAndIsActiveTrueOrderByNextPaymentDateAsc(userId)
                .stream()
                .map(FixedExpenseResponse::from)
                .toList();
    }

    @Transactional
    public FixedExpenseResponse updateFixedExpense(
            String fixedExpenseId, String userId, FixedExpenseUpdateRequest request) {
        FixedExpense expense = fixedExpenseRepository.findByFixedExpenseIdAndUserId(fixedExpenseId, userId)
                .orElseThrow(() -> new IllegalArgumentException("고정지출 항목을 찾을 수 없습니다."));
        if (!Boolean.TRUE.equals(expense.getIsActive())) {
            throw new IllegalStateException("비활성화된 고정지출은 수정할 수 없습니다.");
        }
        expense.updateSchedule(
                request.getTitle(),
                request.getAmount(),
                request.getNextPaymentDate(),
                request.getPaymentDayOfMonth());
        log.info("고정지출 수정 - fixedExpenseId: {}, nextPaymentDate: {}",
                fixedExpenseId, request.getNextPaymentDate());
        return FixedExpenseResponse.from(expense);
    }

    @Transactional
    public void deactivateFixedExpense(String fixedExpenseId, String userId) {
        FixedExpense expense = fixedExpenseRepository.findByFixedExpenseIdAndUserId(fixedExpenseId, userId)
                .orElseThrow(() -> new IllegalArgumentException("고정지출 항목을 찾을 수 없습니다. id: " + fixedExpenseId));
        expense.deactivate();
        log.info("고정지출 비활성화 완료 - id: {}", fixedExpenseId);
    }
}
