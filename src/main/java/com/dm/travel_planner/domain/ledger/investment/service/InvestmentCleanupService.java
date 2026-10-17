package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.investment.entity.Investment;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InvestmentCleanupService {
    private final InvestmentRepository investmentRepository;
    private final InvestmentTransactionRepository transactionRepository;
    private final InvestmentPriceSnapshotRepository priceSnapshotRepository;
    private final InvestmentTargetAllocationRepository targetRepository;
    private final InvestmentAccountSnapshotRepository accountSnapshotRepository;
    private final InvestmentNoteRepository noteRepository;
    private final InvestmentAccountProfileRepository profileRepository;
    private final InvestmentFeeSettingRepository feeSettingRepository;

    @Transactional
    public void deleteAccountData(String accountId, String userId) {
        List<String> investmentIds = investmentRepository
                .findByAccountIdAndUserId(accountId, userId)
                .stream().map(Investment::getInvestmentId).toList();
        if (!investmentIds.isEmpty()) {
            transactionRepository.deleteByInvestmentIdIn(investmentIds);
            priceSnapshotRepository.deleteByInvestmentIdIn(investmentIds);
        }
        targetRepository.deleteByAccountIdAndUserId(accountId, userId);
        accountSnapshotRepository.deleteByAccountIdAndUserId(accountId, userId);
        noteRepository.deleteByAccountIdAndUserId(accountId, userId);
        feeSettingRepository.deleteByAccountIdAndUserId(accountId, userId);
        profileRepository.deleteById(accountId);
        investmentRepository.deleteByAccountIdAndUserId(accountId, userId);
    }
}
