package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investments", indexes = {
        @Index(name = "idx_investments_account_active", columnList = "account_id,is_active"),
        @Index(name = "idx_investments_account_asset", columnList = "account_id,asset_class")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_investments_user_acc_ticker", columnNames = {"user_id", "account_id", "ticker_code"})
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Investment {

    @Id
    @Column(name = "investment_id", length = 50)
    private String investmentId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investments_user"))
    private User user;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investments_account"))
    private Account account;

    @Column(name = "ticker_code", nullable = false, length = 20)
    private String tickerCode;

    @Column(name = "symbol_name", nullable = false, length = 100)
    private String symbolName;

    @Enumerated(EnumType.STRING)
    @Column(name = "asset_class", nullable = false, length = 30)
    private InvestmentAssetClass assetClass;

    @Column(name = "market", length = 30)
    private String market;

    @Enumerated(EnumType.STRING)
    @Column(name = "currency", nullable = false, length = 3)
    @Builder.Default
    private Currency currency = Currency.KRW;

    @Column(name = "target_quantity", precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal targetQuantity = BigDecimal.ZERO;

    @Column(name = "cached_quantity", nullable = false, precision = 18, scale = 6)
    @Builder.Default
    private BigDecimal cachedQuantity = BigDecimal.ZERO;

    /** 종목 표시 통화 기준 평균 매입 단가 */
    @Column(name = "cached_avg_buy_price", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal cachedAvgBuyPrice = BigDecimal.ZERO;

    /** 계좌 기준 통화 기준 평균 매입 단가 */
    @Column(name = "cached_avg_buy_price_base", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal cachedAvgBuyPriceBase = BigDecimal.ZERO;

    @Column(name = "cached_current_price", nullable = false, precision = 18, scale = 4)
    @Builder.Default
    private BigDecimal cachedCurrentPrice = BigDecimal.ZERO;

    @Column(name = "cached_exchange_rate", nullable = false, precision = 20, scale = 8)
    @Builder.Default
    private BigDecimal cachedExchangeRate = BigDecimal.ONE;

    /** 계좌 기준 통화로 환산한 평가금액 */
    @Column(name = "cached_market_value", nullable = false, precision = 18, scale = 2)
    @Builder.Default
    private BigDecimal cachedMarketValue = BigDecimal.ZERO;

    @Column(name = "price_updated_at")
    private LocalDateTime priceUpdatedAt;

    @Column(name = "position_updated_at", nullable = false)
    private LocalDateTime positionUpdatedAt;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (investmentId == null) investmentId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        if (positionUpdatedAt == null) positionUpdatedAt = now;
        if (createdAt == null) createdAt = now;
        updatedAt = now;
        normalizeNulls();
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
        normalizeNulls();
    }

    private void normalizeNulls() {
        if (targetQuantity == null) targetQuantity = BigDecimal.ZERO;
        if (cachedQuantity == null) cachedQuantity = BigDecimal.ZERO;
        if (cachedAvgBuyPrice == null) cachedAvgBuyPrice = BigDecimal.ZERO;
        if (cachedAvgBuyPriceBase == null) cachedAvgBuyPriceBase = BigDecimal.ZERO;
        if (cachedCurrentPrice == null) cachedCurrentPrice = BigDecimal.ZERO;
        if (cachedExchangeRate == null) cachedExchangeRate = BigDecimal.ONE;
        if (cachedMarketValue == null) cachedMarketValue = BigDecimal.ZERO;
    }

    public void applyBuy(BigDecimal quantity, BigDecimal unitPrice, BigDecimal exchangeRate,
                         BigDecimal feeAmount, BigDecimal taxAmount) {
        BigDecimal oldQuantity = cachedQuantity;
        BigDecimal newQuantity = oldQuantity.add(quantity);
        BigDecimal oldCost = oldQuantity.multiply(cachedAvgBuyPrice);
        BigDecimal newCost = quantity.multiply(unitPrice).add(feeAmount).add(taxAmount);
        cachedAvgBuyPrice = oldCost.add(newCost).divide(newQuantity, 4, RoundingMode.HALF_UP);

        BigDecimal oldBaseCost = oldQuantity.multiply(cachedAvgBuyPriceBase);
        BigDecimal newBaseCost = newCost.multiply(exchangeRate);
        cachedAvgBuyPriceBase = oldBaseCost.add(newBaseCost).divide(newQuantity, 4, RoundingMode.HALF_UP);
        cachedQuantity = newQuantity;
        cachedExchangeRate = exchangeRate;
        positionUpdatedAt = LocalDateTime.now();
        recalculateMarketValue();
    }

    public BigDecimal applySell(BigDecimal quantity, BigDecimal grossAmount,
                                BigDecimal feeAmount, BigDecimal taxAmount, BigDecimal exchangeRate) {
        if (cachedQuantity.compareTo(quantity) < 0) {
            throw new IllegalArgumentException("보유 수량보다 많은 수량을 매도할 수 없습니다.");
        }
        BigDecimal costBasis = cachedAvgBuyPriceBase.multiply(quantity);
        BigDecimal proceeds = grossAmount.subtract(feeAmount).subtract(taxAmount).multiply(exchangeRate);
        cachedQuantity = cachedQuantity.subtract(quantity);
        cachedExchangeRate = exchangeRate;
        if (cachedQuantity.signum() == 0) {
            cachedAvgBuyPrice = BigDecimal.ZERO;
            cachedAvgBuyPriceBase = BigDecimal.ZERO;
        }
        positionUpdatedAt = LocalDateTime.now();
        recalculateMarketValue();
        return proceeds.subtract(costBasis);
    }

    public void updatePrice(BigDecimal currentPrice, BigDecimal exchangeRate, LocalDateTime quotedAt) {
        cachedCurrentPrice = currentPrice;
        cachedExchangeRate = exchangeRate;
        priceUpdatedAt = quotedAt != null ? quotedAt : LocalDateTime.now();
        recalculateMarketValue();
    }

    private void recalculateMarketValue() {
        cachedMarketValue = cachedQuantity
                .multiply(cachedCurrentPrice)
                .multiply(cachedExchangeRate)
                .setScale(2, RoundingMode.HALF_UP);
    }
}
