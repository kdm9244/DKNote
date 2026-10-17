package com.dm.travel_planner.domain.ledger.investment.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_fee_settings", uniqueConstraints = {
        @UniqueConstraint(name = "uk_investment_fee_account_market", columnNames = {"account_id", "market_group"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentFeeSetting {
    @Id
    @Column(name = "fee_setting_id", length = 50)
    private String feeSettingId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "market_group", nullable = false, length = 10)
    private InvestmentMarketGroup marketGroup;

    @Column(name = "buy_fee_rate", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal buyFeeRate = BigDecimal.ZERO;

    @Column(name = "sell_fee_rate", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal sellFeeRate = BigDecimal.ZERO;

    @Column(name = "sell_tax_rate", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal sellTaxRate = BigDecimal.ZERO;

    @Column(name = "dividend_tax_rate", nullable = false, precision = 10, scale = 6)
    @Builder.Default
    private BigDecimal dividendTaxRate = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public void updateRates(BigDecimal buyFeeRate, BigDecimal sellFeeRate,
                            BigDecimal sellTaxRate, BigDecimal dividendTaxRate) {
        this.buyFeeRate = zero(buyFeeRate);
        this.sellFeeRate = zero(sellFeeRate);
        this.sellTaxRate = zero(sellTaxRate);
        this.dividendTaxRate = zero(dividendTaxRate);
    }

    @PrePersist
    void prePersist() {
        if (feeSettingId == null) feeSettingId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        updateRates(buyFeeRate, sellFeeRate, sellTaxRate, dividendTaxRate);
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        updateRates(buyFeeRate, sellFeeRate, sellTaxRate, dividendTaxRate);
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
