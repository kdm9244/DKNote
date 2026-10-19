package com.dm.travel_planner.domain.ledger.planning.dto;

import com.dm.travel_planner.domain.ledger.planning.entity.FinancialGoal;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

public record FinancialGoalResponse(
        String goalId,
        String currency,
        String title,
        String description,
        String goalType,
        BigDecimal targetAmount,
        BigDecimal currentAmount,
        BigDecimal monthlyTargetAmount,
        BigDecimal progressRate,
        LocalDate targetDate,
        Integer priority,
        String linkedAccountId,
        String linkedAccountName,
        String iconColor,
        String status,
        List<GoalContributionResponse> recentContributions
) {
    public static FinancialGoalResponse from(FinancialGoal goal, String accountName,
                                             List<GoalContributionResponse> contributions) {
        BigDecimal rate = goal.getTargetAmount().signum() == 0 ? BigDecimal.ZERO
                : goal.getCurrentAmount().multiply(BigDecimal.valueOf(100))
                .divide(goal.getTargetAmount(), 1, RoundingMode.HALF_UP).min(BigDecimal.valueOf(100));
        return new FinancialGoalResponse(goal.getGoalId(), goal.getCurrency(), goal.getTitle(), goal.getDescription(), goal.getGoalType(),
                goal.getTargetAmount(), goal.getCurrentAmount(), goal.getMonthlyTargetAmount(), rate,
                goal.getTargetDate(), goal.getPriority(), goal.getLinkedAccountId(), accountName,
                goal.getIconColor(), goal.getStatus(), contributions);
    }
}
