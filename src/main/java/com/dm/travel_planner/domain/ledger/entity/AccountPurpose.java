package com.dm.travel_planner.domain.ledger.entity;

public enum AccountPurpose {
    // 입출금 중분류
    CASH,                // 현금/지갑
    TRANSIT_CARD,        // 교통카드/선불카드
    GENERAL_CHECKING,    // 일반 입출금
    SALARY_CHECKING,     // 급여
    LIVING_CHECKING,     // 생활비
    EMERGENCY_CHECKING,  // 비상금
    ALLOWANCE_CHECKING,  // 용돈

    // 저축 중분류
    INSTALLMENT_SAVINGS, // 적금
    TIME_DEPOSIT,        // 정기예금
    FREE_SAVINGS,        // 자유저축

    // 투자 중분류
    STOCK_BROKERAGE,     // 증권
    CMA,                 // CMA
    NISA,                // NISA
    PENSION,             // 연금
    OTHER_INVESTMENT,    // 기타 투자

    // 외화 중분류
    FOREIGN_SAVINGS,     // 외화예금
    FOREIGN_LIVING,      // 해외생활비

    // 부채 중분류
    LOAN,                // 대출
    CREDIT_LINE          // 마이너스통장
}
