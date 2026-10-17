package com.dm.travel_planner.domain.ledger.dto;

import com.dm.travel_planner.domain.ledger.entity.AccountTransfer;
import com.dm.travel_planner.domain.ledger.entity.Currency;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AccountTransferResponse(
        String transferId,
        String sourceAccountId,
        String sourceAccountName,
        String destinationAccountId,
        String destinationAccountName,
        BigDecimal sourceAmount,
        BigDecimal destinationAmount,
        Currency sourceCurrency,
        Currency destinationCurrency,
        BigDecimal exchangeRate,
        BigDecimal feeAmount,
        LocalDateTime transferredAt,
        String memo,
        String status,
        TransactionResponse sourceTransaction,
        TransactionResponse destinationTransaction
) {
    public static AccountTransferResponse from(
            AccountTransfer transfer, String sourceName, String destinationName,
            TransactionResponse sourceTransaction, TransactionResponse destinationTransaction) {
        return new AccountTransferResponse(
                transfer.getTransferId(), transfer.getSourceAccountId(), sourceName,
                transfer.getDestinationAccountId(), destinationName,
                transfer.getSourceAmount(), transfer.getDestinationAmount(),
                transfer.getSourceCurrency(), transfer.getDestinationCurrency(),
                transfer.getExchangeRate(), transfer.getFeeAmount(), transfer.getTransferredAt(),
                transfer.getMemo(), transfer.getStatus(), sourceTransaction, destinationTransaction);
    }
}
