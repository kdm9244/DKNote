package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.AccountPurpose;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AccountUpdateRequest {

    @NotBlank(message = "계좌명은 필수 입력 항목입니다.")
    private String accountName;

    private String bankName;

    @NotNull(message = "계좌 종류는 필수 선택 항목입니다.")
    private AccountType accountType;

    @NotNull(message = "계좌 용도는 필수 선택 항목입니다.")
    private AccountPurpose accountPurpose;

    private Currency currency;
    private BigDecimal minimumBalance;
    private BigDecimal targetBalance;
    private String accountNumberMasked;
    private Integer displayOrder;

    // 저축 계좌 전용 필드
    private BigDecimal interestRate;
    private LocalDate maturityDate;
    private String interestType;
    private BigDecimal monthlyPayment;
    private BigDecimal initialExchangeRate;
}
