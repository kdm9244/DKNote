package com.dm.travel_planner.domain.ledger.planning.dto;

import java.math.BigDecimal;
import java.util.List;

public record FinancialPlanningDashboardResponse(
        String targetMonth,
        String currency,
        BigDecimal expectedIncome,
        BigDecimal actualIncome,
        BigDecimal fixedExpenseAmount,
        BigDecimal actualExpense,
        BigDecimal savingsTarget,
        BigDecimal investmentTarget,
        BigDecimal debtRepaymentTarget,
        BigDecimal categoryBudgetTotal,
        BigDecimal plannedOutflow,
        BigDecimal availableAmount,
        BigDecimal dailyAvailableAmount,
        String memo,
        List<CategoryBudgetItem> categoryBudgets,
        List<FinancialGoalResponse> goals
) {
    public record CategoryBudgetItem(
            String categoryName,
            BigDecimal budgetAmount,
            BigDecimal actualAmount,
            BigDecimal remainingAmount,
            BigDecimal usageRate
    ) {}
}
