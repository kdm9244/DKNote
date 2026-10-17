package com.dm.travel_planner.domain.ledger.investment.dto;

import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTransaction;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvestmentActivityResponse(
        String investmentTransactionId,
        String ledgerTransactionId,
        String accountId,
        String accountName,
        Currency accountCurrency,
        String investmentId,
        String tickerCode,
        String symbolName,
        InvestmentTradeType tradeType,
        LocalDateTime tradeDate,
        BigDecimal quantity,
        BigDecimal unitPrice,
        Currency quoteCurrency,
        BigDecimal netAmount,
        BigDecimal feeAmount,
        BigDecimal taxAmount,
        BigDecimal realizedProfitLoss,
        String memo
) {
    public static InvestmentActivityResponse from(
            InvestmentTransaction transaction, Investment investment,
            String accountName, Currency accountCurrency) {
        return new InvestmentActivityResponse(
                transaction.getInvestmentTransactionId(), transaction.getTransactionId(),
                investment.getAccountId(), accountName, accountCurrency,
                investment.getInvestmentId(), investment.getTickerCode(), investment.getSymbolName(),
                transaction.getTradeType(), transaction.getTradeDate(), transaction.getQuantity(),
                transaction.getUnitPrice(), transaction.getCurrency(), transaction.getNetAmount(),
                transaction.getFeeAmount(), transaction.getTaxAmount(), transaction.getRealizedProfitLoss(),
                transaction.getMemo());
    }
}
