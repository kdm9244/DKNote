package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class TransactionUpdateRequest {
    private String title;
    private BigDecimal amount;
    private TransactionType transactionType;
    private String categoryId; // 카테고리 이름 (한국어 텍스트, FK 아닌 memo 저장)
    private LocalDateTime transactionDate;
    private String memo;
    private Currency currency;
}
