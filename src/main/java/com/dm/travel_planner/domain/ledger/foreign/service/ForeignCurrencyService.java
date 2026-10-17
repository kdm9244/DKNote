package com.dm.travel_planner.domain.ledger.foreign.service;

import com.dm.travel_planner.domain.ledger.dto.AccountResponse;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.foreign.dto.ForeignCurrencyDetailResponse;
import com.dm.travel_planner.domain.ledger.foreign.dto.ForeignTransactionRequest;
import com.dm.travel_planner.domain.ledger.foreign.entity.ForeignCurrencyTransaction;
import com.dm.travel_planner.domain.ledger.foreign.entity.ForeignTransactionType;
import com.dm.travel_planner.domain.ledger.foreign.repository.ForeignCurrencyTransactionRepository;
import com.dm.travel_planner.domain.ledger.investment.price.ExchangeRateQuote;
import com.dm.travel_planner.domain.ledger.investment.price.MarketPriceProvider;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ForeignCurrencyService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final List<Currency> WALLET_CURRENCIES = List.of(Currency.KRW, Currency.USD, Currency.JPY);

    private final AccountRepository accountRepository;
    private final ForeignCurrencyTransactionRepository transactionRepository;
    private final MarketPriceProvider marketPriceProvider;

    public ForeignCurrencyDetailResponse getDetail(String accountId, String userId) {
        Account account = findAccount(accountId, userId);
        List<ForeignCurrencyTransaction> transactions = findTransactions(accountId, userId);
        List<ForeignCurrencyDetailResponse.RateQuote> rates = loadRates();

        return buildDetail(account, transactions, rates);
    }

    public ForeignCurrencyDetailResponse syncRates(String accountId, String userId) {
        Account account = findAccount(accountId, userId);
        List<ForeignCurrencyDetailResponse.RateQuote> rates = loadRates();
        boolean hasUsd = findRate(rates, Currency.USD) != null;
        boolean hasJpy = findRate(rates, Currency.JPY) != null;
        if (!hasUsd || !hasJpy) {
            throw new IllegalArgumentException(
                    marketPriceProvider.getLastFailureMessage()
                            .map(message -> "KIS 환율을 불러오지 못했습니다. " + message)
                            .orElse("KIS에서 원/달러 또는 원/엔 환율을 불러오지 못했습니다."));
        }
        return buildDetail(account, findTransactions(accountId, userId), rates);
    }

    private ForeignCurrencyDetailResponse buildDetail(
            Account account, List<ForeignCurrencyTransaction> transactions,
            List<ForeignCurrencyDetailResponse.RateQuote> rates) {

        List<ForeignCurrencyDetailResponse.WalletSummary> wallets = new ArrayList<>();
        List<ForeignCurrencyDetailResponse.TransactionItem> allItems = new ArrayList<>();
        Map<Currency, Position> positions = new EnumMap<>(Currency.class);
        for (Currency currency : WALLET_CURRENCIES) {
            Position position = calculatePosition(account, currency, transactions);
            positions.put(currency, position);
            allItems.addAll(position.items);
            wallets.add(toWalletSummary(currency, position, rates));
        }

        Currency defaultCurrency = account.getCurrency() == null ? Currency.KRW : account.getCurrency();
        Position defaultPosition = positions.get(defaultCurrency);
        ForeignCurrencyDetailResponse.WalletSummary defaultWallet = wallets.stream()
                .filter(wallet -> wallet.currency() == defaultCurrency).findFirst().orElseThrow();
        ForeignCurrencyDetailResponse.RateQuote defaultRate = findRate(rates, defaultCurrency);

        LocalDateTime monthStart = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        BigDecimal monthlyDeposits = BigDecimal.ZERO;
        BigDecimal monthlyWithdrawals = BigDecimal.ZERO;
        BigDecimal monthlyRealized = BigDecimal.ZERO;
        for (ForeignCurrencyDetailResponse.TransactionItem item : defaultPosition.items) {
            if (item.transactionDate().isBefore(monthStart)) continue;
            if (item.transactionType() == ForeignTransactionType.DEPOSIT) monthlyDeposits = monthlyDeposits.add(item.amount());
            else monthlyWithdrawals = monthlyWithdrawals.add(item.amount());
            if (item.realizedExchangeProfit() != null) monthlyRealized = monthlyRealized.add(item.realizedExchangeProfit());
        }

        allItems.sort(Comparator.comparing(ForeignCurrencyDetailResponse.TransactionItem::transactionDate).reversed());
        return new ForeignCurrencyDetailResponse(
                AccountResponse.from(account),
                new ForeignCurrencyDetailResponse.Summary(
                        defaultWallet.balance(), defaultWallet.averageAcquisitionRate(),
                        defaultWallet.acquisitionCostKrw(), defaultWallet.currentExchangeRate(),
                        defaultWallet.valuationKrw(), defaultWallet.unrealizedExchangeProfit(),
                        defaultWallet.unrealizedReturnRate(), defaultWallet.costBasisComplete(),
                        defaultRate == null ? null : defaultRate.quotedAt(),
                        defaultRate == null ? null : defaultRate.provider()),
                new ForeignCurrencyDetailResponse.MonthlyFlow(
                        monthlyDeposits, monthlyWithdrawals, money(monthlyRealized)),
                rates, wallets, allItems);
    }

    @Transactional
    public ForeignCurrencyDetailResponse.TransactionItem createTransaction(
            String accountId, String userId, ForeignTransactionRequest request) {
        Account account = findAccount(accountId, userId);
        RateInput rateInput = normalizeRateInput(request);
        ForeignCurrencyTransaction transaction = transactionRepository.save(ForeignCurrencyTransaction.builder()
                .userId(userId)
                .accountId(accountId)
                .transactionDate(request.getTransactionDate())
                .transactionType(request.getTransactionType())
                .purpose(request.getPurpose().trim())
                .title(request.getTitle().trim())
                .amount(request.getAmount())
                .currency(request.getCurrency())
                .exchangeRate(rateInput.exchangeRate())
                .exchangeRateCurrency(rateInput.exchangeRateCurrency())
                .krwExchangeRate(rateInput.krwExchangeRate())
                .feeKrw(zero(request.getFeeKrw()))
                .memo(trimToNull(request.getMemo()))
                .build());
        Map<Currency, Position> positions = recalculateAndUpdateBalance(account, userId);
        return positions.get(request.getCurrency()).items.stream()
                .filter(item -> item.transactionId().equals(transaction.getTransactionId()))
                .findFirst().orElseThrow();
    }

    @Transactional
    public ForeignCurrencyDetailResponse.TransactionItem updateTransaction(
            String accountId, String transactionId, String userId, ForeignTransactionRequest request) {
        Account account = findAccount(accountId, userId);
        RateInput rateInput = normalizeRateInput(request);
        ForeignCurrencyTransaction transaction = transactionRepository
                .findByTransactionIdAndAccountIdAndUserId(transactionId, accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("외화 거래 내역을 찾을 수 없습니다."));
        transaction.update(request.getTransactionType(), request.getPurpose().trim(), request.getTitle().trim(),
                request.getAmount(), request.getCurrency(), rateInput.exchangeRate(),
                rateInput.exchangeRateCurrency(), rateInput.krwExchangeRate(), zero(request.getFeeKrw()),
                request.getTransactionDate(), trimToNull(request.getMemo()));
        Map<Currency, Position> positions = recalculateAndUpdateBalance(account, userId);
        return positions.get(request.getCurrency()).items.stream()
                .filter(item -> item.transactionId().equals(transactionId)).findFirst().orElseThrow();
    }

    @Transactional
    public void deleteTransaction(String accountId, String transactionId, String userId) {
        Account account = findAccount(accountId, userId);
        ForeignCurrencyTransaction transaction = transactionRepository
                .findByTransactionIdAndAccountIdAndUserId(transactionId, accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("외화 거래 내역을 찾을 수 없습니다."));
        transactionRepository.delete(transaction);
        transactionRepository.flush();
        recalculateAndUpdateBalance(account, userId);
    }

    private Map<Currency, Position> recalculateAndUpdateBalance(Account account, String userId) {
        List<ForeignCurrencyTransaction> transactions = findTransactions(account.getAccountId(), userId);
        Map<Currency, Position> positions = new EnumMap<>(Currency.class);
        BigDecimal totalBookCost = BigDecimal.ZERO;
        for (Currency currency : WALLET_CURRENCIES) {
            Position position = calculatePosition(account, currency, transactions);
            positions.put(currency, position);
            totalBookCost = totalBookCost.add(position.costBasis);
        }
        account.updateCachedBalance(money(totalBookCost));
        return positions;
    }

    private Position calculatePosition(
            Account account, Currency walletCurrency, List<ForeignCurrencyTransaction> allTransactions) {
        boolean isInitialWallet = account.getCurrency() == walletCurrency;
        BigDecimal balance = isInitialWallet ? zero(account.getInitialBalance()) : BigDecimal.ZERO;
        boolean isKrw = walletCurrency == Currency.KRW;
        boolean complete = isKrw || balance.signum() == 0 || positive(account.getInitialExchangeRate());
        BigDecimal initialRate = isKrw ? BigDecimal.ONE : zero(account.getInitialExchangeRate());
        BigDecimal costBasis = complete ? balance.multiply(initialRate) : BigDecimal.ZERO;
        List<ForeignCurrencyDetailResponse.TransactionItem> items = new ArrayList<>();

        for (ForeignCurrencyTransaction tx : allTransactions) {
            Currency transactionCurrency = tx.getCurrency() != null ? tx.getCurrency() : account.getCurrency();
            if (transactionCurrency != walletCurrency) continue;

            BigDecimal amount = tx.getAmount();
            BigDecimal fee = zero(tx.getFeeKrw());
            BigDecimal appliedRate = isKrw ? BigDecimal.ONE : effectiveKrwRate(tx);
            BigDecimal krwAmount = appliedRate == null ? null : money(amount.multiply(appliedRate));
            BigDecimal removedCost = null;
            BigDecimal realized = null;

            if (tx.getTransactionType() == ForeignTransactionType.DEPOSIT) {
                if (!isKrw && !positive(appliedRate)) {
                    throw new IllegalArgumentException("달러·엔화 입금에는 취득환율이 필요합니다.");
                }
                balance = balance.add(amount);
                costBasis = isKrw
                        ? balance
                        : costBasis.add(amount.multiply(appliedRate)).add(fee);
            } else {
                if (amount.compareTo(balance) > 0) {
                    throw new IllegalArgumentException(walletCurrency + " 지갑의 해당 시점 잔액보다 출금액이 큽니다: " + tx.getTitle());
                }
                BigDecimal average = balance.signum() == 0 ? BigDecimal.ZERO
                        : costBasis.divide(balance, 8, RoundingMode.HALF_UP);
                removedCost = money(amount.multiply(average));
                balance = balance.subtract(amount);
                costBasis = isKrw ? balance : costBasis.subtract(removedCost);
                if (!isKrw && positive(appliedRate) && complete) {
                    realized = money(amount.multiply(appliedRate).subtract(fee).subtract(removedCost));
                }
            }
            if (balance.signum() == 0) costBasis = BigDecimal.ZERO;
            items.add(new ForeignCurrencyDetailResponse.TransactionItem(
                    tx.getTransactionId(), tx.getTransactionDate(), tx.getTransactionType(), tx.getPurpose(),
                    tx.getTitle(), amount, walletCurrency, tx.getExchangeRate(), exchangeRateCurrency(tx),
                    appliedRate, krwAmount,
                    fee, removedCost, realized, tx.getMemo()));
        }
        return new Position(balance, costBasis, complete, items);
    }

    private ForeignCurrencyDetailResponse.WalletSummary toWalletSummary(
            Currency currency, Position position, List<ForeignCurrencyDetailResponse.RateQuote> rates) {
        ForeignCurrencyDetailResponse.RateQuote quote = findRate(rates, currency);
        BigDecimal currentRate = currency == Currency.KRW ? BigDecimal.ONE : quote == null ? null : quote.rate();
        BigDecimal valuation = currentRate == null ? null : money(position.balance.multiply(currentRate));
        BigDecimal unrealized = currency == Currency.KRW ? BigDecimal.ZERO
                : valuation == null || !position.costBasisComplete ? null
                : money(valuation.subtract(position.costBasis));
        BigDecimal returnRate = unrealized == null || position.costBasis.signum() == 0 ? null
                : unrealized.multiply(HUNDRED).divide(position.costBasis, 4, RoundingMode.HALF_UP);
        return new ForeignCurrencyDetailResponse.WalletSummary(
                currency, position.balance, position.averageRate(), money(position.costBasis), currentRate,
                valuation, unrealized, returnRate, position.costBasisComplete);
    }

    private ForeignCurrencyDetailResponse.RateQuote findRate(
            List<ForeignCurrencyDetailResponse.RateQuote> rates, Currency currency) {
        if (currency == Currency.KRW) return null;
        return rates.stream().filter(rate -> rate.baseCurrency() == currency && rate.quoteCurrency() == Currency.KRW)
                .findFirst().orElse(null);
    }

    private List<ForeignCurrencyDetailResponse.RateQuote> loadRates() {
        List<ForeignCurrencyDetailResponse.RateQuote> result = new ArrayList<>();
        addRate(result, Currency.USD, Currency.KRW);
        addRate(result, Currency.JPY, Currency.KRW);
        ForeignCurrencyDetailResponse.RateQuote usdKrw = findRate(result, Currency.USD);
        ForeignCurrencyDetailResponse.RateQuote jpyKrw = findRate(result, Currency.JPY);
        if (usdKrw != null && jpyKrw != null && positive(jpyKrw.rate())) {
            BigDecimal rate = usdKrw.rate().divide(jpyKrw.rate(), 8, RoundingMode.HALF_UP);
            BigDecimal previous = positive(usdKrw.previousClose()) && positive(jpyKrw.previousClose())
                    ? usdKrw.previousClose().divide(jpyKrw.previousClose(), 8, RoundingMode.HALF_UP) : null;
            BigDecimal change = previous == null ? null : rate.subtract(previous);
            BigDecimal changePercent = previous == null || previous.signum() == 0 ? null
                    : change.multiply(HUNDRED).divide(previous, 4, RoundingMode.HALF_UP);
            LocalDateTime quotedAt = usdKrw.quotedAt().isAfter(jpyKrw.quotedAt())
                    ? usdKrw.quotedAt() : jpyKrw.quotedAt();
            result.add(new ForeignCurrencyDetailResponse.RateQuote(
                    Currency.USD, Currency.JPY, rate, previous, change, changePercent,
                    quotedAt, "KIS 교차환율"));
        }
        return result;
    }

    private void addRate(List<ForeignCurrencyDetailResponse.RateQuote> target, Currency base, Currency quote) {
        marketPriceProvider.getExchangeRateQuote(base, quote).ifPresent(rate -> target.add(
                new ForeignCurrencyDetailResponse.RateQuote(rate.baseCurrency(), rate.quoteCurrency(), rate.rate(),
                        rate.previousClose(), rate.change(), rate.changePercent(), rate.quotedAt(), rate.provider())));
    }

    private RateInput normalizeRateInput(ForeignTransactionRequest request) {
        if (request.getCurrency() == Currency.KRW) {
            return new RateInput(BigDecimal.ONE, Currency.KRW, BigDecimal.ONE);
        }

        Currency quoteCurrency = request.getExchangeRateCurrency() == null
                ? Currency.KRW : request.getExchangeRateCurrency();
        if (quoteCurrency == request.getCurrency()) {
            throw new IllegalArgumentException("취득환율의 기준 통화는 거래 통화와 다르게 선택해 주세요.");
        }
        if (request.getTransactionType() == ForeignTransactionType.DEPOSIT
                && !positive(request.getExchangeRate())) {
            throw new IllegalArgumentException("달러·엔화 입금은 정확한 환차익 계산을 위해 취득환율을 입력해 주세요.");
        }
        if (!positive(request.getExchangeRate())) {
            return new RateInput(null, quoteCurrency, null);
        }

        BigDecimal krwRate = request.getKrwExchangeRate();
        if (!positive(krwRate)) {
            if (quoteCurrency == Currency.KRW) {
                krwRate = request.getExchangeRate();
            } else {
                BigDecimal quoteToKrw = marketPriceProvider.getExchangeRate(quoteCurrency, Currency.KRW)
                        .orElseThrow(() -> new IllegalArgumentException(
                                quoteCurrency + "의 원화 환산환율을 불러오지 못했습니다. 주요 환율을 동기화한 뒤 다시 시도해 주세요."));
                krwRate = request.getExchangeRate().multiply(quoteToKrw);
            }
        }
        return new RateInput(request.getExchangeRate(), quoteCurrency,
                krwRate.setScale(8, RoundingMode.HALF_UP));
    }

    private Currency exchangeRateCurrency(ForeignCurrencyTransaction transaction) {
        return transaction.getExchangeRateCurrency() == null ? Currency.KRW : transaction.getExchangeRateCurrency();
    }

    private BigDecimal effectiveKrwRate(ForeignCurrencyTransaction transaction) {
        if (positive(transaction.getKrwExchangeRate())) return transaction.getKrwExchangeRate();
        return exchangeRateCurrency(transaction) == Currency.KRW ? transaction.getExchangeRate() : null;
    }

    private Account findAccount(String accountId, String userId) {
        Account account = accountRepository.findByAccountIdAndUserId(accountId, userId)
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다."));
        if (account.getAccountType() != AccountType.FOREIGN_CURRENCY) {
            throw new IllegalArgumentException("외화 통장만 사용할 수 있는 기능입니다.");
        }
        return account;
    }

    private List<ForeignCurrencyTransaction> findTransactions(String accountId, String userId) {
        return transactionRepository.findByAccountIdAndUserIdOrderByTransactionDateAsc(accountId, userId);
    }

    private BigDecimal zero(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private boolean positive(BigDecimal value) { return value != null && value.signum() > 0; }
    private BigDecimal money(BigDecimal value) { return value == null ? null : value.setScale(2, RoundingMode.HALF_UP); }
    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private record Position(BigDecimal balance, BigDecimal costBasis, boolean costBasisComplete,
                            List<ForeignCurrencyDetailResponse.TransactionItem> items) {
        BigDecimal averageRate() {
            return balance.signum() == 0 ? BigDecimal.ZERO
                    : costBasis.divide(balance, 8, RoundingMode.HALF_UP);
        }
    }

    private record RateInput(BigDecimal exchangeRate, Currency exchangeRateCurrency, BigDecimal krwExchangeRate) {}
}
