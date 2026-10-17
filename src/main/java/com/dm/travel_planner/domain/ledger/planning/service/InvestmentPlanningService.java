package com.dm.travel_planner.domain.ledger.planning.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import com.dm.travel_planner.domain.ledger.planning.dto.*;
import com.dm.travel_planner.domain.ledger.planning.entity.*;
import com.dm.travel_planner.domain.ledger.planning.repository.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvestmentPlanningService {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final InvestmentPlanRepository planRepository;
    private final InvestmentPlanItemRepository itemRepository;
    private final AccountRepository accountRepository;
    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository transactionRepository;

    public List<InvestmentPlanResponse> getPlans(String userId, String requestedMonth) {
        YearMonth month = requestedMonth == null || requestedMonth.isBlank()
                ? YearMonth.now() : YearMonth.parse(requestedMonth);
        Map<String, Account> accounts = accountRepository.findByUserIdOrderByDisplayOrderAsc(userId).stream()
                .collect(Collectors.toMap(Account::getAccountId, Function.identity()));
        return planRepository.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, "ARCHIVED").stream()
                .map(plan -> toResponse(plan, month, accounts))
                .toList();
    }

    @Transactional
    public InvestmentPlanResponse create(String userId, InvestmentPlanRequest request, String month) {
        ValidatedRequest validated = validate(userId, request);
        InvestmentPlan plan = planRepository.save(InvestmentPlan.builder()
                .userId(userId).build());
        plan.update(validated.investmentAccount().getAccountId(), validated.sourceAccountId(), request.title(),
                request.monthlyAmount(), request.targetAmount(), request.startDate(), request.targetDate(),
                request.executionDay(), normalizeStatus(request.status()), request.memo());
        saveItems(plan.getInvestmentPlanId(), validated.items());
        return toResponse(plan, parseMonth(month), accountMap(userId));
    }

    @Transactional
    public InvestmentPlanResponse update(String userId, String planId, InvestmentPlanRequest request, String month) {
        InvestmentPlan plan = findPlan(userId, planId);
        ValidatedRequest validated = validate(userId, request);
        plan.update(validated.investmentAccount().getAccountId(), validated.sourceAccountId(), request.title(),
                request.monthlyAmount(), request.targetAmount(), request.startDate(), request.targetDate(),
                request.executionDay(), normalizeStatus(request.status()), request.memo());
        itemRepository.deleteByInvestmentPlanId(planId);
        itemRepository.flush();
        saveItems(planId, validated.items());
        return toResponse(plan, parseMonth(month), accountMap(userId));
    }

    @Transactional
    public void archive(String userId, String planId) { findPlan(userId, planId).archive(); }

    private ValidatedRequest validate(String userId, InvestmentPlanRequest request) {
        Account investmentAccount = accountRepository.findByAccountIdAndUserId(request.investmentAccountId(), userId)
                .orElseThrow(() -> new IllegalArgumentException("투자계좌를 찾을 수 없습니다."));
        if (investmentAccount.getAccountType() != AccountType.INVESTMENT) {
            throw new IllegalArgumentException("투자 계획에는 투자계좌만 연결할 수 있습니다.");
        }
        String sourceId = blankToNull(request.sourceAccountId());
        if (sourceId != null) {
            Account source = accountRepository.findByAccountIdAndUserId(sourceId, userId)
                    .orElseThrow(() -> new IllegalArgumentException("출금 계좌를 찾을 수 없습니다."));
            if (source.getAccountType() == AccountType.DEBT || source.getAccountType() == AccountType.INVESTMENT) {
                throw new IllegalArgumentException("출금 계좌는 일반 입출금·저축 계좌 중에서 선택해 주세요.");
            }
            if (source.getCurrency() != investmentAccount.getCurrency()) {
                throw new IllegalArgumentException("출금 계좌와 투자계좌의 통화가 같아야 합니다.");
            }
        }
        if (request.targetDate() != null && request.targetDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("목표일은 시작일보다 빠를 수 없습니다.");
        }
        BigDecimal ratioTotal = request.items().stream().map(InvestmentPlanRequest.Item::targetRatio)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (ratioTotal.subtract(HUNDRED).abs().compareTo(new BigDecimal("0.01")) > 0) {
            throw new IllegalArgumentException("종목별 목표 비중의 합계는 100%여야 합니다.");
        }
        Set<String> tickers = new HashSet<>();
        List<Investment> holdings = investmentRepository.findByAccountIdAndUserId(
                investmentAccount.getAccountId(), userId);
        Map<String, Investment> byTicker = holdings.stream().collect(Collectors.toMap(
                item -> item.getTickerCode().toUpperCase(Locale.ROOT), Function.identity(), (a, b) -> a));
        List<InvestmentPlanItem> items = request.items().stream().map(item -> {
            String ticker = item.tickerCode().trim().toUpperCase(Locale.ROOT);
            if (!tickers.add(ticker)) throw new IllegalArgumentException("같은 종목을 중복해서 추가할 수 없습니다.");
            Investment holding = item.investmentId() == null || item.investmentId().isBlank()
                    ? byTicker.get(ticker)
                    : investmentRepository.findByInvestmentIdAndUserId(item.investmentId(), userId)
                    .orElseThrow(() -> new IllegalArgumentException("선택한 보유 종목을 찾을 수 없습니다."));
            if (holding != null && !holding.getAccountId().equals(investmentAccount.getAccountId())) {
                throw new IllegalArgumentException("다른 투자계좌의 종목은 연결할 수 없습니다.");
            }
            BigDecimal exchangeRate = item.quoteCurrency() == investmentAccount.getCurrency()
                    ? BigDecimal.ONE : valueOrOne(item.exchangeRate());
            return InvestmentPlanItem.builder()
                    .investmentId(holding == null ? null : holding.getInvestmentId())
                    .tickerCode(ticker).symbolName(item.symbolName().trim()).market(blankToNull(item.market()))
                    .quoteCurrency(item.quoteCurrency()).assetClass(item.assetClass())
                    .targetRatio(item.targetRatio()).referencePrice(value(item.referencePrice()))
                    .exchangeRate(exchangeRate).priceQuotedAt(item.priceQuotedAt()).build();
        }).toList();
        return new ValidatedRequest(investmentAccount, sourceId, items);
    }

    private void saveItems(String planId, List<InvestmentPlanItem> items) {
        itemRepository.saveAll(items.stream().map(item -> InvestmentPlanItem.builder()
                .investmentPlanId(planId).investmentId(item.getInvestmentId())
                .tickerCode(item.getTickerCode()).symbolName(item.getSymbolName()).market(item.getMarket())
                .quoteCurrency(item.getQuoteCurrency()).assetClass(item.getAssetClass())
                .targetRatio(item.getTargetRatio()).referencePrice(item.getReferencePrice())
                .exchangeRate(item.getExchangeRate()).priceQuotedAt(item.getPriceQuotedAt()).build()).toList());
    }

    private InvestmentPlanResponse toResponse(InvestmentPlan plan, YearMonth month, Map<String, Account> accounts) {
        Account investmentAccount = accounts.get(plan.getInvestmentAccountId());
        com.dm.travel_planner.domain.ledger.entity.Currency accountCurrency = investmentAccount == null
                ? com.dm.travel_planner.domain.ledger.entity.Currency.KRW : investmentAccount.getCurrency();
        List<InvestmentPlanItem> planItems = itemRepository
                .findByInvestmentPlanIdOrderByCreatedAtAsc(plan.getInvestmentPlanId());
        Map<String, Investment> holdings = investmentRepository
                .findByAccountIdAndUserId(plan.getInvestmentAccountId(), plan.getUserId()).stream()
                .collect(Collectors.toMap(item -> item.getTickerCode().toUpperCase(Locale.ROOT), Function.identity(), (a, b) -> a));

        List<String> ids = planItems.stream().map(item -> {
            if (item.getInvestmentId() != null) return item.getInvestmentId();
            Investment holding = holdings.get(item.getTickerCode().toUpperCase(Locale.ROOT));
            return holding == null ? null : holding.getInvestmentId();
        }).filter(Objects::nonNull).distinct().toList();

        LocalDateTime monthFrom = month.atDay(1).atStartOfDay();
        LocalDateTime monthTo = month.plusMonths(1).atDay(1).atStartOfDay();
        LocalDateTime cumulativeFrom = plan.getStartDate().atStartOfDay();
        LocalDateTime cumulativeTo = LocalDate.now().plusDays(1).atStartOfDay();
        List<InvestmentTransaction> monthly = findBuys(ids, monthFrom, monthTo);
        List<InvestmentTransaction> cumulative = cumulativeFrom.isBefore(cumulativeTo)
                ? findBuys(ids, cumulativeFrom, cumulativeTo) : List.of();

        Map<String, BigDecimal> monthlyByInvestment = sumByInvestment(monthly);
        Map<String, BigDecimal> cumulativeByInvestment = sumByInvestment(cumulative);
        List<InvestmentPlanResponse.Item> responseItems = planItems.stream().map(item -> {
            Investment holding = holdings.get(item.getTickerCode().toUpperCase(Locale.ROOT));
            String investmentId = item.getInvestmentId() != null ? item.getInvestmentId()
                    : holding == null ? null : holding.getInvestmentId();
            BigDecimal planned = plan.getMonthlyAmount().multiply(item.getTargetRatio())
                    .divide(HUNDRED, 2, RoundingMode.HALF_UP);
            BigDecimal unitBase = value(item.getReferencePrice()).multiply(valueOrOne(item.getExchangeRate()));
            BigDecimal quantity = unitBase.signum() <= 0 ? BigDecimal.ZERO
                    : planned.divide(unitBase, 6, RoundingMode.DOWN);
            return new InvestmentPlanResponse.Item(item.getInvestmentPlanItemId(), investmentId,
                    item.getTickerCode(), item.getSymbolName(), item.getMarket(), item.getQuoteCurrency(),
                    item.getAssetClass(), item.getTargetRatio(), planned,
                    monthlyByInvestment.getOrDefault(investmentId, BigDecimal.ZERO),
                    cumulativeByInvestment.getOrDefault(investmentId, BigDecimal.ZERO),
                    item.getReferencePrice(), item.getExchangeRate(), quantity, item.getPriceQuotedAt());
        }).toList();
        BigDecimal monthlyActual = responseItems.stream().map(InvestmentPlanResponse.Item::monthlyActualAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal cumulativeActual = responseItems.stream().map(InvestmentPlanResponse.Item::cumulativeInvestedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new InvestmentPlanResponse(plan.getInvestmentPlanId(), plan.getTitle(), plan.getInvestmentAccountId(),
                investmentAccount == null ? "삭제된 투자계좌" : investmentAccount.getAccountName(), accountCurrency,
                plan.getSourceAccountId(), Optional.ofNullable(accounts.get(plan.getSourceAccountId()))
                .map(Account::getAccountName).orElse(null), plan.getMonthlyAmount(), plan.getTargetAmount(),
                monthlyActual, cumulativeActual, rate(monthlyActual, plan.getMonthlyAmount()),
                rate(cumulativeActual, plan.getTargetAmount()), plan.getStartDate(), plan.getTargetDate(),
                plan.getExecutionDay(), nextExecutionDate(plan), plan.getStatus(), plan.getMemo(), responseItems);
    }

    private List<InvestmentTransaction> findBuys(List<String> ids, LocalDateTime from, LocalDateTime to) {
        if (ids.isEmpty()) return List.of();
        return transactionRepository
                .findByInvestmentIdInAndTradeDateGreaterThanEqualAndTradeDateLessThanOrderByTradeDateDesc(ids, from, to)
                .stream().filter(item -> item.getTradeType() == InvestmentTradeType.BUY).toList();
    }

    private Map<String, BigDecimal> sumByInvestment(List<InvestmentTransaction> transactions) {
        return transactions.stream().collect(Collectors.groupingBy(InvestmentTransaction::getInvestmentId,
                Collectors.reducing(BigDecimal.ZERO, item -> item.getNetAmount().abs(), BigDecimal::add)));
    }

    private LocalDate nextExecutionDate(InvestmentPlan plan) {
        LocalDate today = LocalDate.now();
        YearMonth cursor = YearMonth.from(today);
        LocalDate candidate = cursor.atDay(Math.min(plan.getExecutionDay(), cursor.lengthOfMonth()));
        if (candidate.isBefore(today)) {
            cursor = cursor.plusMonths(1);
            candidate = cursor.atDay(Math.min(plan.getExecutionDay(), cursor.lengthOfMonth()));
        }
        if (candidate.isBefore(plan.getStartDate())) candidate = plan.getStartDate();
        return plan.getTargetDate() != null && candidate.isAfter(plan.getTargetDate()) ? null : candidate;
    }

    private InvestmentPlan findPlan(String userId, String planId) {
        return planRepository.findByInvestmentPlanIdAndUserId(planId, userId)
                .orElseThrow(() -> new IllegalArgumentException("투자 계획을 찾을 수 없습니다."));
    }
    private Map<String, Account> accountMap(String userId) { return accountRepository.findByUserIdOrderByDisplayOrderAsc(userId).stream().collect(Collectors.toMap(Account::getAccountId, Function.identity())); }
    private YearMonth parseMonth(String month) { return month == null || month.isBlank() ? YearMonth.now() : YearMonth.parse(month); }
    private String normalizeStatus(String status) { String value = status == null || status.isBlank() ? "ACTIVE" : status; if (!Set.of("ACTIVE", "PAUSED").contains(value)) throw new IllegalArgumentException("지원하지 않는 투자 계획 상태입니다."); return value; }
    private BigDecimal rate(BigDecimal value, BigDecimal total) { return total == null || total.signum() <= 0 ? BigDecimal.ZERO : value.multiply(HUNDRED).divide(total, 1, RoundingMode.HALF_UP); }
    private BigDecimal value(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private BigDecimal valueOrOne(BigDecimal value) { return value == null || value.signum() <= 0 ? BigDecimal.ONE : value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private record ValidatedRequest(Account investmentAccount, String sourceAccountId, List<InvestmentPlanItem> items) {}
}
