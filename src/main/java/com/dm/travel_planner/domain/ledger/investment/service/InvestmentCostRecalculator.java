package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.investment.entity.*;
import java.math.BigDecimal;
import java.util.*;

/** Reuses the application's moving-average calculation, in original recording order. */
public final class InvestmentCostRecalculator {
    private InvestmentCostRecalculator() {}
    public record Position(BigDecimal quantity,BigDecimal localAverage,BigDecimal baseAverage,Map<String,BigDecimal> realized) {}
    public static Position replay(List<InvestmentTransaction> history) {
        Investment position=Investment.builder().build();
        Map<String,BigDecimal> realized=new LinkedHashMap<>();
        for(var tx:history) {
            switch(tx.getTradeType()) {
                case BUY -> position.applyBuy(tx.getQuantity(),tx.getUnitPrice(),tx.getExchangeRate(),tx.getFeeAmount(),tx.getTaxAmount());
                case SELL -> realized.put(tx.getInvestmentTransactionId(),position.applySell(tx.getQuantity(),tx.getQuantity().multiply(tx.getUnitPrice()),tx.getFeeAmount(),tx.getTaxAmount(),tx.getExchangeRate()));
                default -> {}
            }
        }
        return new Position(position.getCachedQuantity(),position.getCachedAvgBuyPrice(),position.getCachedAvgBuyPriceBase(),realized);
    }
}
