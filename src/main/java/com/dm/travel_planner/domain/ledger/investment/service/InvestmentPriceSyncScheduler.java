package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentAccountProfileRepository;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvestmentPriceSyncScheduler {
    private final InvestmentService investmentService;
    private final InvestmentAccountProfileRepository profileRepository;
    private final AccountRepository accountRepository;

    @Scheduled(
            initialDelayString = "${market-data.sync-initial-delay-ms:60000}",
            fixedDelayString = "${market-data.sync-delay-ms:3600000}")
    public void synchronizeEnabledAccounts() {
        if (!investmentService.isPriceProviderConfigured()) return;
        profileRepository.findByAutoSyncEnabledTrue().forEach(profile ->
                accountRepository.findById(profile.getAccountId()).ifPresent(account -> {
                    try {
                        investmentService.syncPrices(account.getAccountId(), account.getUserId());
                    } catch (RuntimeException exception) {
                        log.warn("투자 계좌 가격 자동 동기화 실패 - accountId: {}", account.getAccountId(), exception);
                    }
                }));
    }
}
