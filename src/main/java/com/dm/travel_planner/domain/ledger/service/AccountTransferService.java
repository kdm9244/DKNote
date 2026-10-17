package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.AccountTransferRequest;
import com.dm.travel_planner.domain.ledger.dto.AccountTransferResponse;
import com.dm.travel_planner.domain.ledger.dto.TransactionResponse;
import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.AccountTransferRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentAssetClass;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTradeType;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTransaction;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentRepository;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AccountTransferService {
    private static final String CASH_TICKER = "CASH";
    private final AccountRepository accountRepository;
    private final AccountTransferRepository accountTransferRepository;
    private final TransactionRepository transactionRepository;
    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository investmentTransactionRepository;

    @Transactional
    public AccountTransferResponse createTransfer(String userId, AccountTransferRequest request) {
        TransferExecution result = executeTransfer(userId, request);
        return AccountTransferResponse.from(
                result.transfer(), result.sourceAccount().getAccountName(),
                result.destinationAccount().getAccountName(),
                TransactionResponse.from(result.sourceTransaction()),
                TransactionResponse.from(result.destinationTransaction()));
    }

    @Transactional
    public TransferExecution executeTransfer(String userId, AccountTransferRequest request) {
        if (request.sourceAccountId().equals(request.destinationAccountId())) {
            throw new IllegalArgumentException("출금 계좌와 입금 계좌는 달라야 합니다.");
        }

        Account first;
        Account second;
        if (request.sourceAccountId().compareTo(request.destinationAccountId()) < 0) {
            first = lockAccount(request.sourceAccountId(), userId);
            second = lockAccount(request.destinationAccountId(), userId);
        } else {
            first = lockAccount(request.destinationAccountId(), userId);
            second = lockAccount(request.sourceAccountId(), userId);
        }
        Account source = first.getAccountId().equals(request.sourceAccountId()) ? first : second;
        Account destination = first.getAccountId().equals(request.destinationAccountId()) ? first : second;

        validateAccount(source, "출금");
        validateAccount(destination, "입금");
        boolean sourceIsDebt = source.getAccountType() == AccountType.DEBT;
        boolean destinationIsDebt = destination.getAccountType() == AccountType.DEBT;
        if (sourceIsDebt && source.getAccountPurpose() != AccountPurpose.CREDIT_LINE) {
            throw new IllegalArgumentException("일반 대출 계좌에서는 출금할 수 없습니다. 대출 상환은 입금 계좌로 선택해 주세요.");
        }
        if (sourceIsDebt && destinationIsDebt) {
            throw new IllegalArgumentException("부채 계좌끼리의 대환은 일반 이체가 아닌 별도 대환 기록으로 처리해 주세요.");
        }

        BigDecimal amount = request.amount();
        BigDecimal destAmount = request.destinationAmount() != null && request.destinationAmount().signum() > 0
                ? request.destinationAmount()
                : amount;
        BigDecimal exchangeRate = request.exchangeRate() != null && request.exchangeRate().signum() > 0
                ? request.exchangeRate()
                : BigDecimal.ONE;

        if (source.getCurrency() != destination.getCurrency() && request.destinationAmount() == null) {
            throw new IllegalArgumentException("통화가 다른 계좌 간 이체는 환산된 입금 금액(destinationAmount)이 필요합니다.");
        }

        BigDecimal fee = request.feeAmount() == null ? BigDecimal.ZERO : request.feeAmount();
        BigDecimal totalDebit = amount.add(fee);
        if (!sourceIsDebt && source.getAccountPurpose() != AccountPurpose.CREDIT_LINE
                && value(source.getCachedBookBalance()).compareTo(totalDebit) < 0) {
            throw new IllegalArgumentException("출금 계좌 잔액이 부족합니다. 수수료를 포함한 필요 금액: " + totalDebit);
        }
        if (destinationIsDebt) {
            BigDecimal outstandingDebt = value(destination.getCachedBookBalance()).abs();
            if (outstandingDebt.signum() == 0) {
                throw new IllegalArgumentException("이미 상환이 완료된 부채 계좌입니다.");
            }
            if (destAmount.compareTo(outstandingDebt) > 0) {
                throw new IllegalArgumentException("상환 금액은 현재 남은 부채보다 클 수 없습니다. 남은 부채: " + outstandingDebt);
            }
        }

        LocalDateTime transferredAt = request.transferredAt() == null
                ? LocalDateTime.now() : request.transferredAt();
        String memo = request.memo() == null ? "" : request.memo().trim();
        AccountTransfer transfer = accountTransferRepository.save(AccountTransfer.builder()
                .userId(userId)
                .sourceAccountId(source.getAccountId())
                .destinationAccountId(destination.getAccountId())
                .sourceAmount(amount)
                .destinationAmount(destAmount)
                .sourceCurrency(source.getCurrency())
                .destinationCurrency(destination.getCurrency())
                .exchangeRate(exchangeRate)
                .feeAmount(fee)
                .transferredAt(transferredAt)
                .memo(memo.isBlank() ? null : memo)
                .build());

        source.applyQuickTransaction(totalDebit, false);
        destination.applyQuickTransaction(destAmount, true);
        String title = destinationIsDebt
                ? destination.getAccountName() + " 대출 상환"
                : sourceIsDebt ? source.getAccountName() + " 한도 사용"
                : source.getAccountName() + " → " + destination.getAccountName();
        Transaction sourceTransaction = transactionRepository.save(transferTransaction(
                userId, source, transfer, title, amount, transferredAt, memo, TransferDirection.OUT));
        Transaction destinationTransaction = transactionRepository.save(transferTransaction(
                userId, destination, transfer, title, destAmount, transferredAt, memo, TransferDirection.IN));

        recordInvestmentCashMovement(source, destination, userId, sourceTransaction,
                InvestmentTradeType.WITHDRAWAL, amount, transferredAt, memo);
        recordInvestmentCashMovement(destination, source, userId, destinationTransaction,
                InvestmentTradeType.DEPOSIT, destAmount, transferredAt, memo);

        if (fee.signum() > 0) {
            transactionRepository.save(Transaction.builder()
                    .userId(userId)
                    .accountId(source.getAccountId())
                    .transactionDate(transferredAt)
                    .transactionType(TransactionType.EXPENSE)
                    .title("계좌이체 수수료")
                    .amount(fee)
                    .currency(source.getCurrency())
                    .memo("[이체 수수료] " + title)
                    .transferId(transfer.getTransferId())
                    .build());
        }
        return new TransferExecution(transfer, source, destination, sourceTransaction, destinationTransaction);
    }

    public List<AccountTransferResponse> getTransfers(String userId) {
        return accountTransferRepository.findByUserIdOrderByTransferredAtDesc(userId).stream()
                .map(item -> AccountTransferResponse.from(
                        item,
                        accountRepository.findById(item.getSourceAccountId()).map(Account::getAccountName).orElse("삭제된 계좌"),
                        accountRepository.findById(item.getDestinationAccountId()).map(Account::getAccountName).orElse("삭제된 계좌"),
                        null, null))
                .toList();
    }

    private Transaction transferTransaction(
            String userId, Account account, AccountTransfer transfer, String title,
            BigDecimal amount, LocalDateTime transferredAt, String memo, TransferDirection direction) {
        String directionLabel = direction == TransferDirection.OUT ? "이체 출금" : "이체 입금";
        return Transaction.builder()
                .userId(userId)
                .accountId(account.getAccountId())
                .transactionDate(transferredAt)
                .transactionType(TransactionType.TRANSFER)
                .title(title)
                .amount(amount)
                .currency(account.getCurrency())
                .memo("[계좌이체] " + directionLabel + (memo.isBlank() ? "" : " · " + memo))
                .transferId(transfer.getTransferId())
                .transferDirection(direction)
                .build();
    }

    private Account lockAccount(String accountId, String userId) {
        return accountRepository.findForUpdateByAccountIdAndUserId(accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("이체 계좌를 찾을 수 없습니다."));
    }

    private void recordInvestmentCashMovement(
            Account investmentAccount, Account counterAccount, String userId, Transaction ledgerTransaction,
            InvestmentTradeType tradeType, BigDecimal amount, LocalDateTime transferredAt, String memo) {
        if (investmentAccount.getAccountType() != AccountType.INVESTMENT) return;
        Investment cashHolding = investmentRepository
                .findByAccountIdAndUserIdAndTickerCode(investmentAccount.getAccountId(), userId, CASH_TICKER)
                .orElseGet(() -> investmentRepository.save(Investment.builder()
                        .userId(userId)
                        .accountId(investmentAccount.getAccountId())
                        .tickerCode(CASH_TICKER)
                        .symbolName("예수금")
                        .assetClass(InvestmentAssetClass.CASH)
                        .market(CASH_TICKER)
                        .currency(investmentAccount.getCurrency())
                        .build()));
        String movementMemo = "계좌 이체 · " + counterAccount.getAccountName()
                + (memo == null || memo.isBlank() ? "" : " · " + memo.trim());
        investmentTransactionRepository.save(InvestmentTransaction.builder()
                .investmentId(cashHolding.getInvestmentId())
                .transactionId(ledgerTransaction.getTransactionId())
                .tradeType(tradeType)
                .tradeDate(transferredAt)
                .grossAmount(amount)
                .netAmount(tradeType == InvestmentTradeType.DEPOSIT ? amount : amount.negate())
                .currency(investmentAccount.getCurrency())
                .exchangeRate(BigDecimal.ONE)
                .memo(movementMemo)
                .build());
    }

    private void validateAccount(Account account, String role) {
        if (!Boolean.TRUE.equals(account.getIsActive())) {
            throw new IllegalArgumentException(role + " 계좌가 비활성화되어 있습니다.");
        }
        if (account.getAccountType() == AccountType.FOREIGN_CURRENCY) {
            throw new IllegalArgumentException("외화 통장 이체는 보유 통화를 지정하는 외화 입출금 기능을 이용해 주세요.");
        }
    }

    private BigDecimal value(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }

    public record TransferExecution(
            AccountTransfer transfer,
            Account sourceAccount,
            Account destinationAccount,
            Transaction sourceTransaction,
            Transaction destinationTransaction
    ) {
        public Transaction transactionFor(String accountId) {
            return sourceAccount.getAccountId().equals(accountId) ? sourceTransaction : destinationTransaction;
        }
    }
}
