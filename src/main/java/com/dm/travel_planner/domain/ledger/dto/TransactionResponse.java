package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.entity.TransferDirection;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
@Builder
public class TransactionResponse {

    private String transactionId;
    private String userId;
    private String accountId;
    private LocalDateTime transactionDate;
    private TransactionType transactionType;
    private String title;
    private String categoryId;
    private BigDecimal amount;
    private Currency currency;
    private String memo;
    private String reconciliationId;
    private String transferId;
    private TransferDirection transferDirection;
    private LocalDateTime createdAt;

    public static TransactionResponse from(Transaction entity) {
        String catId = entity.getCategoryId();
        String memoText = entity.getMemo();

        if (catId == null && memoText != null && memoText.startsWith("[") && memoText.contains("]")) {
            int closingIdx = memoText.indexOf("]");
            catId = memoText.substring(1, closingIdx);
            memoText = memoText.substring(closingIdx + 1).trim();
        }

        return TransactionResponse.builder()
                .transactionId(entity.getTransactionId())
                .userId(entity.getUserId())
                .accountId(entity.getAccountId())
                .transactionDate(entity.getTransactionDate())
                .transactionType(entity.getTransactionType())
                .title(entity.getTitle())
                .categoryId(catId != null ? catId : "기타")
                .amount(entity.getAmount())
                .currency(entity.getCurrency())
                .memo(memoText)
                .reconciliationId(entity.getReconciliationId())
                .transferId(entity.getTransferId())
                .transferDirection(entity.getTransferDirection())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
