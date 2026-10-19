package com.dm.travel_planner.domain.ledger.planning.controller;

import com.dm.travel_planner.domain.ledger.planning.dto.*;
import com.dm.travel_planner.domain.ledger.planning.service.FinancialPlanningService;
import com.dm.travel_planner.domain.ledger.planning.service.InvestmentPlanningService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ledger/planning")
public class FinancialPlanningController {
    private final FinancialPlanningService planningService;
    private final InvestmentPlanningService investmentPlanningService;

    @GetMapping
    public FinancialPlanningDashboardResponse dashboard(@RequestParam(required = false) String month,
                                                         @RequestParam(defaultValue = "KRW") String currency,
                                                         @AuthenticationPrincipal Object principal) {
        return planningService.getDashboard(extractUserId(principal), month, currency);
    }

    @PutMapping("/monthly")
    public ResponseEntity<Void> saveMonthlyPlan(@Valid @RequestBody MonthlyPlanRequest request,
                                                @AuthenticationPrincipal Object principal) {
        planningService.saveMonthlyPlan(extractUserId(principal), request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/budgets")
    public ResponseEntity<Void> saveBudgets(@Valid @RequestBody CategoryBudgetsRequest request,
                                            @AuthenticationPrincipal Object principal) {
        planningService.replaceCategoryBudgets(extractUserId(principal), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/goals")
    public List<FinancialGoalResponse> goals(@AuthenticationPrincipal Object principal) {
        return planningService.getGoals(extractUserId(principal));
    }

    @PostMapping("/goals")
    @ResponseStatus(HttpStatus.CREATED)
    public FinancialGoalResponse createGoal(@Valid @RequestBody FinancialGoalRequest request,
                                            @AuthenticationPrincipal Object principal) {
        return planningService.createGoal(extractUserId(principal), request);
    }

    @PutMapping("/goals/{goalId}")
    public FinancialGoalResponse updateGoal(@PathVariable String goalId,
                                            @Valid @RequestBody FinancialGoalRequest request,
                                            @AuthenticationPrincipal Object principal) {
        return planningService.updateGoal(extractUserId(principal), goalId, request);
    }

    @PostMapping("/goals/{goalId}/contributions")
    @ResponseStatus(HttpStatus.CREATED)
    public FinancialGoalResponse contribute(@PathVariable String goalId,
                                            @Valid @RequestBody GoalContributionRequest request,
                                            @AuthenticationPrincipal Object principal) {
        return planningService.addContribution(extractUserId(principal), goalId, request);
    }

    @DeleteMapping("/goals/{goalId}")
    public ResponseEntity<Void> archiveGoal(@PathVariable String goalId,
                                            @AuthenticationPrincipal Object principal) {
        planningService.archiveGoal(extractUserId(principal), goalId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/investment-plans")
    public List<InvestmentPlanResponse> investmentPlans(
            @RequestParam(required = false) String month,
            @AuthenticationPrincipal Object principal) {
        return investmentPlanningService.getPlans(extractUserId(principal), month);
    }

    @PostMapping("/investment-plans")
    @ResponseStatus(HttpStatus.CREATED)
    public InvestmentPlanResponse createInvestmentPlan(
            @Valid @RequestBody InvestmentPlanRequest request,
            @RequestParam(required = false) String month,
            @AuthenticationPrincipal Object principal) {
        return investmentPlanningService.create(extractUserId(principal), request, month);
    }

    @PutMapping("/investment-plans/{planId}")
    public InvestmentPlanResponse updateInvestmentPlan(
            @PathVariable String planId,
            @Valid @RequestBody InvestmentPlanRequest request,
            @RequestParam(required = false) String month,
            @AuthenticationPrincipal Object principal) {
        return investmentPlanningService.update(extractUserId(principal), planId, request, month);
    }

    @DeleteMapping("/investment-plans/{planId}")
    public ResponseEntity<Void> archiveInvestmentPlan(
            @PathVariable String planId,
            @AuthenticationPrincipal Object principal) {
        investmentPlanningService.archive(extractUserId(principal), planId);
        return ResponseEntity.noContent().build();
    }

    private String extractUserId(Object principal) {
        return com.dm.travel_planner.global.security.AuthenticatedUser.id(principal);
    }
}
