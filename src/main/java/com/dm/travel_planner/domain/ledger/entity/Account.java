package com.dm.travel_planner.domain.ledger.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "accounts")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @Column(name = "account_id", length = 50)
    private String accountId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "account_name", nullable = false, length = 100)
    private String accountName;

    @Column(name = "bank_name", length = 50)
    private String bankName;
    @Column(length=10) private String brokerageCountry;
    @Enumerated(EnumType.STRING) @Column(length=30) private com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType brokerageTaxType;
    public void configureBrokerage(String country,com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType type){
        if(country==null&&type==null)return;
        if(accountType!=AccountType.INVESTMENT||!java.util.Set.of("KR","JP").contains(country==null?"":country)||type==null||type==com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType.UNSET||("KR".equals(country)&&type!=com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType.GENERAL))throw new IllegalArgumentException("증권계좌 국가와 유형을 확인하세요.");
        brokerageCountry=country;brokerageTaxType=type;
        if(type==com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType.NISA)accountPurpose=AccountPurpose.NISA;else if(accountPurpose==AccountPurpose.NISA)accountPurpose=AccountPurpose.STOCK_BROKERAGE;
    }

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 30)
    private AccountType accountType;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_purpose", nullable = false, length = 30)
    private AccountPurpose accountPurpose;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private Currency currency = Currency.KRW;

    @Column(name = "initial_balance", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal initialBalance = BigDecimal.ZERO;

    @Column(name = "initial_balance_date", nullable = false)
    @Builder.Default
    private LocalDate initialBalanceDate = LocalDate.now();

    @Column(name = "initial_exchange_rate", precision = 18, scale = 8)
    private BigDecimal initialExchangeRate;

    @Column(name = "cached_book_balance", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal cachedBookBalance = BigDecimal.ZERO;

    @Column(name = "last_actual_balance", precision = 18, scale = 2)
    private BigDecimal lastActualBalance;

    @Column(name = "last_reconciled_at")
    private LocalDateTime lastReconciledAt;

    @Column(name = "minimum_balance", precision = 18, scale = 2)
    private BigDecimal minimumBalance;

    @Column(name = "target_balance", precision = 18, scale = 2)
    private BigDecimal targetBalance;

    /** 연 금리 (%) - 저축/예금 계좌 전용. 예: 3.5 = 연 3.5% */
    @Column(name = "interest_rate", precision = 6, scale = 4)
    private BigDecimal interestRate;

    /** 만기일 - 적금/정기예금 계좌 전용 */
    @Column(name = "maturity_date")
    private LocalDate maturityDate;

    /** 이자 유형: SIMPLE(단리) / COMPOUND(복리) */
    @Column(name = "interest_type", length = 20)
    @Builder.Default
    private String interestType = "SIMPLE";

    /** 월 납입액 (적금 계좌 전용) */
    @Column(name = "monthly_payment", precision = 18, scale = 2)
    private BigDecimal monthlyPayment;

    @Column(name = "account_number_masked", length = 50)
    private String accountNumberMasked;

    @Column(name = "display_order", nullable = false)
    @Builder.Default
    private Integer displayOrder = 1;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "balance_updated_at", nullable = false)
    private LocalDateTime balanceUpdatedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (this.accountId == null) {
            this.accountId = UUID.randomUUID().toString().replace("-", "");
        }
        if (this.balanceUpdatedAt == null) {
            this.balanceUpdatedAt = LocalDateTime.now();
        }
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // --- 비즈니스 메소드 ---

    public void updateCachedBalance(BigDecimal newBalance) {
        this.cachedBookBalance = newBalance;
        this.balanceUpdatedAt = LocalDateTime.now();
    }

    public void reconcileBalance(BigDecimal actualBalance) {
        this.lastActualBalance = actualBalance;
        this.lastReconciledAt = LocalDateTime.now();
    }

    public void adjustBookBalanceToActual() {
        if (this.lastActualBalance != null) {
            this.cachedBookBalance = this.lastActualBalance;
            this.balanceUpdatedAt = LocalDateTime.now();
            this.lastReconciledAt = LocalDateTime.now();
        }
    }

    public void applyQuickTransaction(BigDecimal amount, boolean isIncome) {
        if (amount == null) return;
        BigDecimal change = isIncome ? amount : amount.negate();
        this.cachedBookBalance = (this.cachedBookBalance != null ? this.cachedBookBalance : BigDecimal.ZERO).add(change);
        this.balanceUpdatedAt = LocalDateTime.now();
    }

    public void updateTargetBalance(BigDecimal targetBalance) {
        this.targetBalance = targetBalance;
    }

    public void updateInfo(String accountName, String bankName, AccountType accountType,
                           AccountPurpose accountPurpose, Currency currency,
                           BigDecimal minimumBalance, BigDecimal targetBalance,
                           String accountNumberMasked, Integer displayOrder,
                           BigDecimal interestRate, LocalDate maturityDate, String interestType, BigDecimal monthlyPayment,
                           BigDecimal initialExchangeRate) {
        if (accountName != null && !accountName.isBlank()) {
            this.accountName = accountName;
        }
        if (bankName != null) {
            this.bankName = bankName;
        }
        if (accountType != null) {
            this.accountType = accountType;
        }
        if (accountPurpose != null) {
            this.accountPurpose = accountPurpose;
        }
        if (currency != null) {
            this.currency = currency;
        }
        this.minimumBalance = minimumBalance;
        this.targetBalance = targetBalance;
        this.accountNumberMasked = accountNumberMasked;
        if (displayOrder != null) {
            this.displayOrder = displayOrder;
        }
        // 저축 계좌 전용 필드
        this.interestRate = interestRate;
        this.maturityDate = maturityDate;
        if (interestType != null && !interestType.isBlank()) {
            this.interestType = interestType;
        }
        this.monthlyPayment = monthlyPayment;
        this.initialExchangeRate = initialExchangeRate;
    }

    public void deactivate() {
        this.isActive = false;
    }

    public void activate() {
        this.isActive = true;
    }
}
