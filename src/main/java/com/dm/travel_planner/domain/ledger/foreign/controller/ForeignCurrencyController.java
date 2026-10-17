package com.dm.travel_planner.domain.ledger.foreign.controller;

import com.dm.travel_planner.domain.ledger.foreign.dto.*;
import com.dm.travel_planner.domain.ledger.foreign.service.ForeignCurrencyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger/foreign-accounts")
public class ForeignCurrencyController {
    private final ForeignCurrencyService service;

    @GetMapping("/{accountId}/detail")
    public ForeignCurrencyDetailResponse getDetail(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal) {
        return service.getDetail(accountId, extractUserId(principal));
    }

    @PostMapping("/{accountId}/rates/sync")
    public ForeignCurrencyDetailResponse syncRates(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal) {
        return service.syncRates(accountId, extractUserId(principal));
    }

    @PostMapping("/{accountId}/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public ForeignCurrencyDetailResponse.TransactionItem createTransaction(
            @PathVariable String accountId, @RequestBody @Valid ForeignTransactionRequest request,
            @AuthenticationPrincipal Object principal) {
        return service.createTransaction(accountId, extractUserId(principal), request);
    }

    @PutMapping("/{accountId}/transactions/{transactionId}")
    public ForeignCurrencyDetailResponse.TransactionItem updateTransaction(
            @PathVariable String accountId, @PathVariable String transactionId,
            @RequestBody @Valid ForeignTransactionRequest request,
            @AuthenticationPrincipal Object principal) {
        return service.updateTransaction(accountId, transactionId, extractUserId(principal), request);
    }

    @DeleteMapping("/{accountId}/transactions/{transactionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTransaction(
            @PathVariable String accountId, @PathVariable String transactionId,
            @AuthenticationPrincipal Object principal) {
        service.deleteTransaction(accountId, transactionId, extractUserId(principal));
    }

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }
}
