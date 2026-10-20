package com.dm.travel_planner.domain.ledger.investment.controller;

import com.dm.travel_planner.domain.ledger.investment.dto.*;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import com.dm.travel_planner.domain.ledger.entity.Currency;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger/investment-accounts")
public class InvestmentController {
    private final InvestmentService investmentService;

    @GetMapping("/{accountId}/detail")
    public InvestmentDetailResponse getDetail(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal) {
        return investmentService.getDetail(accountId, extractUserId(principal));
    }

    @GetMapping("/{accountId}/symbols/search")
    public List<InvestmentSymbolResponse> searchSymbols(
            @PathVariable String accountId,
            @RequestParam String query,
            @RequestParam(defaultValue = "ALL") String market,
            @AuthenticationPrincipal Object principal) {
        return investmentService.searchSymbols(accountId, extractUserId(principal), query, market);
    }

    @GetMapping("/{accountId}/quotes/trade-price")
    public InvestmentTradePriceResponse getTradePrice(
            @PathVariable String accountId,
            @RequestParam String tickerCode,
            @RequestParam String market,
            @RequestParam Currency currency,
            @AuthenticationPrincipal Object principal) {
        return investmentService.getTradePrice(
                accountId, extractUserId(principal), tickerCode, market, currency);
    }

    @PostMapping("/{accountId}/holdings")
    @ResponseStatus(HttpStatus.CREATED)
    public InvestmentDetailResponse.Holding createHolding(
            @PathVariable String accountId,
            @RequestBody @Valid InvestmentHoldingCreateRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.createHolding(accountId, extractUserId(principal), request);
    }

    @PatchMapping("/{accountId}/holdings/{investmentId}/price")
    public InvestmentDetailResponse.Holding updateManualPrice(
            @PathVariable String accountId,
            @PathVariable String investmentId,
            @RequestBody @Valid InvestmentPriceUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        String userId = extractUserId(principal);
        return investmentService.updateManualPrice(accountId, investmentId, userId, request);
    }

    @PostMapping("/{accountId}/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public InvestmentTransactionResponse createTransaction(
            @PathVariable String accountId,
            @RequestBody @Valid InvestmentTradeRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.recordTransaction(accountId, extractUserId(principal), request);
    }

    @GetMapping("/{accountId}/fee-settings")
    public List<InvestmentFeeSettingResponse> getFeeSettings(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal) {
        return investmentService.getFeeSettings(accountId, extractUserId(principal));
    }

    @PostMapping("/{accountId}/sale-tax-preview")
    public com.dm.travel_planner.domain.ledger.investment.service.SaleTaxRules.Quote previewSaleTax(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal,
            @RequestBody @Valid InvestmentTradeRequest request) {
        return investmentService.previewSaleTax(accountId,extractUserId(principal),request);
    }

    @PatchMapping("/{accountId}/transactions/{transactionId}/costs")
    public InvestmentTransactionResponse correctCosts(@PathVariable String accountId,@PathVariable String transactionId,
            @AuthenticationPrincipal Object principal,@RequestBody @Valid InvestmentCostEditRequest request) {
        return investmentService.correctCosts(accountId,extractUserId(principal),transactionId,request);
    }

    @GetMapping("/{accountId}/annual-summary")
    public InvestmentAnnualResponse annualSummary(@PathVariable String accountId,@RequestParam int year,@AuthenticationPrincipal Object principal) {
        return investmentService.annualSummary(accountId,extractUserId(principal),year);
    }

    @PutMapping("/{accountId}/fee-settings")
    public List<InvestmentFeeSettingResponse> updateFeeSettings(
            @PathVariable String accountId,
            @RequestBody @Valid InvestmentFeeSettingsRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.updateFeeSettings(accountId, extractUserId(principal), request);
    }

    @GetMapping("/{accountId}/transactions")
    public Page<InvestmentTransactionResponse> getTransactions(
            @PathVariable String accountId,
            @RequestParam(required = false) InvestmentTradeType type,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            Pageable pageable,
            @AuthenticationPrincipal Object principal) {
        return investmentService.getTransactions(accountId, extractUserId(principal), type, from, to, pageable);
    }

    @GetMapping("/transactions")
    public List<InvestmentActivityResponse> getUserActivities(
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @AuthenticationPrincipal Object principal) {
        return investmentService.getUserActivities(extractUserId(principal), from, to);
    }

    @PatchMapping("/{accountId}/profile")
    public InvestmentDetailResponse.Profile updateProfile(
            @PathVariable String accountId,
            @RequestBody InvestmentProfileUpdateRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.updateProfile(accountId, extractUserId(principal), request);
    }

    @PutMapping("/{accountId}/target-allocations")
    public List<InvestmentDetailResponse.TargetAllocation> updateTargetAllocations(
            @PathVariable String accountId,
            @RequestBody @Valid InvestmentTargetAllocationRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.updateTargets(accountId, extractUserId(principal), request);
    }

    @PostMapping("/{accountId}/notes")
    @ResponseStatus(HttpStatus.CREATED)
    public InvestmentDetailResponse.Note createNote(
            @PathVariable String accountId,
            @RequestBody @Valid InvestmentNoteRequest request,
            @AuthenticationPrincipal Object principal) {
        return investmentService.createNote(accountId, extractUserId(principal), request);
    }

    @DeleteMapping("/{accountId}/notes/{noteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(
            @PathVariable String accountId,
            @PathVariable String noteId,
            @AuthenticationPrincipal Object principal) {
        investmentService.deleteNote(accountId, noteId, extractUserId(principal));
    }

    @PostMapping("/{accountId}/prices/sync")
    public List<InvestmentDetailResponse.Holding> syncPrices(
            @PathVariable String accountId, @AuthenticationPrincipal Object principal) {
        return investmentService.syncPrices(accountId, extractUserId(principal));
    }

    @GetMapping("/price-provider/status")
    public Map<String, Object> getPriceProviderStatus() {
        Map<String, Object> status = new java.util.LinkedHashMap<>();
        status.put("configured", investmentService.isPriceProviderConfigured());
        status.put("provider", investmentService.getPriceProviderName());
        investmentService.getPriceProviderLastFailure()
                .ifPresent(message -> status.put("lastFailure", message));
        return status;
    }

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }
}
