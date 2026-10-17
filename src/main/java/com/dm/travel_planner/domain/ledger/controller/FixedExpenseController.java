package com.dm.travel_planner.domain.ledger.controller;

import com.dm.travel_planner.domain.ledger.dto.FixedExpenseApplyRequest;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseCreateRequest;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseResponse;
import com.dm.travel_planner.domain.ledger.dto.FixedExpenseUpdateRequest;
import com.dm.travel_planner.domain.ledger.dto.TransactionResponse;
import com.dm.travel_planner.domain.ledger.service.FixedExpenseService;
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
@RequestMapping("/api/ledger/fixed-expenses")
public class FixedExpenseController {

    private final FixedExpenseService fixedExpenseService;

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }

    @PostMapping
    public ResponseEntity<FixedExpenseResponse> createFixedExpense(
            @RequestBody @Valid FixedExpenseCreateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        FixedExpenseResponse response = fixedExpenseService.createFixedExpense(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<FixedExpenseResponse>> getFixedExpenses(
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(fixedExpenseService.getFixedExpenses(userId));
    }

    @PutMapping("/{fixedExpenseId}")
    public ResponseEntity<FixedExpenseResponse> updateFixedExpense(
            @PathVariable String fixedExpenseId,
            @RequestBody @Valid FixedExpenseUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.ok(fixedExpenseService.updateFixedExpense(fixedExpenseId, userId, request));
    }

    @DeleteMapping("/{fixedExpenseId}")
    public ResponseEntity<Void> deactivateFixedExpense(
            @PathVariable String fixedExpenseId,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        fixedExpenseService.deactivateFixedExpense(fixedExpenseId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{fixedExpenseId}/apply")
    public ResponseEntity<TransactionResponse> applyFixedExpense(
            @PathVariable String fixedExpenseId,
            @RequestBody @Valid FixedExpenseApplyRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(fixedExpenseService.applyFixedExpense(fixedExpenseId, userId, request));
    }
}
