package com.dm.travel_planner.domain.ledger.controller;

import com.dm.travel_planner.domain.ledger.dto.AccountTransferRequest;
import com.dm.travel_planner.domain.ledger.dto.AccountTransferResponse;
import com.dm.travel_planner.domain.ledger.service.AccountTransferService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger/transfers")
public class AccountTransferController {
    private final AccountTransferService accountTransferService;

    @PostMapping
    public ResponseEntity<AccountTransferResponse> create(
            @RequestBody @Valid AccountTransferRequest request,
            @AuthenticationPrincipal Object principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(accountTransferService.createTransfer(extractUserId(principal), request));
    }

    @GetMapping
    public List<AccountTransferResponse> getAll(@AuthenticationPrincipal Object principal) {
        return accountTransferService.getTransfers(extractUserId(principal));
    }

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }
}
