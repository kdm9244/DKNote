package com.dm.travel_planner.domain.ledger.controller;

import com.dm.travel_planner.domain.ledger.dto.AccountStatsResponse;
import com.dm.travel_planner.domain.ledger.dto.DebtMonthlyRepaymentResponse;
import com.dm.travel_planner.domain.ledger.dto.TransactionCreateRequest;
import com.dm.travel_planner.domain.ledger.dto.TransactionResponse;
import com.dm.travel_planner.domain.ledger.dto.TransactionUpdateRequest;
import com.dm.travel_planner.domain.ledger.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger")
public class TransactionController {

    private final TransactionService transactionService;

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }

    /**
     * 신규 수입/지출 거래 내역을 등록합니다.
     */
    @PostMapping("/transactions")
    public ResponseEntity<TransactionResponse> createTransaction(
            @RequestBody @Valid TransactionCreateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        TransactionResponse response = transactionService.createTransaction(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/accounts/{accountId}/debt/monthly-repayment")
    public ResponseEntity<DebtMonthlyRepaymentResponse> applyDebtMonthlyRepayment(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(transactionService.applyDebtMonthlyRepayment(accountId, userId));
    }

    /**
     * 계좌별 전체 거래 내역 목록을 조회합니다.
     */
    @GetMapping("/accounts/{accountId}/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactionsByAccount(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(transactionService.getTransactionsByAccount(accountId, userId));
    }

    /**
     * 사용자 전체 거래 내역 목록을 조회합니다.
     */
    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactionsByUser(
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(transactionService.getTransactionsByUser(userId));
    }

    /**
     * 계좌별 실시간 월간 입금/출금 통계를 조회합니다.
     */
    @GetMapping("/accounts/{accountId}/stats")
    public ResponseEntity<AccountStatsResponse> getAccountStats(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(transactionService.getAccountStats(accountId, userId));
    }

    /**
     * 거래 내역 수정
     */
    @PutMapping("/transactions/{transactionId}")
    public ResponseEntity<TransactionResponse> updateTransaction(
            @PathVariable String transactionId,
            @RequestBody TransactionUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(transactionService.updateTransaction(transactionId, userId, request));
    }

    /**
     * 거래 내역 삭제
     */
    @DeleteMapping("/transactions/{transactionId}")
    public ResponseEntity<Void> deleteTransaction(
            @PathVariable String transactionId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        transactionService.deleteTransaction(transactionId, userId);
        return ResponseEntity.noContent().build();
    }
}
