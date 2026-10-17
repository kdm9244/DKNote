package com.dm.travel_planner.domain.ledger.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.dm.travel_planner.domain.ledger.entity.Currency;

@Getter
@AllArgsConstructor
@Builder
public class AccountSummaryResponse {

    private List<AccountResponse> accounts;
    private int totalAccounts;
    private BigDecimal totalCachedBalance;
    private Map<Currency, BigDecimal> totalsByCurrency;

    public static AccountSummaryResponse from(List<AccountResponse> accounts) {
        BigDecimal totalBalance = accounts.stream()
                .map(AccountResponse::getCachedBookBalance)
                .filter(b -> b != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<Currency, BigDecimal> totalsByCurrency = accounts.stream().collect(
                java.util.stream.Collectors.groupingBy(
                        AccountResponse::getCurrency,
                        () -> new EnumMap<>(Currency.class),
                        java.util.stream.Collectors.reducing(
                                BigDecimal.ZERO,
                                account -> account.getCachedBookBalance() != null
                                        ? account.getCachedBookBalance() : BigDecimal.ZERO,
                                BigDecimal::add)));

        return AccountSummaryResponse.builder()
                .accounts(accounts)
                .totalAccounts(accounts.size())
                .totalCachedBalance(totalBalance)
                .totalsByCurrency(totalsByCurrency)
                .build();
    }
}
