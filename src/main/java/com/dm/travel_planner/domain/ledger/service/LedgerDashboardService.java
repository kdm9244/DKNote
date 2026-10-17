package com.dm.travel_planner.domain.ledger.service;

import com.dm.travel_planner.domain.ledger.dto.LedgerDashboardResponse;
import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentRepository;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentTransactionRepository;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LedgerDashboardService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository investmentTransactionRepository;

    public LedgerDashboardResponse getDashboard(String userId, YearMonth month) {
        YearMonth targetMonth = month == null ? YearMonth.now() : month;
        LocalDateTime from = targetMonth.atDay(1).atStartOfDay();
        LocalDateTime to = targetMonth.plusMonths(1).atDay(1).atStartOfDay();
        List<Account> accounts = accountRepository.findByUserIdAndIsActiveTrueOrderByDisplayOrderAsc(userId);
        Map<String, Account> accountMap = accounts.stream()
                .collect(Collectors.toMap(Account::getAccountId, Function.identity()));
        List<Transaction> monthTransactions = transactionRepository
                .findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(
                        userId, from, to);
        List<Transaction> cashFlowTransactions = monthTransactions.stream()
                .filter(transaction -> {
                    Account account = accountMap.get(transaction.getAccountId());
                    return account == null || account.getAccountType() != AccountType.DEBT;
                })
                .toList();

        Map<Currency, BigDecimal> income = totalsByCurrency(cashFlowTransactions, TransactionType.INCOME);
        Map<Currency, BigDecimal> expense = totalsByCurrency(cashFlowTransactions, TransactionType.EXPENSE);
        Map<Currency, BigDecimal> net = new EnumMap<>(Currency.class);
        for (Currency currency : Currency.values()) {
            BigDecimal value = income.getOrDefault(currency, BigDecimal.ZERO)
                    .subtract(expense.getOrDefault(currency, BigDecimal.ZERO));
            if (value.signum() != 0 || income.containsKey(currency) || expense.containsKey(currency)) {
                net.put(currency, value);
            }
        }

        List<LedgerDashboardResponse.CategorySpending> categories = categorySpending(cashFlowTransactions, expense);
        List<LedgerDashboardResponse.RecentTransaction> recent = cashFlowTransactions.stream()
                .filter(transaction -> transaction.getTransactionType() != TransactionType.TRANSFER
                        || transaction.getTransferDirection() != TransferDirection.IN)
                .limit(8)
                .map(transaction -> toRecentTransaction(transaction, accountMap.get(transaction.getAccountId())))
                .toList();

        return new LedgerDashboardResponse(
                targetMonth.toString(), LocalDateTime.now(), income, expense, net,
                categories, recent, buildInvestmentOverview(userId, accounts, from, to),
                buildDebtOverview(accounts, monthTransactions));
    }

    private LedgerDashboardResponse.DebtOverview buildDebtOverview(
            List<Account> allAccounts, List<Transaction> monthTransactions) {
        List<Account> debtAccounts = allAccounts.stream()
                .filter(account -> account.getAccountType() == AccountType.DEBT)
                .toList();
        if (debtAccounts.isEmpty()) {
            return new LedgerDashboardResponse.DebtOverview(0, List.of(), List.of(), List.of());
        }

        Set<String> debtAccountIds = debtAccounts.stream().map(Account::getAccountId).collect(Collectors.toSet());
        Map<Currency, DebtTotals> totals = new EnumMap<>(Currency.class);
        List<LedgerDashboardResponse.DebtAccountSummary> accountSummaries = new ArrayList<>();

        for (Account account : debtAccounts) {
            BigDecimal outstanding = zero(account.getCachedBookBalance()).abs();
            BigDecimal rate = zero(account.getInterestRate());
            BigDecimal monthlyInterest = outstanding.multiply(rate)
                    .divide(new BigDecimal("1200"), 2, RoundingMode.HALF_UP);
            DebtTotals currencyTotals = totals.computeIfAbsent(account.getCurrency(), ignored -> new DebtTotals());
            currencyTotals.addAccount(outstanding, rate, zero(account.getMonthlyPayment()), monthlyInterest);
            accountSummaries.add(new LedgerDashboardResponse.DebtAccountSummary(
                    account.getAccountId(), account.getAccountName(), account.getBankName(),
                    account.getAccountPurpose().name(), account.getCurrency(), outstanding,
                    account.getInterestRate(), account.getMonthlyPayment(), account.getMaturityDate(), monthlyInterest));
        }

        List<Transaction> debtTransactions = monthTransactions.stream()
                .filter(transaction -> debtAccountIds.contains(transaction.getAccountId()))
                .toList();
        debtTransactions.forEach(transaction -> totals
                .computeIfAbsent(transaction.getCurrency(), ignored -> new DebtTotals())
                .addTransaction(transaction));

        Map<String, Account> accountMap = debtAccounts.stream()
                .collect(Collectors.toMap(Account::getAccountId, Function.identity()));
        List<LedgerDashboardResponse.RecentTransaction> recent = debtTransactions.stream().limit(10)
                .map(transaction -> toRecentTransaction(transaction, accountMap.get(transaction.getAccountId())))
                .toList();
        List<LedgerDashboardResponse.DebtCurrencySummary> currencySummaries = totals.entrySet().stream()
                .map(entry -> entry.getValue().toResponse(entry.getKey()))
                .toList();
        accountSummaries.sort(Comparator.comparing(LedgerDashboardResponse.DebtAccountSummary::outstandingDebt).reversed());
        return new LedgerDashboardResponse.DebtOverview(
                debtAccounts.size(), currencySummaries, accountSummaries, recent);
    }

    private Map<Currency, BigDecimal> totalsByCurrency(
            List<Transaction> transactions, TransactionType type) {
        return transactions.stream().filter(item -> item.getTransactionType() == type)
                .collect(Collectors.groupingBy(
                        Transaction::getCurrency,
                        () -> new EnumMap<>(Currency.class),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));
    }

    private List<LedgerDashboardResponse.CategorySpending> categorySpending(
            List<Transaction> transactions, Map<Currency, BigDecimal> expenses) {
        record CategoryKey(String category, Currency currency) {}
        Map<CategoryKey, BigDecimal> grouped = transactions.stream()
                .filter(item -> item.getTransactionType() == TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(
                        item -> new CategoryKey(categoryOf(item), item.getCurrency()),
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));
        return grouped.entrySet().stream()
                .map(entry -> new LedgerDashboardResponse.CategorySpending(
                        entry.getKey().category(), entry.getKey().currency(), entry.getValue(),
                        percentage(entry.getValue(), expenses.get(entry.getKey().currency()))))
                .sorted(Comparator.comparing(LedgerDashboardResponse.CategorySpending::ratio).reversed())
                .limit(8)
                .toList();
    }

    private LedgerDashboardResponse.RecentTransaction toRecentTransaction(
            Transaction transaction, Account account) {
        return new LedgerDashboardResponse.RecentTransaction(
                transaction.getTransactionId(), transaction.getAccountId(),
                account == null ? "삭제된 계좌" : account.getAccountName(),
                transaction.getTransactionDate(), transaction.getTransactionType(),
                transaction.getTitle(), categoryOf(transaction), transaction.getAmount(), transaction.getCurrency());
    }

    private String categoryOf(Transaction transaction) {
        if (transaction.getCategoryId() != null && !transaction.getCategoryId().isBlank()) {
            return transaction.getCategoryId();
        }
        String memo = transaction.getMemo();
        if (memo != null && memo.startsWith("[") && memo.contains("]")) {
            return memo.substring(1, memo.indexOf(']'));
        }
        return transaction.getReconciliationId() != null ? "잔액 조정" : "기타";
    }

    private LedgerDashboardResponse.InvestmentOverview buildInvestmentOverview(
            String userId, List<Account> allAccounts, LocalDateTime from, LocalDateTime to) {
        List<Account> accounts = allAccounts.stream()
                .filter(account -> account.getAccountType() == AccountType.INVESTMENT).toList();
        if (accounts.isEmpty()) {
            return new LedgerDashboardResponse.InvestmentOverview(0, 0, 0,
                    List.of(), List.of(), List.of(), List.of(), List.of());
        }

        Map<String, Account> accountMap = accounts.stream()
                .collect(Collectors.toMap(Account::getAccountId, Function.identity()));
        List<Investment> allInvestments = investmentRepository
                .findByUserIdAndIsActiveTrueOrderBySymbolNameAsc(userId).stream()
                .filter(item -> accountMap.containsKey(item.getAccountId()))
                .toList();
        List<Investment> securities = allInvestments.stream()
                .filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH)
                .toList();
        Map<String, List<Investment>> byAccount = securities.stream()
                .collect(Collectors.groupingBy(Investment::getAccountId));
        Map<Currency, InvestmentTotals> totals = new EnumMap<>(Currency.class);
        List<LedgerDashboardResponse.InvestmentAccountSummary> accountSummaries = new ArrayList<>();
        List<LedgerDashboardResponse.InvestmentHoldingSummary> holdings = new ArrayList<>();
        Map<AllocationKey, BigDecimal> allocations = new HashMap<>();
        LocalDateTime staleBoundary = LocalDateTime.now().minusDays(4);
        int staleCount = 0;

        for (Account account : accounts) {
            List<Investment> accountHoldings = byAccount.getOrDefault(account.getAccountId(), List.of());
            BigDecimal market = sum(accountHoldings, Investment::getCachedMarketValue);
            BigDecimal principal = accountHoldings.stream()
                    .map(item -> item.getCachedQuantity().multiply(item.getCachedAvgBuyPriceBase()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal cash = zero(account.getCachedBookBalance());
            BigDecimal total = market.add(cash);
            BigDecimal profit = market.subtract(principal);
            List<String> ids = accountHoldings.stream().map(Investment::getInvestmentId).toList();
            BigDecimal dividend = ids.isEmpty() ? BigDecimal.ZERO
                    : investmentTransactionRepository.sumDividendBetween(
                            ids, InvestmentTradeType.DIVIDEND, from, to);
            LocalDateTime lastPriceAt = accountHoldings.stream().map(Investment::getPriceUpdatedAt)
                    .filter(Objects::nonNull).max(LocalDateTime::compareTo).orElse(null);

            InvestmentTotals currencyTotal = totals.computeIfAbsent(
                    account.getCurrency(), ignored -> new InvestmentTotals());
            currencyTotal.add(total, market, principal, cash, profit, dividend);
            allocations.merge(new AllocationKey(account.getCurrency(), InvestmentAssetClass.CASH), cash, BigDecimal::add);
            accountHoldings.forEach(item -> allocations.merge(
                    new AllocationKey(account.getCurrency(), item.getAssetClass()),
                    item.getCachedMarketValue(), BigDecimal::add));

            accountSummaries.add(new LedgerDashboardResponse.InvestmentAccountSummary(
                    account.getAccountId(), account.getAccountName(), account.getBankName(), account.getCurrency(),
                    total, principal, profit, percentage(profit, principal), cash,
                    accountHoldings.size(), lastPriceAt));

            for (Investment item : accountHoldings) {
                BigDecimal itemPrincipal = item.getCachedQuantity().multiply(item.getCachedAvgBuyPriceBase());
                BigDecimal itemProfit = item.getCachedMarketValue().subtract(itemPrincipal);
                if (item.getPriceUpdatedAt() == null || item.getPriceUpdatedAt().isBefore(staleBoundary)) staleCount++;
                holdings.add(new LedgerDashboardResponse.InvestmentHoldingSummary(
                        item.getInvestmentId(), account.getAccountId(), account.getAccountName(),
                        item.getTickerCode(), item.getSymbolName(), item.getAssetClass(), item.getMarket(),
                        item.getCurrency(), account.getCurrency(), item.getCachedQuantity(),
                        item.getCachedCurrentPrice(), item.getCachedMarketValue(), itemProfit,
                        percentage(itemProfit, itemPrincipal), item.getPriceUpdatedAt()));
            }
        }

        List<LedgerDashboardResponse.InvestmentCurrencySummary> currencySummaries = totals.entrySet().stream()
                .map(entry -> entry.getValue().toResponse(entry.getKey())).toList();
        List<LedgerDashboardResponse.InvestmentAllocation> allocationItems = allocations.entrySet().stream()
                .map(entry -> new LedgerDashboardResponse.InvestmentAllocation(
                        entry.getKey().currency(), entry.getKey().assetClass(), entry.getValue(),
                        percentage(entry.getValue(), totals.get(entry.getKey().currency()).totalAsset)))
                .sorted(Comparator.comparing((LedgerDashboardResponse.InvestmentAllocation item) -> item.currency().name())
                        .thenComparing(LedgerDashboardResponse.InvestmentAllocation::amount).reversed())
                .toList();

        Map<String, Investment> investmentMap = allInvestments.stream()
                .collect(Collectors.toMap(Investment::getInvestmentId, Function.identity()));
        List<String> ids = allInvestments.stream().map(Investment::getInvestmentId).toList();
        List<LedgerDashboardResponse.RecentInvestmentTrade> recentTrades = ids.isEmpty() ? List.of()
                : investmentTransactionRepository
                .findTop10ByInvestmentIdInAndTradeDateGreaterThanEqualAndTradeDateLessThanOrderByTradeDateDesc(
                        ids, from, to).stream()
                .map(transaction -> toRecentTrade(transaction, investmentMap, accountMap))
                .toList();

        holdings.sort(Comparator.comparing(LedgerDashboardResponse.InvestmentHoldingSummary::marketValue).reversed());
        accountSummaries.sort(Comparator.comparing(LedgerDashboardResponse.InvestmentAccountSummary::totalAsset).reversed());
        return new LedgerDashboardResponse.InvestmentOverview(
                accounts.size(), securities.size(), staleCount, currencySummaries,
                accountSummaries, holdings.stream().limit(12).toList(), allocationItems, recentTrades);
    }

    private LedgerDashboardResponse.RecentInvestmentTrade toRecentTrade(
            InvestmentTransaction transaction, Map<String, Investment> investmentMap,
            Map<String, Account> accountMap) {
        Investment investment = investmentMap.get(transaction.getInvestmentId());
        Account account = investment == null ? null : accountMap.get(investment.getAccountId());
        return new LedgerDashboardResponse.RecentInvestmentTrade(
                transaction.getInvestmentTransactionId(),
                account == null ? null : account.getAccountId(),
                account == null ? "삭제된 계좌" : account.getAccountName(),
                investment == null ? "종목 정보 없음" : investment.getSymbolName(),
                transaction.getTradeType(), transaction.getTradeDate(), transaction.getNetAmount(),
                account == null ? Currency.KRW : account.getCurrency());
    }

    private BigDecimal sum(List<Investment> items, Function<Investment, BigDecimal> mapper) {
        return items.stream().map(mapper).map(this::zero).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal percentage(BigDecimal amount, BigDecimal total) {
        if (amount == null || total == null || total.signum() == 0) return BigDecimal.ZERO;
        return amount.multiply(HUNDRED).divide(total, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private record AllocationKey(Currency currency, InvestmentAssetClass assetClass) {}

    private class DebtTotals {
        private BigDecimal outstandingDebt = BigDecimal.ZERO;
        private BigDecimal monthlyRepayment = BigDecimal.ZERO;
        private BigDecimal monthlyBorrowing = BigDecimal.ZERO;
        private BigDecimal plannedMonthlyPayment = BigDecimal.ZERO;
        private BigDecimal estimatedMonthlyInterest = BigDecimal.ZERO;
        private BigDecimal weightedRateAmount = BigDecimal.ZERO;

        void addAccount(BigDecimal outstanding, BigDecimal rate, BigDecimal plannedPayment,
                        BigDecimal monthlyInterest) {
            outstandingDebt = outstandingDebt.add(outstanding);
            plannedMonthlyPayment = plannedMonthlyPayment.add(plannedPayment);
            estimatedMonthlyInterest = estimatedMonthlyInterest.add(monthlyInterest);
            weightedRateAmount = weightedRateAmount.add(outstanding.multiply(rate));
        }

        void addTransaction(Transaction transaction) {
            boolean repayment = transaction.getTransactionType() == TransactionType.INCOME
                    || (transaction.getTransactionType() == TransactionType.TRANSFER
                    && transaction.getTransferDirection() == TransferDirection.IN);
            if (repayment) {
                monthlyRepayment = monthlyRepayment.add(transaction.getAmount());
            } else {
                monthlyBorrowing = monthlyBorrowing.add(transaction.getAmount());
            }
        }

        LedgerDashboardResponse.DebtCurrencySummary toResponse(Currency currency) {
            BigDecimal weightedRate = outstandingDebt.signum() == 0 ? BigDecimal.ZERO
                    : weightedRateAmount.divide(outstandingDebt, 2, RoundingMode.HALF_UP);
            return new LedgerDashboardResponse.DebtCurrencySummary(
                    currency, outstandingDebt, monthlyRepayment, monthlyBorrowing,
                    plannedMonthlyPayment, estimatedMonthlyInterest, weightedRate);
        }
    }

    private class InvestmentTotals {
        private BigDecimal totalAsset = BigDecimal.ZERO;
        private BigDecimal marketValue = BigDecimal.ZERO;
        private BigDecimal principal = BigDecimal.ZERO;
        private BigDecimal cash = BigDecimal.ZERO;
        private BigDecimal profit = BigDecimal.ZERO;
        private BigDecimal dividend = BigDecimal.ZERO;

        void add(BigDecimal totalAsset, BigDecimal marketValue, BigDecimal principal,
                 BigDecimal cash, BigDecimal profit, BigDecimal dividend) {
            this.totalAsset = this.totalAsset.add(totalAsset);
            this.marketValue = this.marketValue.add(marketValue);
            this.principal = this.principal.add(principal);
            this.cash = this.cash.add(cash);
            this.profit = this.profit.add(profit);
            this.dividend = this.dividend.add(dividend);
        }

        LedgerDashboardResponse.InvestmentCurrencySummary toResponse(Currency currency) {
            return new LedgerDashboardResponse.InvestmentCurrencySummary(
                    currency, totalAsset, marketValue, principal, cash, profit,
                    percentage(profit, principal), dividend);
        }
    }
}
