package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.dto.AccountResponse;
import com.dm.travel_planner.domain.ledger.dto.AccountTransferRequest;
import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.entity.Transaction;
import com.dm.travel_planner.domain.ledger.entity.TransactionType;
import com.dm.travel_planner.domain.ledger.entity.TransferDirection;
import com.dm.travel_planner.domain.ledger.investment.dto.*;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.price.MarketPriceProvider;
import com.dm.travel_planner.domain.ledger.investment.price.MarketQuote;
import com.dm.travel_planner.domain.ledger.investment.price.MarketSymbol;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.repository.TransactionRepository;
import com.dm.travel_planner.domain.ledger.service.AccountTransferService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvestmentService {
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final BigDecimal ALERT_THRESHOLD = new BigDecimal("5");
    private static final String CASH_TICKER = "CASH";

    private final AccountRepository accountRepository;
    private final TransactionRepository ledgerTransactionRepository;
    private final AccountTransferService accountTransferService;
    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository transactionRepository;
    private final InvestmentAccountProfileRepository profileRepository;
    private final InvestmentTargetAllocationRepository targetRepository;
    private final InvestmentPriceSnapshotRepository priceSnapshotRepository;
    private final InvestmentAccountSnapshotRepository accountSnapshotRepository;
    private final InvestmentNoteRepository noteRepository;
    private final InvestmentFeeSettingRepository feeSettingRepository;
    private final MarketPriceProvider marketPriceProvider;

    @Transactional
    public InvestmentTransactionResponse createCashAdjustment(
            String accountId, String userId, BigDecimal adjustmentAmount,
            String reason, String memo, String reconciliationId) {
        Account account = requireInvestmentAccount(accountId, userId);
        Investment cashHolding = getOrCreateCashHolding(account, userId);
        InvestmentTradeType tradeType = adjustmentAmount.signum() >= 0
                ? InvestmentTradeType.DEPOSIT : InvestmentTradeType.WITHDRAWAL;
        String adjustmentMemo = "잔액 조정 사유: " + reason
                + (memo == null || memo.isBlank() ? "" : " · " + memo.trim());

        return recordTransaction(accountId, userId, new InvestmentTradeRequest(
                tradeType,
                cashHolding.getInvestmentId(),
                CASH_TICKER,
                "예수금",
                InvestmentAssetClass.CASH,
                "CASH",
                null,
                null,
                adjustmentAmount.abs(),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                false,
                account.getCurrency(),
                BigDecimal.ONE,
                LocalDateTime.now(),
                adjustmentMemo,
                "RECONCILIATION:" + reconciliationId,
                null
        ));
    }

    @Transactional
    public InvestmentDetailResponse getDetail(String accountId, String userId) {
        Account account = requireInvestmentAccount(accountId, userId);
        InvestmentAccountProfile profile = getOrCreateProfile(accountId);
        getOrCreateCashHolding(account, userId);
        return buildDetail(account, profile, userId);
    }

    public List<InvestmentSymbolResponse> searchSymbols(
            String accountId, String userId, String query, String marketGroup) {
        requireInvestmentAccount(accountId, userId);
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.length() < 2) return List.of();
        String normalizedMarket = marketGroup == null ? "ALL" : marketGroup.trim().toUpperCase(Locale.ROOT);
        String lowerQuery = normalizedQuery.toLowerCase(Locale.ROOT);

        List<InvestmentSymbolResponse> results = new ArrayList<>();
        Set<String> identities = new LinkedHashSet<>();
        investmentRepository.findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(accountId, userId)
                .stream()
                .filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH)
                .filter(item -> matchesMarketGroup(item.getCurrency(), normalizedMarket))
                .filter(item -> item.getTickerCode().toLowerCase(Locale.ROOT).contains(lowerQuery)
                        || item.getSymbolName().toLowerCase(Locale.ROOT).contains(lowerQuery))
                .forEach(item -> {
                    identities.add(symbolIdentity(item.getTickerCode(), item.getMarket()));
                    results.add(new InvestmentSymbolResponse(
                            item.getInvestmentId(), item.getTickerCode(), item.getSymbolName(), item.getMarket(),
                            item.getCurrency(), item.getAssetClass(), item.getCachedCurrentPrice(),
                            null,
                            item.getCachedQuantity(), item.getPriceUpdatedAt(), "PORTFOLIO", true));
                });

        for (MarketSymbol symbol : marketPriceProvider.searchSymbols(normalizedQuery, normalizedMarket)) {
            String identity = symbolIdentity(symbol.tickerCode(), symbol.market());
            if (!identities.add(identity)) {
                if (symbol.currentPrice() != null || symbol.openingPrice() != null) {
                    for (int index = 0; index < results.size(); index++) {
                        InvestmentSymbolResponse existing = results.get(index);
                        if (!symbolIdentity(existing.tickerCode(), existing.market()).equals(identity)) continue;
                        results.set(index, new InvestmentSymbolResponse(
                                existing.investmentId(), existing.tickerCode(), existing.symbolName(),
                                existing.market(), existing.currency(), existing.assetClass(),
                                symbol.currentPrice(), symbol.openingPrice(), existing.quantity(), symbol.quotedAt(),
                                symbol.source(), true));
                        break;
                    }
                }
                continue;
            }
            results.add(new InvestmentSymbolResponse(
                    null, symbol.tickerCode(), symbol.symbolName(), symbol.market(), symbol.currency(),
                    symbol.currency() == Currency.KRW
                            ? InvestmentAssetClass.DOMESTIC_STOCK : InvestmentAssetClass.FOREIGN_STOCK,
                    symbol.currentPrice(), symbol.openingPrice(), BigDecimal.ZERO,
                    symbol.quotedAt(), symbol.source(), false));
        }
        return results.stream().limit(10).toList();
    }

    public InvestmentTradePriceResponse getTradePrice(
            String accountId, String userId, String tickerCode, String market, Currency currency) {
        requireInvestmentAccount(accountId, userId);
        if (!marketPriceProvider.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "KIS API 키가 현재 백엔드에 적용되지 않았습니다.");
        }
        String normalizedTicker = tickerCode == null ? "" : tickerCode.trim().toUpperCase(Locale.ROOT);
        if (normalizedTicker.isBlank() || currency == null) {
            throw badRequest("종목 코드와 통화를 확인해 주세요.");
        }
        var quote = marketPriceProvider.getTradePrice(normalizedTicker, market, currency)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        marketDataFailure("KIS 시세를 불러오지 못했습니다.")));
        BigDecimal recommended = quote.preferredPrice();
        String basis = quote.currentPrice() != null && quote.currentPrice().signum() > 0
                ? "CURRENT" : "OPENING";
        return new InvestmentTradePriceResponse(
                normalizedTicker, market, currency, quote.currentPrice(), quote.openingPrice(),
                recommended, basis, quote.quotedAt(), quote.source());
    }

    @Transactional
    public InvestmentDetailResponse.Holding createHolding(
            String accountId, String userId, InvestmentHoldingCreateRequest request) {
        Account account = requireInvestmentAccount(accountId, userId);
        if (request.assetClass() == InvestmentAssetClass.CASH) {
            throw badRequest("예수금은 계좌 잔액에서 자동으로 관리됩니다.");
        }
        String tickerCode = request.tickerCode().trim().toUpperCase(Locale.ROOT);
        investmentRepository.findByAccountIdAndUserIdAndTickerCode(accountId, userId, tickerCode)
                .ifPresent(existing -> { throw conflict("이미 등록된 종목 코드입니다: " + tickerCode); });

        Investment investment = Investment.builder()
                .userId(userId)
                .accountId(accountId)
                .tickerCode(tickerCode)
                .symbolName(request.symbolName().trim())
                .assetClass(request.assetClass())
                .market(request.market())
                .currency(request.currency() != null ? request.currency() : account.getCurrency())
                .targetQuantity(zeroIfNull(request.targetQuantity()))
                .build();
        return toHolding(investmentRepository.save(investment), BigDecimal.ZERO);
    }

    public List<InvestmentFeeSettingResponse> getFeeSettings(String accountId, String userId) {
        requireInvestmentAccount(accountId, userId);
        Map<InvestmentMarketGroup, InvestmentFeeSetting> saved = feeSettingRepository
                .findByAccountIdAndUserIdOrderByMarketGroup(accountId, userId)
                .stream()
                .collect(Collectors.toMap(InvestmentFeeSetting::getMarketGroup, Function.identity()));
        return Arrays.stream(InvestmentMarketGroup.values())
                .map(market -> toFeeSettingResponse(saved.get(market), market))
                .toList();
    }

    @Transactional
    public List<InvestmentFeeSettingResponse> updateFeeSettings(
            String accountId, String userId, InvestmentFeeSettingsRequest request) {
        requireInvestmentAccount(accountId, userId);
        for (InvestmentFeeSettingsRequest.MarketSetting values : request.settings()) {
            InvestmentFeeSetting setting = feeSettingRepository
                    .findByAccountIdAndUserIdAndMarketGroup(accountId, userId, values.marketGroup())
                    .orElseGet(() -> InvestmentFeeSetting.builder()
                            .accountId(accountId)
                            .userId(userId)
                            .marketGroup(values.marketGroup())
                            .build());
            setting.updateRates(values.buyFeeRate(), values.sellFeeRate(),
                    values.sellTaxRate(), values.dividendTaxRate());
            feeSettingRepository.save(setting);
        }
        return getFeeSettings(accountId, userId);
    }

    @Transactional
    public InvestmentTransactionResponse recordTransaction(
            String accountId, String userId, InvestmentTradeRequest request) {
        Account account = requireInvestmentAccount(accountId, userId);
        Investment investment = resolveTradeInvestment(account, userId, request);
        BigDecimal quantity = zeroIfNull(request.quantity());
        BigDecimal unitPrice = zeroIfNull(request.unitPrice());
        BigDecimal fee = zeroIfNull(request.feeAmount());
        BigDecimal tax = zeroIfNull(request.taxAmount());
        Currency currency = request.currency() != null ? request.currency() : investment.getCurrency();
        BigDecimal exchangeRate = resolveExchangeRate(currency, account.getCurrency(), request.exchangeRate());
        LocalDateTime tradeDate = request.tradeDate() != null ? request.tradeDate() : LocalDateTime.now();

        BigDecimal gross;
        BigDecimal netBase;
        BigDecimal realized = BigDecimal.ZERO;

        switch (request.tradeType()) {
            case BUY -> {
                requirePositive(quantity, "매수 수량");
                requirePositive(unitPrice, "매수 단가");
                gross = quantity.multiply(unitPrice);
                TradeCosts costs = resolveTradeCosts(accountId, userId, investment, request.tradeType(), gross, request);
                fee = costs.fee();
                tax = costs.tax();
                BigDecimal debitBase = gross.add(fee).add(tax).multiply(exchangeRate);
                ensureCash(account, debitBase);
                account.applyQuickTransaction(debitBase, false);
                investment.applyBuy(quantity, unitPrice, exchangeRate, fee, tax);
                if (investment.getCachedCurrentPrice().signum() == 0) {
                    investment.updatePrice(unitPrice, exchangeRate, tradeDate);
                }
                netBase = debitBase.negate();
            }
            case SELL -> {
                requirePositive(quantity, "매도 수량");
                requirePositive(unitPrice, "매도 단가");
                gross = quantity.multiply(unitPrice);
                TradeCosts costs = resolveTradeCosts(accountId, userId, investment, request.tradeType(), gross, request);
                fee = costs.fee();
                tax = costs.tax();
                ensureFeesDoNotExceedAmount(gross, fee, tax);
                realized = investment.applySell(quantity, gross, fee, tax, exchangeRate);
                BigDecimal creditBase = gross.subtract(fee).subtract(tax).multiply(exchangeRate);
                account.applyQuickTransaction(creditBase, true);
                netBase = creditBase;
            }
            case DIVIDEND -> {
                gross = requireAmount(request.amount(), "배당 금액");
                TradeCosts costs = resolveTradeCosts(accountId, userId, investment, request.tradeType(), gross, request);
                fee = costs.fee();
                tax = costs.tax();
                ensureFeesDoNotExceedAmount(gross, fee, tax);
                BigDecimal creditBase = gross.subtract(fee).subtract(tax).multiply(exchangeRate);
                account.applyQuickTransaction(creditBase, true);
                netBase = creditBase;
            }
            case DEPOSIT -> {
                fee = BigDecimal.ZERO;
                tax = BigDecimal.ZERO;
                gross = requireAmount(request.amount(), "입금 금액");
                netBase = gross.multiply(exchangeRate);
                if (isExternalCashTrade(request)) account.applyQuickTransaction(netBase, true);
            }
            case WITHDRAWAL -> {
                fee = BigDecimal.ZERO;
                tax = BigDecimal.ZERO;
                gross = requireAmount(request.amount(), "출금 금액");
                netBase = gross.multiply(exchangeRate).negate();
                ensureCash(account, netBase.abs());
                if (isExternalCashTrade(request)) account.applyQuickTransaction(netBase.abs(), false);
            }
            default -> throw badRequest("지원하지 않는 투자 거래 유형입니다.");
        }

        Transaction ledgerTransaction = isCashTrade(request.tradeType())
                ? recordCashLedgerTransaction(account, userId, request, tradeDate, netBase)
                : null;

        if (ledgerTransaction != null && ledgerTransaction.getTransferId() != null) {
            InvestmentTransaction linkedTransfer = transactionRepository
                    .findFirstByTransactionId(ledgerTransaction.getTransactionId())
                    .orElseThrow(() -> new IllegalStateException("투자 예수금 이체 기록을 찾을 수 없습니다."));
            saveTodaySnapshot(account, userId);
            return InvestmentTransactionResponse.from(linkedTransfer);
        }

        InvestmentTransaction transaction = InvestmentTransaction.builder()
                .investmentId(investment.getInvestmentId())
                .transactionId(ledgerTransaction == null ? null : ledgerTransaction.getTransactionId())
                .tradeType(request.tradeType())
                .tradeDate(tradeDate)
                .quantity(quantity)
                .unitPrice(unitPrice)
                .grossAmount(gross)
                .feeAmount(fee)
                .taxAmount(tax)
                .netAmount(netBase)
                .realizedProfitLoss(realized)
                .currency(currency)
                .exchangeRate(exchangeRate)
                .memo(request.memo())
                .externalTransactionKey(request.externalTransactionKey())
                .build();
        InvestmentTransaction saved = transactionRepository.save(transaction);
        saveTodaySnapshot(account, userId);
        return InvestmentTransactionResponse.from(saved);
    }

    private Transaction recordCashLedgerTransaction(
            Account investmentAccount, String userId, InvestmentTradeRequest request,
            LocalDateTime tradeDate, BigDecimal netBase) {
        boolean deposit = request.tradeType() == InvestmentTradeType.DEPOSIT;
        BigDecimal amount = netBase.abs();
        String counterAccountId = request.counterAccountId() == null
                ? "" : request.counterAccountId().trim();
        TransactionType ledgerType;
        String title;
        String category;
        String detail;

        if (!counterAccountId.isBlank()) {
            String sourceAccountId = deposit ? counterAccountId : investmentAccount.getAccountId();
            String destinationAccountId = deposit ? investmentAccount.getAccountId() : counterAccountId;
            return accountTransferService.executeTransfer(userId, new AccountTransferRequest(
                    sourceAccountId, destinationAccountId, amount, BigDecimal.ZERO,
                    tradeDate, request.memo())).transactionFor(investmentAccount.getAccountId());
        }

        ledgerType = deposit ? TransactionType.INCOME : TransactionType.EXPENSE;
        title = deposit ? "투자 예수금 외부 입금" : "투자 예수금 외부 출금";
        category = "투자 예수금";
        detail = deposit ? "외부에서 투자 계좌로 입금" : "투자 계좌에서 외부로 출금";

        String userMemo = request.memo() == null || request.memo().isBlank()
                ? "" : " · " + request.memo().trim();
        String reconciliationId = request.externalTransactionKey() != null
                && request.externalTransactionKey().startsWith("RECONCILIATION:")
                ? request.externalTransactionKey().substring("RECONCILIATION:".length()) : null;

        return ledgerTransactionRepository.save(Transaction.builder()
                .userId(userId)
                .accountId(investmentAccount.getAccountId())
                .transactionDate(tradeDate)
                .transactionType(ledgerType)
                .title(title)
                .categoryId(null)
                .amount(amount)
                .currency(investmentAccount.getCurrency())
                .memo("[" + category + "] " + detail + userMemo)
                .reconciliationId(reconciliationId)
                .build());
    }

    private boolean isExternalCashTrade(InvestmentTradeRequest request) {
        return request.counterAccountId() == null || request.counterAccountId().isBlank();
    }

    private boolean isCashTrade(InvestmentTradeType tradeType) {
        return tradeType == InvestmentTradeType.DEPOSIT || tradeType == InvestmentTradeType.WITHDRAWAL;
    }

    @Transactional
    public InvestmentDetailResponse.Holding updateManualPrice(
            String accountId, String investmentId, String userId, InvestmentPriceUpdateRequest request) {
        requireInvestmentAccount(accountId, userId);
        Investment investment = requireInvestment(investmentId, userId);
        if (!investment.getAccountId().equals(accountId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "다른 투자 계좌의 종목입니다.");
        }
        LocalDateTime now = LocalDateTime.now();
        investment.updatePrice(request.price(), request.exchangeRate(), now);
        savePriceSnapshot(investment, request.price(), request.exchangeRate(), now, "MANUAL");
        Account account = requireInvestmentAccount(accountId, userId);
        saveTodaySnapshot(account, userId);
        return toHolding(investment, BigDecimal.ZERO);
    }

    @Transactional
    public List<InvestmentDetailResponse.Holding> syncPrices(String accountId, String userId) {
        Account account = requireInvestmentAccount(accountId, userId);
        InvestmentAccountProfile profile = getOrCreateProfile(accountId);
        if (!marketPriceProvider.isConfigured()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "가격 API 키가 설정되지 않았습니다. KIS_APP_KEY와 KIS_APP_SECRET 환경변수를 설정해 주세요.");
        }

        profile.markSyncing(marketPriceProvider.providerName());
        List<Investment> investments = investmentRepository
                .findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(accountId, userId)
                .stream().filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH).toList();
        int successCount = 0;
        for (Investment investment : investments) {
            Optional<MarketQuote> quote = marketPriceProvider.getLatestPrice(investment);
            if (quote.isEmpty()) continue;
            BigDecimal exchangeRate = investment.getCurrency() == account.getCurrency()
                    ? BigDecimal.ONE
                    : marketPriceProvider.getExchangeRate(investment.getCurrency(), account.getCurrency())
                    .orElse(investment.getCachedExchangeRate());
            MarketQuote value = quote.get();
            investment.updatePrice(value.price(), exchangeRate, value.quotedAt());
            savePriceSnapshot(investment, value.price(), exchangeRate, value.quotedAt(), value.source());
            successCount++;
        }

        InvestmentSyncStatus status = investments.isEmpty() || successCount == investments.size()
                ? InvestmentSyncStatus.SUCCESS
                : successCount == 0 ? InvestmentSyncStatus.FAILED : InvestmentSyncStatus.PARTIAL;
        profile.completeSync(status);
        if (!investments.isEmpty() && successCount == 0) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    marketDataFailure("등록된 종목의 KIS 시세를 불러오지 못했습니다."));
        }
        saveTodaySnapshot(account, userId);

        BigDecimal total = calculateTotalAsset(account, investments);
        return investments.stream().map(item -> toHolding(item, total)).toList();
    }

    public Optional<String> getPriceProviderLastFailure() {
        return marketPriceProvider.getLastFailureMessage();
    }

    private String marketDataFailure(String fallback) {
        return marketPriceProvider.getLastFailureMessage()
                .map(message -> fallback + " " + message)
                .orElse(fallback);
    }

    @Transactional
    public InvestmentDetailResponse.Profile updateProfile(
            String accountId, String userId, InvestmentProfileUpdateRequest request) {
        requireInvestmentAccount(accountId, userId);
        InvestmentAccountProfile profile = getOrCreateProfile(accountId);
        profile.updateSettings(request.primary(), request.autoSyncEnabled(), request.syncProvider());
        return toProfile(profile);
    }

    @Transactional
    public List<InvestmentDetailResponse.TargetAllocation> updateTargets(
            String accountId, String userId, InvestmentTargetAllocationRequest request) {
        Account account = requireInvestmentAccount(accountId, userId);
        BigDecimal totalRatio = request.items().stream()
                .map(InvestmentTargetAllocationRequest.Item::targetRatio)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (totalRatio.compareTo(ONE_HUNDRED) != 0) {
            throw badRequest("목표 비중 합계는 정확히 100%여야 합니다.");
        }
        long distinctCount = request.items().stream().map(InvestmentTargetAllocationRequest.Item::assetClass).distinct().count();
        if (distinctCount != request.items().size()) throw badRequest("같은 자산 분류를 중복 지정할 수 없습니다.");

        targetRepository.deleteByAccountIdAndUserId(accountId, userId);
        targetRepository.flush();
        request.items().forEach(item -> targetRepository.save(InvestmentTargetAllocation.builder()
                .userId(userId).accountId(accountId).assetClass(item.assetClass())
                .targetRatio(item.targetRatio()).build()));
        return buildTargetAllocations(account, userId);
    }

    @Transactional
    public InvestmentDetailResponse.Note createNote(
            String accountId, String userId, InvestmentNoteRequest request) {
        requireInvestmentAccount(accountId, userId);
        InvestmentNote note = InvestmentNote.builder()
                .userId(userId).accountId(accountId).title(request.title().trim())
                .content(request.content()).isPinned(Boolean.TRUE.equals(request.pinned())).build();
        return toNote(noteRepository.save(note));
    }

    @Transactional
    public void deleteNote(String accountId, String noteId, String userId) {
        requireInvestmentAccount(accountId, userId);
        InvestmentNote note = noteRepository.findByNoteIdAndUserId(noteId, userId)
                .filter(value -> value.getAccountId().equals(accountId))
                .orElseThrow(() -> notFound("투자 메모를 찾을 수 없습니다."));
        noteRepository.delete(note);
    }

    @Transactional
    public Page<InvestmentTransactionResponse> getTransactions(
            String accountId, String userId, InvestmentTradeType type,
            LocalDate from, LocalDate to, Pageable pageable) {
        Account account = requireInvestmentAccount(accountId, userId);
        syncMissingTransferHistory(account, userId);
        List<String> investmentIds = investmentIds(accountId, userId);
        if (investmentIds.isEmpty()) return Page.empty(pageable);
        LocalDateTime fromDate = (from != null ? from : LocalDate.of(1970, 1, 1)).atStartOfDay();
        LocalDateTime toDate = (to != null ? to.plusDays(1) : LocalDate.of(2999, 12, 31)).atStartOfDay();
        Page<InvestmentTransaction> page = type == null
                ? transactionRepository.findByInvestmentIdInAndTradeDateBetween(investmentIds, fromDate, toDate, pageable)
                : transactionRepository.findByInvestmentIdInAndTradeTypeAndTradeDateBetween(
                        investmentIds, type, fromDate, toDate, pageable);
        return page.map(InvestmentTransactionResponse::from);
    }

    public List<InvestmentActivityResponse> getUserActivities(
            String userId, LocalDate from, LocalDate to) {
        LocalDate rangeFrom = from != null ? from : LocalDate.now().withDayOfMonth(1);
        LocalDate rangeTo = to != null ? to : rangeFrom.plusMonths(1);
        if (!rangeTo.isAfter(rangeFrom)) {
            throw badRequest("투자 거래 조회 종료일은 시작일보다 뒤여야 합니다.");
        }

        List<Investment> investments = investmentRepository.findByUserIdOrderBySymbolNameAsc(userId);
        if (investments.isEmpty()) return List.of();

        Map<String, Investment> investmentMap = investments.stream()
                .collect(Collectors.toMap(Investment::getInvestmentId, Function.identity()));
        Map<String, Account> accountMap = accountRepository.findByUserIdOrderByDisplayOrderAsc(userId).stream()
                .collect(Collectors.toMap(Account::getAccountId, Function.identity()));

        return transactionRepository
                .findByInvestmentIdInAndTradeDateGreaterThanEqualAndTradeDateLessThanOrderByTradeDateDesc(
                        new ArrayList<>(investmentMap.keySet()), rangeFrom.atStartOfDay(), rangeTo.atStartOfDay())
                .stream()
                .map(transaction -> {
                    Investment investment = investmentMap.get(transaction.getInvestmentId());
                    Account account = investment == null ? null : accountMap.get(investment.getAccountId());
                    if (investment == null || account == null) return null;
                    return InvestmentActivityResponse.from(
                            transaction, investment, account.getAccountName(), account.getCurrency());
                })
                .filter(Objects::nonNull)
                .toList();
    }

    private void syncMissingTransferHistory(Account account, String userId) {
        List<Transaction> transfers = ledgerTransactionRepository
                .findByAccountIdAndUserIdOrderByTransactionDateDesc(account.getAccountId(), userId).stream()
                .filter(item -> item.getTransactionType() == TransactionType.TRANSFER)
                .filter(item -> item.getTransactionId() != null)
                .filter(item -> transactionRepository.findFirstByTransactionId(item.getTransactionId()).isEmpty())
                .toList();
        if (transfers.isEmpty()) return;

        Investment cashHolding = getOrCreateCashHolding(account, userId);
        transfers.forEach(item -> {
            InvestmentTradeType tradeType = item.getTransferDirection() == TransferDirection.IN
                    ? InvestmentTradeType.DEPOSIT : InvestmentTradeType.WITHDRAWAL;
            BigDecimal amount = zeroIfNull(item.getAmount()).abs();
            transactionRepository.save(InvestmentTransaction.builder()
                    .investmentId(cashHolding.getInvestmentId())
                    .transactionId(item.getTransactionId())
                    .tradeType(tradeType)
                    .tradeDate(item.getTransactionDate())
                    .grossAmount(amount)
                    .netAmount(tradeType == InvestmentTradeType.DEPOSIT ? amount : amount.negate())
                    .currency(account.getCurrency())
                    .exchangeRate(BigDecimal.ONE)
                    .memo(item.getMemo())
                    .build());
        });
    }

    public boolean isPriceProviderConfigured() {
        return marketPriceProvider.isConfigured();
    }

    public String getPriceProviderName() {
        return marketPriceProvider.providerName();
    }

    private InvestmentDetailResponse buildDetail(Account account, InvestmentAccountProfile profile, String userId) {
        List<Investment> allInvestments = investmentRepository
                .findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(account.getAccountId(), userId);
        List<Investment> marketInvestments = allInvestments.stream()
                .filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH).toList();
        List<String> ids = allInvestments.stream().map(Investment::getInvestmentId).toList();

        BigDecimal marketValue = marketInvestments.stream().map(Investment::getCachedMarketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal principal = marketInvestments.stream()
                .map(item -> item.getCachedQuantity().multiply(item.getCachedAvgBuyPriceBase()))
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cash = zeroIfNull(account.getCachedBookBalance());
        BigDecimal total = marketValue.add(cash);
        BigDecimal unrealized = marketValue.subtract(principal);
        BigDecimal returnRate = percentage(unrealized, principal);

        LocalDate today = LocalDate.now();
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonth = today.withDayOfMonth(1).plusMonths(1).atStartOfDay();
        BigDecimal dividend = ids.isEmpty() ? BigDecimal.ZERO
                : transactionRepository.sumDividendBetween(ids, InvestmentTradeType.DIVIDEND, monthStart, nextMonth);
        BigDecimal realized = ids.isEmpty() ? BigDecimal.ZERO
                : transactionRepository.sumRealizedProfitLoss(ids, InvestmentTradeType.SELL);

        List<InvestmentDetailResponse.Holding> holdings = marketInvestments.stream()
                .map(item -> toHolding(item, total)).collect(Collectors.toCollection(ArrayList::new));
        holdings.add(cashHolding(account, total));

        Map<InvestmentAssetClass, BigDecimal> amounts = allocationAmounts(marketInvestments, cash);
        List<InvestmentDetailResponse.Allocation> allocations = Arrays.stream(InvestmentAssetClass.values())
                .map(asset -> new InvestmentDetailResponse.Allocation(asset,
                        amounts.getOrDefault(asset, BigDecimal.ZERO),
                        percentage(amounts.getOrDefault(asset, BigDecimal.ZERO), total)))
                .toList();
        List<InvestmentDetailResponse.TargetAllocation> targets = buildTargetAllocations(account, userId);
        List<InvestmentDetailResponse.RebalancingAlert> alerts = targets.stream()
                .filter(target -> target.difference().abs().compareTo(ALERT_THRESHOLD) >= 0)
                .map(target -> new InvestmentDetailResponse.RebalancingAlert(
                        target.assetClass(),
                        assetLabel(target.assetClass()) + " 비중이 목표 대비 " + signed(target.difference()) + "%",
                        target.difference().signum() > 0 ? "목표보다 높은 비중입니다. 일부 조정을 검토해 보세요."
                                : "목표보다 낮은 비중입니다. 추가 편입을 검토해 보세요.",
                        target.difference()))
                .toList();

        List<InvestmentDetailResponse.TrendPoint> trend = accountSnapshotRepository
                .findTop7ByAccountIdOrderBySnapshotDateDesc(account.getAccountId()).stream()
                .sorted(Comparator.comparing(InvestmentAccountSnapshot::getSnapshotDate))
                .map(value -> new InvestmentDetailResponse.TrendPoint(value.getSnapshotDate(), value.getTotalAssetValue()))
                .collect(Collectors.toCollection(ArrayList::new));
        if (trend.stream().noneMatch(point -> point.date().equals(today))) {
            trend.add(new InvestmentDetailResponse.TrendPoint(today, total));
        }

        BigDecimal monthlyReturn = calculateMonthlyReturn(account.getAccountId(), total, today);
        BigDecimal annualizedReturn = annualizeMonthlyReturn(monthlyReturn);
        List<InvestmentTransactionResponse> recent = ids.isEmpty() ? List.of()
                : transactionRepository.findTop10ByInvestmentIdInOrderByTradeDateDesc(ids)
                .stream().map(InvestmentTransactionResponse::from).toList();
        List<InvestmentDetailResponse.Note> notes = noteRepository
                .findTop10ByAccountIdAndUserIdOrderByIsPinnedDescUpdatedAtDesc(account.getAccountId(), userId)
                .stream().map(this::toNote).toList();

        return new InvestmentDetailResponse(
                AccountResponse.from(account), toProfile(profile),
                new InvestmentDetailResponse.Summary(total, principal, unrealized, returnRate, cash, dividend),
                holdings, allocations, targets, trend, recent,
                new InvestmentDetailResponse.Performance(monthlyReturn, annualizedReturn, realized, unrealized, dividend),
                alerts, notes);
    }

    private List<InvestmentDetailResponse.TargetAllocation> buildTargetAllocations(Account account, String userId) {
        List<Investment> investments = investmentRepository
                .findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(account.getAccountId(), userId)
                .stream().filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH).toList();
        BigDecimal cash = zeroIfNull(account.getCachedBookBalance());
        BigDecimal total = calculateTotalAsset(account, investments);
        Map<InvestmentAssetClass, BigDecimal> amounts = allocationAmounts(investments, cash);
        Map<InvestmentAssetClass, InvestmentTargetAllocation> targets = targetRepository
                .findByAccountIdAndUserId(account.getAccountId(), userId).stream()
                .collect(Collectors.toMap(InvestmentTargetAllocation::getAssetClass, Function.identity()));
        return Arrays.stream(InvestmentAssetClass.values()).map(asset -> {
            BigDecimal target = Optional.ofNullable(targets.get(asset))
                    .map(InvestmentTargetAllocation::getTargetRatio).orElse(BigDecimal.ZERO);
            BigDecimal current = percentage(amounts.getOrDefault(asset, BigDecimal.ZERO), total);
            return new InvestmentDetailResponse.TargetAllocation(asset, target, current, current.subtract(target));
        }).toList();
    }

    private void saveTodaySnapshot(Account account, String userId) {
        List<Investment> investments = investmentRepository
                .findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(account.getAccountId(), userId);
        List<Investment> marketInvestments = investments.stream()
                .filter(item -> item.getAssetClass() != InvestmentAssetClass.CASH).toList();
        List<String> ids = investments.stream().map(Investment::getInvestmentId).toList();
        BigDecimal market = marketInvestments.stream().map(Investment::getCachedMarketValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal principal = marketInvestments.stream()
                .map(item -> item.getCachedQuantity().multiply(item.getCachedAvgBuyPriceBase()))
                .reduce(BigDecimal.ZERO, BigDecimal::add).setScale(2, RoundingMode.HALF_UP);
        BigDecimal cash = zeroIfNull(account.getCachedBookBalance());
        LocalDate today = LocalDate.now();
        LocalDateTime monthStart = today.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonth = today.withDayOfMonth(1).plusMonths(1).atStartOfDay();
        BigDecimal realized = ids.isEmpty() ? BigDecimal.ZERO
                : transactionRepository.sumRealizedProfitLoss(ids, InvestmentTradeType.SELL);
        BigDecimal dividend = ids.isEmpty() ? BigDecimal.ZERO
                : transactionRepository.sumDividendBetween(ids, InvestmentTradeType.DIVIDEND, monthStart, nextMonth);
        InvestmentAccountSnapshot snapshot = accountSnapshotRepository
                .findByAccountIdAndSnapshotDate(account.getAccountId(), today)
                .orElseGet(() -> InvestmentAccountSnapshot.builder()
                        .userId(userId).accountId(account.getAccountId()).snapshotDate(today)
                        .totalAssetValue(BigDecimal.ZERO).investedPrincipal(BigDecimal.ZERO)
                        .cashBalance(BigDecimal.ZERO).marketValue(BigDecimal.ZERO)
                        .realizedProfitLoss(BigDecimal.ZERO).unrealizedProfitLoss(BigDecimal.ZERO)
                        .dividendIncome(BigDecimal.ZERO).build());
        snapshot.updateValues(market.add(cash), principal, cash, market, realized, market.subtract(principal), dividend);
        accountSnapshotRepository.save(snapshot);
    }

    private void savePriceSnapshot(Investment investment, BigDecimal price, BigDecimal exchangeRate,
                                   LocalDateTime quotedAt, String source) {
        priceSnapshotRepository.save(InvestmentPriceSnapshot.builder()
                .investmentId(investment.getInvestmentId()).price(price).currency(investment.getCurrency())
                .exchangeRate(exchangeRate).quotedAt(quotedAt).source(source).build());
    }

    private Investment resolveTradeInvestment(Account account, String userId, InvestmentTradeRequest request) {
        if (request.tradeType() == InvestmentTradeType.DEPOSIT || request.tradeType() == InvestmentTradeType.WITHDRAWAL) {
            return getOrCreateCashHolding(account, userId);
        }
        if (request.investmentId() == null || request.investmentId().isBlank()) {
            if (request.tradeType() != InvestmentTradeType.BUY) {
                throw badRequest("매도·배당 거래에는 기존 보유 종목 ID가 필요합니다.");
            }
            if (request.tickerCode() == null || request.tickerCode().isBlank()) {
                throw badRequest("신규 종목 매수에는 종목 코드가 필요합니다.");
            }
            String tickerCode = request.tickerCode().trim().toUpperCase(Locale.ROOT);
            return investmentRepository.findByAccountIdAndUserIdAndTickerCode(account.getAccountId(), userId, tickerCode)
                    .orElseGet(() -> investmentRepository.save(Investment.builder()
                            .userId(userId)
                            .accountId(account.getAccountId())
                            .tickerCode(tickerCode)
                            .symbolName(request.symbolName() == null || request.symbolName().isBlank()
                                    ? tickerCode : request.symbolName().trim())
                            .assetClass(request.assetClass() != null ? request.assetClass()
                                    : request.currency() == Currency.KRW
                                    ? InvestmentAssetClass.DOMESTIC_STOCK : InvestmentAssetClass.FOREIGN_STOCK)
                            .market(request.market())
                            .currency(request.currency() != null ? request.currency() : account.getCurrency())
                            .build()));
        }
        Investment investment = requireInvestment(request.investmentId(), userId);
        if (!investment.getAccountId().equals(account.getAccountId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "다른 투자 계좌의 종목입니다.");
        }
        return investment;
    }

    private boolean matchesMarketGroup(Currency currency, String marketGroup) {
        if (marketGroup == null || marketGroup.isBlank() || marketGroup.equals("ALL")) return true;
        return (marketGroup.equals("US") && currency == Currency.USD)
                || (marketGroup.equals("JP") && currency == Currency.JPY)
                || (marketGroup.equals("KR") && currency == Currency.KRW);
    }

    private String symbolIdentity(String tickerCode, String market) {
        return (market == null ? "" : market.trim().toUpperCase(Locale.ROOT)) + ":"
                + tickerCode.trim().toUpperCase(Locale.ROOT);
    }

    private Investment getOrCreateCashHolding(Account account, String userId) {
        return investmentRepository.findByAccountIdAndUserIdAndTickerCode(account.getAccountId(), userId, CASH_TICKER)
                .orElseGet(() -> investmentRepository.save(Investment.builder()
                        .userId(userId).accountId(account.getAccountId()).tickerCode(CASH_TICKER)
                        .symbolName("예수금").assetClass(InvestmentAssetClass.CASH)
                        .market("CASH").currency(account.getCurrency()).build()));
    }

    private InvestmentAccountProfile getOrCreateProfile(String accountId) {
        return profileRepository.findById(accountId).orElseGet(() -> profileRepository.save(
                InvestmentAccountProfile.builder().accountId(accountId)
                        .syncProvider(marketPriceProvider.providerName()).build()));
    }

    private Account requireInvestmentAccount(String accountId, String userId) {
        Account account = accountRepository.findByAccountIdAndUserId(accountId, userId)
                .orElseThrow(() -> notFound("투자 계좌를 찾을 수 없습니다."));
        if (account.getAccountType() != AccountType.INVESTMENT) {
            throw badRequest("INVESTMENT 유형 계좌에서만 사용할 수 있는 기능입니다.");
        }
        return account;
    }

    private Investment requireInvestment(String investmentId, String userId) {
        return investmentRepository.findByInvestmentIdAndUserId(investmentId, userId)
                .orElseThrow(() -> notFound("보유 종목을 찾을 수 없습니다."));
    }

    private List<String> investmentIds(String accountId, String userId) {
        return investmentRepository.findByAccountIdAndUserIdAndIsActiveTrueOrderBySymbolNameAsc(accountId, userId)
                .stream().map(Investment::getInvestmentId).toList();
    }

    private InvestmentDetailResponse.Holding toHolding(Investment item, BigDecimal totalAsset) {
        BigDecimal principal = item.getCachedQuantity().multiply(item.getCachedAvgBuyPriceBase());
        BigDecimal profit = item.getCachedMarketValue().subtract(principal);
        BigDecimal localMarketValue = item.getCachedQuantity().multiply(item.getCachedCurrentPrice());
        BigDecimal localPrincipal = item.getCachedQuantity().multiply(item.getCachedAvgBuyPrice());
        return new InvestmentDetailResponse.Holding(
                item.getInvestmentId(), item.getTickerCode(), item.getSymbolName(), item.getAssetClass(),
                item.getMarket(), item.getCurrency(), item.getCachedQuantity(), item.getCachedAvgBuyPrice(),
                item.getCachedAvgBuyPriceBase(), item.getCachedCurrentPrice(), item.getCachedExchangeRate(),
                localMarketValue, localMarketValue.subtract(localPrincipal),
                item.getCachedMarketValue(), profit, percentage(profit, principal),
                percentage(item.getCachedMarketValue(), totalAsset), item.getPriceUpdatedAt());
    }

    private InvestmentDetailResponse.Holding cashHolding(Account account, BigDecimal totalAsset) {
        BigDecimal cash = zeroIfNull(account.getCachedBookBalance());
        return new InvestmentDetailResponse.Holding(
                null, CASH_TICKER, "예수금", InvestmentAssetClass.CASH, "CASH", account.getCurrency(),
                BigDecimal.ONE, cash, cash, cash, BigDecimal.ONE, cash, BigDecimal.ZERO,
                cash, BigDecimal.ZERO, BigDecimal.ZERO,
                percentage(cash, totalAsset), account.getBalanceUpdatedAt());
    }

    private InvestmentDetailResponse.Profile toProfile(InvestmentAccountProfile profile) {
        return new InvestmentDetailResponse.Profile(profile.getIsPrimary(), profile.getAutoSyncEnabled(),
                profile.getSyncStatus(), profile.getSyncProvider(), profile.getLastSyncedAt());
    }

    private InvestmentDetailResponse.Note toNote(InvestmentNote note) {
        return new InvestmentDetailResponse.Note(note.getNoteId(), note.getTitle(), note.getContent(),
                note.getIsPinned(), note.getUpdatedAt());
    }

    private Map<InvestmentAssetClass, BigDecimal> allocationAmounts(List<Investment> investments, BigDecimal cash) {
        Map<InvestmentAssetClass, BigDecimal> amounts = investments.stream().collect(Collectors.groupingBy(
                Investment::getAssetClass,
                () -> new EnumMap<>(InvestmentAssetClass.class),
                Collectors.reducing(BigDecimal.ZERO, Investment::getCachedMarketValue, BigDecimal::add)));
        amounts.put(InvestmentAssetClass.CASH, cash);
        return amounts;
    }

    private BigDecimal calculateTotalAsset(Account account, List<Investment> investments) {
        return investments.stream().map(Investment::getCachedMarketValue).reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(zeroIfNull(account.getCachedBookBalance()));
    }

    private BigDecimal calculateMonthlyReturn(String accountId, BigDecimal currentTotal, LocalDate today) {
        return accountSnapshotRepository.findTop7ByAccountIdOrderBySnapshotDateDesc(accountId).stream()
                .filter(value -> !value.getSnapshotDate().isBefore(today.withDayOfMonth(1)))
                .min(Comparator.comparing(InvestmentAccountSnapshot::getSnapshotDate))
                .map(value -> percentage(currentTotal.subtract(value.getTotalAssetValue()), value.getTotalAssetValue()))
                .orElse(BigDecimal.ZERO);
    }

    private BigDecimal annualizeMonthlyReturn(BigDecimal monthlyReturnPercent) {
        if (monthlyReturnPercent.compareTo(new BigDecimal("-100")) <= 0) {
            return BigDecimal.ZERO;
        }
        double periodFactor = BigDecimal.ONE.add(monthlyReturnPercent.divide(ONE_HUNDRED, 8, RoundingMode.HALF_UP)).doubleValue();
        double annualized = (Math.pow(periodFactor, 12.0) - 1.0) * 100.0;
        return BigDecimal.valueOf(annualized).setScale(2, RoundingMode.HALF_UP);
    }

    private InvestmentFeeSettingResponse toFeeSettingResponse(
            InvestmentFeeSetting setting, InvestmentMarketGroup market) {
        if (setting == null) {
            return new InvestmentFeeSettingResponse(
                    market, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
        }
        return new InvestmentFeeSettingResponse(setting.getMarketGroup(), setting.getBuyFeeRate(),
                setting.getSellFeeRate(), setting.getSellTaxRate(), setting.getDividendTaxRate());
    }

    private TradeCosts resolveTradeCosts(
            String accountId, String userId, Investment investment, InvestmentTradeType tradeType,
            BigDecimal gross, InvestmentTradeRequest request) {
        if (!Boolean.TRUE.equals(request.applyFeeSettings())) {
            return new TradeCosts(zeroIfNull(request.feeAmount()), zeroIfNull(request.taxAmount()));
        }
        InvestmentMarketGroup market = marketGroup(investment.getCurrency());
        Optional<InvestmentFeeSetting> setting = feeSettingRepository
                .findByAccountIdAndUserIdAndMarketGroup(accountId, userId, market);
        if (setting.isEmpty()) return new TradeCosts(BigDecimal.ZERO, BigDecimal.ZERO);

        BigDecimal feeRate = switch (tradeType) {
            case BUY -> setting.get().getBuyFeeRate();
            case SELL -> setting.get().getSellFeeRate();
            default -> BigDecimal.ZERO;
        };
        BigDecimal taxRate = switch (tradeType) {
            case SELL -> setting.get().getSellTaxRate();
            case DIVIDEND -> setting.get().getDividendTaxRate();
            default -> BigDecimal.ZERO;
        };
        return new TradeCosts(rateAmount(gross, feeRate), rateAmount(gross, taxRate));
    }

    private InvestmentMarketGroup marketGroup(Currency currency) {
        return switch (currency) {
            case USD -> InvestmentMarketGroup.US;
            case JPY -> InvestmentMarketGroup.JP;
            default -> InvestmentMarketGroup.KR;
        };
    }

    private BigDecimal rateAmount(BigDecimal amount, BigDecimal percentRate) {
        return amount.multiply(zeroIfNull(percentRate))
                .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal resolveExchangeRate(
            Currency transactionCurrency, Currency accountCurrency, BigDecimal requestedRate) {
        if (transactionCurrency == accountCurrency) return BigDecimal.ONE;
        if (requestedRate != null && requestedRate.signum() > 0) return requestedRate;
        return marketPriceProvider.getExchangeRate(transactionCurrency, accountCurrency)
                .orElseThrow(() -> badRequest("거래 통화를 계좌 통화로 환산할 환율이 필요합니다."));
    }

    private void ensureCash(Account account, BigDecimal required) {
        if (zeroIfNull(account.getCachedBookBalance()).compareTo(required) < 0) {
            throw badRequest("예수금이 부족합니다. 현재 예수금: " + account.getCachedBookBalance());
        }
    }

    private void ensureFeesDoNotExceedAmount(BigDecimal gross, BigDecimal fee, BigDecimal tax) {
        if (gross.compareTo(fee.add(tax)) < 0) throw badRequest("수수료와 세금이 거래 금액보다 클 수 없습니다.");
    }

    private BigDecimal requireAmount(BigDecimal amount, String label) {
        requirePositive(zeroIfNull(amount), label);
        return amount;
    }

    private void requirePositive(BigDecimal value, String label) {
        if (value == null || value.signum() <= 0) throw badRequest(label + "은(는) 0보다 커야 합니다.");
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BigDecimal percentage(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.signum() == 0) return BigDecimal.ZERO.setScale(2);
        return numerator.multiply(ONE_HUNDRED).divide(denominator, 2, RoundingMode.HALF_UP);
    }

    private String signed(BigDecimal value) {
        return value.signum() > 0 ? "+" + value.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP).toString();
    }

    private String assetLabel(InvestmentAssetClass assetClass) {
        return switch (assetClass) {
            case INDEX_ETF -> "지수 ETF";
            case DOMESTIC_STOCK -> "개별주(국내)";
            case FOREIGN_STOCK -> "개별주(해외)";
            case DIVIDEND_ASSET -> "배당주/ETF";
            case CASH -> "현금/예수금";
        };
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private ResponseStatusException conflict(String message) {
        return new ResponseStatusException(HttpStatus.CONFLICT, message);
    }

    private record TradeCosts(BigDecimal fee, BigDecimal tax) {
    }
}
