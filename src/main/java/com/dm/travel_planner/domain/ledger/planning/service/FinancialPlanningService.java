package com.dm.travel_planner.domain.ledger.planning.service;

import com.dm.travel_planner.domain.ledger.dto.AccountTransferRequest;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.planning.dto.*;
import com.dm.travel_planner.domain.ledger.planning.entity.*;
import com.dm.travel_planner.domain.ledger.planning.repository.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.FixedExpenseRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import com.dm.travel_planner.domain.ledger.service.AccountTransferService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FinancialPlanningService {
    private static final Pattern MONTH_PATTERN = Pattern.compile("^\\d{4}-(0[1-9]|1[0-2])$");
    private static final Pattern CATEGORY_PATTERN = Pattern.compile("^\\[([^]]+)]");
    private static final List<String> DEFAULT_CATEGORIES = List.of("식비", "교통", "주거·통신", "쇼핑", "여가", "기타");

    private final MonthlyFinancialPlanRepository planRepository;
    private final LedgerCategoryBudgetRepository budgetRepository;
    private final FinancialGoalRepository goalRepository;
    private final GoalContributionRepository contributionRepository;
    private final TransactionRepository transactionRepository;
    private final FixedExpenseRepository fixedExpenseRepository;
    private final AccountRepository accountRepository;
    private final AccountTransferService accountTransferService;

    public FinancialPlanningDashboardResponse getDashboard(String userId, String requestedMonth) {
        String month = normalizeMonth(requestedMonth);
        YearMonth yearMonth = YearMonth.parse(month);
        LocalDateTime from = yearMonth.atDay(1).atStartOfDay();
        LocalDateTime to = yearMonth.plusMonths(1).atDay(1).atStartOfDay();

        MonthlyFinancialPlan plan = planRepository.findByUserIdAndTargetMonth(userId, month).orElse(null);
        List<Transaction> transactions = transactionRepository
                .findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(userId, from, to);
        BigDecimal actualIncome = sumTransactions(transactions, TransactionType.INCOME);
        BigDecimal actualExpense = sumTransactions(transactions, TransactionType.EXPENSE);

        Map<String, BigDecimal> actualByCategory = transactions.stream()
                .filter(t -> t.getTransactionType() == TransactionType.EXPENSE)
                .collect(Collectors.groupingBy(this::extractCategory,
                        LinkedHashMap::new,
                        Collectors.reducing(BigDecimal.ZERO, Transaction::getAmount, BigDecimal::add)));

        List<LedgerCategoryBudget> savedBudgets = budgetRepository
                .findByUserIdAndTargetMonthOrderByCategoryNameAsc(userId, month);
        LinkedHashSet<String> categories = new LinkedHashSet<>();
        if (savedBudgets.isEmpty()) categories.addAll(DEFAULT_CATEGORIES);
        savedBudgets.forEach(item -> categories.add(item.getCategoryName()));
        categories.addAll(actualByCategory.keySet());

        Map<String, LedgerCategoryBudget> budgetByCategory = savedBudgets.stream()
                .collect(Collectors.toMap(LedgerCategoryBudget::getCategoryName, Function.identity(), (a, b) -> b));
        List<FinancialPlanningDashboardResponse.CategoryBudgetItem> budgetItems = categories.stream()
                .map(category -> categoryBudgetItem(category, budgetByCategory.get(category), actualByCategory.get(category)))
                .toList();
        BigDecimal categoryBudgetTotal = savedBudgets.stream()
                .map(LedgerCategoryBudget::getBudgetAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal expectedIncome = value(plan == null ? null : plan.getExpectedIncome());
        BigDecimal savingsTarget = value(plan == null ? null : plan.getSavingsTarget());
        BigDecimal investmentTarget = value(plan == null ? null : plan.getInvestmentTarget());
        BigDecimal debtTarget = value(plan == null ? null : plan.getDebtRepaymentTarget());
        BigDecimal plannedOutflow = categoryBudgetTotal.add(savingsTarget).add(investmentTarget).add(debtTarget);
        BigDecimal available = expectedIncome.subtract(plannedOutflow);
        int remainingDays = remainingDays(yearMonth);
        BigDecimal dailyAvailable = available.signum() <= 0 ? BigDecimal.ZERO
                : available.divide(BigDecimal.valueOf(remainingDays), 0, RoundingMode.DOWN);
        BigDecimal fixedExpenseAmount = fixedExpenseRepository
                .findByUserIdAndIsActiveTrueOrderByNextPaymentDateAsc(userId).stream()
                .map(item -> item.getAmount() == null ? BigDecimal.ZERO : item.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new FinancialPlanningDashboardResponse(month, expectedIncome, actualIncome, fixedExpenseAmount,
                actualExpense, savingsTarget, investmentTarget, debtTarget, categoryBudgetTotal,
                plannedOutflow, available, dailyAvailable, plan == null ? null : plan.getMemo(),
                budgetItems, getGoals(userId));
    }

    @Transactional
    public void saveMonthlyPlan(String userId, MonthlyPlanRequest request) {
        String month = normalizeMonth(request.targetMonth());
        MonthlyFinancialPlan plan = planRepository.findByUserIdAndTargetMonth(userId, month)
                .orElseGet(() -> MonthlyFinancialPlan.builder().userId(userId).targetMonth(month).build());
        plan.update(request.expectedIncome(), request.savingsTarget(), request.investmentTarget(),
                request.debtRepaymentTarget(), request.memo());
        planRepository.save(plan);
    }

    @Transactional
    public void replaceCategoryBudgets(String userId, CategoryBudgetsRequest request) {
        String month = normalizeMonth(request.targetMonth());
        LinkedHashMap<String, BigDecimal> distinct = new LinkedHashMap<>();
        request.budgets().forEach(item -> distinct.put(item.categoryName().trim(), value(item.budgetAmount())));
        budgetRepository.deleteByUserIdAndTargetMonth(userId, month);
        budgetRepository.flush();
        budgetRepository.saveAll(distinct.entrySet().stream()
                .map(entry -> LedgerCategoryBudget.builder()
                        .userId(userId).targetMonth(month).categoryName(entry.getKey())
                        .budgetAmount(entry.getValue()).build())
                .toList());
    }

    public List<FinancialGoalResponse> getGoals(String userId) {
        Map<String, String> accountNames = accountRepository.findByUserIdOrderByDisplayOrderAsc(userId).stream()
                .collect(Collectors.toMap(Account::getAccountId, Account::getAccountName));
        return goalRepository.findByUserIdAndStatusNotOrderByPriorityAscCreatedAtDesc(userId, "ARCHIVED").stream()
                .map(goal -> toGoalResponse(goal, accountNames.get(goal.getLinkedAccountId())))
                .toList();
    }

    @Transactional
    public FinancialGoalResponse createGoal(String userId, FinancialGoalRequest request) {
        validateGoalRequest(userId, request);
        FinancialGoal goal = FinancialGoal.builder()
                .userId(userId)
                .linkedAccountId(blankToNull(request.linkedAccountId()))
                .title(request.title().trim())
                .description(blankToNull(request.description()))
                .goalType(request.goalType())
                .targetAmount(request.targetAmount())
                .currentAmount(value(request.initialAmount()))
                .monthlyTargetAmount(value(request.monthlyTargetAmount()))
                .targetDate(request.targetDate())
                .priority(request.priority() == null ? 1 : request.priority())
                .iconColor(blankToDefault(request.iconColor(), "GREEN"))
                .build();
        FinancialGoal saved = goalRepository.save(goal);
        return toGoalResponse(saved, linkedAccountName(saved));
    }

    @Transactional
    public FinancialGoalResponse updateGoal(String userId, String goalId, FinancialGoalRequest request) {
        validateGoalRequest(userId, request);
        FinancialGoal goal = findGoal(userId, goalId);
        goal.update(request.title(), request.description(), request.goalType(), request.targetAmount(),
                request.monthlyTargetAmount(), request.targetDate(), request.priority(),
                request.linkedAccountId(), request.iconColor());
        return toGoalResponse(goal, linkedAccountName(goal));
    }

    @Transactional
    public FinancialGoalResponse addContribution(String userId, String goalId, GoalContributionRequest request) {
        FinancialGoal goal = findGoal(userId, goalId);
        if (!"IN_PROGRESS".equals(goal.getStatus())) {
            throw new IllegalStateException("진행 중인 목표에만 적립할 수 있습니다.");
        }
        LocalDateTime contributedAt = request.contributedAt() == null ? LocalDateTime.now() : request.contributedAt();
        String transferId = null;
        String sourceId = blankToNull(request.sourceAccountId());
        if (sourceId != null) {
            if (goal.getLinkedAccountId() == null) {
                throw new IllegalArgumentException("계좌 이체 적립을 하려면 목표에 적립 계좌를 먼저 연결해 주세요.");
            }
            AccountTransferService.TransferExecution transfer = accountTransferService.executeTransfer(userId,
                    new AccountTransferRequest(sourceId, goal.getLinkedAccountId(), request.amount(), BigDecimal.ZERO,
                            contributedAt, "목표 적립 · " + goal.getTitle() + memoSuffix(request.memo())));
            transferId = transfer.transfer().getTransferId();
        }
        GoalContribution contribution = contributionRepository.save(GoalContribution.builder()
                .goalId(goalId).userId(userId).sourceAccountId(sourceId).transferId(transferId)
                .amount(request.amount()).contributedAt(contributedAt).memo(blankToNull(request.memo())).build());
        goal.addContribution(request.amount());
        FinancialGoalResponse response = toGoalResponse(goal, linkedAccountName(goal));
        List<GoalContributionResponse> contributions = new ArrayList<>(response.recentContributions());
        if (contributions.stream().noneMatch(item -> item.contributionId().equals(contribution.getContributionId()))) {
            contributions.add(0, GoalContributionResponse.from(contribution));
        }
        return new FinancialGoalResponse(response.goalId(), response.title(), response.description(), response.goalType(),
                response.targetAmount(), response.currentAmount(), response.monthlyTargetAmount(), response.progressRate(),
                response.targetDate(), response.priority(), response.linkedAccountId(), response.linkedAccountName(),
                response.iconColor(), response.status(), contributions.stream().limit(5).toList());
    }

    @Transactional
    public void archiveGoal(String userId, String goalId) {
        findGoal(userId, goalId).archive();
    }

    private FinancialGoalResponse toGoalResponse(FinancialGoal goal, String accountName) {
        List<GoalContributionResponse> recent = contributionRepository.findByGoalIdOrderByContributedAtDesc(goal.getGoalId())
                .stream().limit(5).map(GoalContributionResponse::from).toList();
        return FinancialGoalResponse.from(goal, accountName, recent);
    }

    private FinancialGoal findGoal(String userId, String goalId) {
        return goalRepository.findByGoalIdAndUserId(goalId, userId)
                .orElseThrow(() -> new IllegalArgumentException("목표를 찾을 수 없습니다."));
    }

    private void validateGoalRequest(String userId, FinancialGoalRequest request) {
        if (!Set.of("SAVINGS", "EMERGENCY", "WISH", "TRAVEL", "OTHER").contains(request.goalType())) {
            throw new IllegalArgumentException("지원하지 않는 목표 유형입니다.");
        }
        String accountId = blankToNull(request.linkedAccountId());
        if (accountId != null) {
            accountRepository.findByAccountIdAndUserId(accountId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("연결할 계좌를 찾을 수 없습니다."));
        }
    }

    private FinancialPlanningDashboardResponse.CategoryBudgetItem categoryBudgetItem(
            String category, LedgerCategoryBudget budget, BigDecimal actualValue) {
        BigDecimal planned = budget == null ? BigDecimal.ZERO : value(budget.getBudgetAmount());
        BigDecimal actual = value(actualValue);
        BigDecimal remaining = planned.subtract(actual);
        BigDecimal rate = planned.signum() == 0
                ? (actual.signum() == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(100))
                : actual.multiply(BigDecimal.valueOf(100)).divide(planned, 1, RoundingMode.HALF_UP);
        return new FinancialPlanningDashboardResponse.CategoryBudgetItem(category, planned, actual, remaining, rate);
    }

    private BigDecimal sumTransactions(List<Transaction> items, TransactionType type) {
        return items.stream().filter(item -> item.getTransactionType() == type)
                .map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String extractCategory(Transaction transaction) {
        String memo = transaction.getMemo();
        if (memo != null) {
            Matcher matcher = CATEGORY_PATTERN.matcher(memo.trim());
            if (matcher.find()) {
                String category = matcher.group(1).trim();
                if (!category.isBlank() && !category.contains("계좌이체") && !category.contains("잔액")) return category;
            }
        }
        return "기타";
    }

    private String normalizeMonth(String month) {
        String value = month == null || month.isBlank() ? YearMonth.now().toString() : month.trim();
        if (!MONTH_PATTERN.matcher(value).matches()) throw new IllegalArgumentException("월은 YYYY-MM 형식이어야 합니다.");
        return value;
    }

    private int remainingDays(YearMonth month) {
        YearMonth now = YearMonth.now();
        if (month.isBefore(now)) return 1;
        if (month.isAfter(now)) return month.lengthOfMonth();
        return Math.max(1, month.lengthOfMonth() - LocalDate.now().getDayOfMonth() + 1);
    }

    private String linkedAccountName(FinancialGoal goal) {
        return goal.getLinkedAccountId() == null ? null
                : accountRepository.findById(goal.getLinkedAccountId()).map(Account::getAccountName).orElse(null);
    }

    private BigDecimal value(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String blankToDefault(String value, String defaultValue) { return value == null || value.isBlank() ? defaultValue : value; }
    private String memoSuffix(String memo) { return memo == null || memo.isBlank() ? "" : " · " + memo.trim(); }
}
