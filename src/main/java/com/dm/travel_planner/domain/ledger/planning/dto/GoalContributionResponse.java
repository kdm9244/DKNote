package com.dm.travel_planner.domain.ledger.planning.dto;

import com.dm.travel_planner.domain.ledger.planning.entity.GoalContribution;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record GoalContributionResponse(
        String contributionId,
        String goalId,
        String sourceAccountId,
        String transferId,
        BigDecimal amount,
        LocalDateTime contributedAt,
        String memo
) {
    public static GoalContributionResponse from(GoalContribution item) {
        return new GoalContributionResponse(item.getContributionId(), item.getGoalId(), item.getSourceAccountId(),
                item.getTransferId(), item.getAmount(), item.getContributedAt(), item.getMemo());
    }
}
