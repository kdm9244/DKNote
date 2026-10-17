package com.dm.travel_planner.domain.ledger.controller;

import com.dm.travel_planner.domain.ledger.dto.*;
import com.dm.travel_planner.domain.ledger.service.AccountService;
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
@RequestMapping("/api/ledger/accounts")
public class AccountController {

    private final AccountService accountService;

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }

    /**
     * 신규 가계부 계좌를 생성합니다.
     */
    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(
            @RequestBody @Valid AccountCreateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        AccountResponse response = accountService.createAccount(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * 사용자의 계좌 목록 및 요약 정보를 조회합니다.
     */
    @GetMapping
    public ResponseEntity<AccountSummaryResponse> getAccounts(
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.getAccounts(userId, includeInactive));
    }

    /**
     * 특정 계좌 단건 정보를 조회합니다.
     */
    @GetMapping("/{accountId}")
    public ResponseEntity<AccountResponse> getAccount(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.getAccount(accountId, userId));
    }

    /**
     * 특정 계좌 정보를 수정합니다.
     */
    @PutMapping("/{accountId}")
    public ResponseEntity<AccountResponse> updateAccount(
            @PathVariable String accountId,
            @RequestBody @Valid AccountUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.updateAccount(accountId, userId, request));
    }

    /**
     * 특정 계좌의 실제 잔액 맞춤(Reconcile)을 실행합니다.
     */
    @PatchMapping("/{accountId}/reconcile")
    public ResponseEntity<AccountResponse> reconcileBalance(
            @PathVariable String accountId,
            @RequestBody @Valid AccountBalanceReconcileRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.reconcileBalance(accountId, userId, request));
    }

    /**
     * 차액 발생 시 장부 잔액을 실제 뱅킹 잔액과 동기화하는 상계 처리(Auto Adjustment)를 수행합니다.
     */
    @PostMapping("/{accountId}/adjust-to-actual")
    public ResponseEntity<AccountResponse> adjustBalanceToActual(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.adjustBalanceToActual(accountId, userId));
    }

    @PostMapping("/{accountId}/reconcile-adjustment")
    public ResponseEntity<AccountResponse> reconcileAndAdjustBalance(
            @PathVariable String accountId,
            @RequestBody @Valid BalanceAdjustmentRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.reconcileAndAdjustBalance(accountId, userId, request));
    }

    /**
     * 특정 계좌의 대조 실행 이력을 조회합니다.
     */
    @GetMapping("/{accountId}/reconciliations")
    public ResponseEntity<List<ReconciliationLogResponse>> getReconciliationLogs(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.getReconciliationLogs(accountId, userId));
    }

    /**
     * 선택한 계좌에 빠른 수입/지출을 반영합니다.
     */
    @PostMapping("/{accountId}/quick-transaction")
    public ResponseEntity<AccountResponse> applyQuickTransaction(
            @PathVariable String accountId,
            @RequestBody @Valid QuickTransactionRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.applyQuickTransaction(accountId, userId, request));
    }

    /**
     * 적금/목적 저축 계좌의 목표 저축 금액을 갱신합니다.
     */
    @PatchMapping("/{accountId}/target-balance")
    public ResponseEntity<AccountResponse> updateTargetBalance(
            @PathVariable String accountId,
            @RequestBody @Valid TargetBalanceUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(accountService.updateTargetBalance(accountId, userId, request));
    }

    /**
     * 특정 계좌를 비활성화(Soft Delete)합니다.
     */
    @DeleteMapping("/{accountId}")
    public ResponseEntity<Void> deactivateAccount(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        accountService.deactivateAccount(accountId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 비활성화된 계좌를 다시 활성화합니다.
     */
    @PatchMapping("/{accountId}/activate")
    public ResponseEntity<Void> activateAccount(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        accountService.activateAccount(accountId, userId);
        return ResponseEntity.noContent().build();
    }

    /**
     * 특정 계좌 및 연관 데이터를 영구 삭제합니다.
     */
    @DeleteMapping("/{accountId}/permanent")
    public ResponseEntity<Void> deleteAccountPermanently(
            @PathVariable String accountId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        accountService.deleteAccountPermanently(accountId, userId);
        return ResponseEntity.noContent().build();
    }
}
