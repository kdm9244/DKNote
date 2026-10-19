package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTransaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvestmentTransactionResponse(
        String investmentTransactionId,
        String investmentId,
        InvestmentTradeType tradeType,
        LocalDateTime tradeDate,
        BigDecimal quantity,
        BigDecimal unitPrice,
        BigDecimal grossAmount,
        BigDecimal feeAmount,
        BigDecimal taxAmount,
        BigDecimal netAmount,
        BigDecimal realizedProfitLoss,
        Currency currency,
        BigDecimal exchangeRate,
        String memo,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxKind taxKind,
        Long version,
        String taxResidence, String taxAccountCountry,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxAccountType taxAccountType,
        com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxTreatment taxTreatment
) {
    public static InvestmentTransactionResponse from(InvestmentTransaction tx) {
        return new InvestmentTransactionResponse(
                tx.getInvestmentTransactionId(), tx.getInvestmentId(), tx.getTradeType(), tx.getTradeDate(),
                tx.getQuantity(), tx.getUnitPrice(), tx.getGrossAmount(), tx.getFeeAmount(), tx.getTaxAmount(),
                tx.getNetAmount(), tx.getRealizedProfitLoss(), tx.getCurrency(), tx.getExchangeRate(), tx.getMemo(),tx.getTaxKind(),tx.getVersion(),tx.getTaxResidence(),tx.getTaxAccountCountry(),tx.getTaxAccountType(),tx.getTaxTreatment());
    }
}
