package com.dm.travel_planner.domain.ledger.controller;

import com.dm.travel_planner.domain.ledger.dto.LedgerDashboardResponse;
import com.dm.travel_planner.domain.ledger.service.LedgerDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger/dashboard")
public class LedgerDashboardController {
    private final LedgerDashboardService dashboardService;

    @GetMapping
    public LedgerDashboardResponse getDashboard(
            @RequestParam(required = false)
            @DateTimeFormat(pattern = "yyyy-MM") YearMonth month,
            @AuthenticationPrincipal Object principal) {
        return dashboardService.getDashboard(extractUserId(principal), month);
    }

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }
}
