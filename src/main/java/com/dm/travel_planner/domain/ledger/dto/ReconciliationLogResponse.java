package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.ReconciliationLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class ReconciliationLogResponse {

    private String reconciliationId;
    private String userId;
    private String accountId;
    private BigDecimal bookBalance;
    private BigDecimal actualBalance;
    private BigDecimal diffAmount;
    private String reasonCode;
    private String memo;
    private LocalDateTime reconciledAt;

    public static ReconciliationLogResponse from(ReconciliationLog entity) {
        return ReconciliationLogResponse.builder()
                .reconciliationId(entity.getReconciliationId())
                .userId(entity.getUserId())
                .accountId(entity.getAccountId())
                .bookBalance(entity.getBookBalance())
                .actualBalance(entity.getActualBalance())
                .diffAmount(entity.getDiffAmount())
                .reasonCode(entity.getReasonCode())
                .memo(entity.getMemo())
                .reconciledAt(entity.getReconciledAt())
                .build();
    }
}
