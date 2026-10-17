package com.dm.travel_planner.domain.ledger.foreign.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.foreign.dto.ForeignCurrencyDetailResponse;
import com.dm.travel_planner.domain.ledger.foreign.entity.*;
import com.dm.travel_planner.domain.ledger.foreign.repository.ForeignCurrencyTransactionRepository;
import com.dm.travel_planner.domain.ledger.investment.price.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ForeignCurrencyServiceTest {
    @Mock AccountRepository accountRepository;
    @Mock ForeignCurrencyTransactionRepository transactionRepository;
    @Mock MarketPriceProvider marketPriceProvider;
    @InjectMocks ForeignCurrencyService service;

    @Test
    void calculatesWeightedAverageCostAndRealizedExchangeProfit() {
        Account account = Account.builder()
                .accountId("fx-1")
                .userId("user-1")
                .accountName("달러 통장")
                .accountType(AccountType.FOREIGN_CURRENCY)
                .accountPurpose(AccountPurpose.FOREIGN_SAVINGS)
                .currency(Currency.USD)
                .initialBalance(new BigDecimal("1000"))
                .initialExchangeRate(new BigDecimal("1300"))
                .cachedBookBalance(new BigDecimal("900"))
                .build();
        ForeignCurrencyTransaction deposit = ForeignCurrencyTransaction.builder()
                .transactionId("deposit-1")
                .userId("user-1").accountId("fx-1")
                .transactionDate(LocalDateTime.now().minusDays(2))
                .transactionType(ForeignTransactionType.DEPOSIT)
                .purpose("EXCHANGE_DEPOSIT").title("추가 환전")
                .amount(new BigDecimal("100"))
                .currency(Currency.USD)
                .exchangeRate(new BigDecimal("1400"))
                .feeKrw(BigDecimal.ZERO).build();
        ForeignCurrencyTransaction withdrawal = ForeignCurrencyTransaction.builder()
                .transactionId("withdrawal-1")
                .userId("user-1").accountId("fx-1")
                .transactionDate(LocalDateTime.now().minusDays(1))
                .transactionType(ForeignTransactionType.WITHDRAWAL)
                .purpose("EXCHANGE_WITHDRAWAL").title("원화 환전")
                .amount(new BigDecimal("200"))
                .currency(Currency.USD)
                .exchangeRate(new BigDecimal("1500"))
                .feeKrw(BigDecimal.ZERO).build();

        when(accountRepository.findByAccountIdAndUserId("fx-1", "user-1")).thenReturn(Optional.of(account));
        when(transactionRepository.findByAccountIdAndUserIdOrderByTransactionDateAsc("fx-1", "user-1"))
                .thenReturn(List.of(deposit, withdrawal));
        when(marketPriceProvider.getExchangeRateQuote(any(Currency.class), any(Currency.class)))
                .thenAnswer(invocation -> {
                    Currency from = invocation.getArgument(0);
                    Currency to = invocation.getArgument(1);
                    if (from == Currency.USD && to == Currency.KRW) {
                        return Optional.of(new ExchangeRateQuote(from, to, new BigDecimal("1450"),
                                new BigDecimal("1440"), new BigDecimal("10"), new BigDecimal("0.6944"),
                                LocalDateTime.now(), "KIS"));
                    }
                    if (from == Currency.JPY && to == Currency.KRW) {
                        return Optional.of(new ExchangeRateQuote(from, to, new BigDecimal("9.2"),
                                new BigDecimal("9.1"), new BigDecimal("0.1"), new BigDecimal("1.0989"),
                                LocalDateTime.now(), "KIS"));
                    }
                    return Optional.empty();
                });

        ForeignCurrencyDetailResponse detail = service.getDetail("fx-1", "user-1");

        assertThat(detail.wallets()).extracting(ForeignCurrencyDetailResponse.WalletSummary::currency)
                .containsExactly(Currency.KRW, Currency.USD, Currency.JPY);
        var dollarWallet = detail.wallets().stream().filter(wallet -> wallet.currency() == Currency.USD)
                .findFirst().orElseThrow();
        assertThat(dollarWallet.balance()).isEqualByComparingTo("900");
        assertThat(dollarWallet.averageAcquisitionRate()).isEqualByComparingTo("1309.09091111");
        assertThat(dollarWallet.acquisitionCostKrw()).isEqualByComparingTo("1178181.82");
        assertThat(dollarWallet.valuationKrw()).isEqualByComparingTo("1305000.00");
        assertThat(dollarWallet.unrealizedExchangeProfit()).isEqualByComparingTo("126818.18");
        assertThat(detail.transactions().getFirst().realizedExchangeProfit()).isEqualByComparingTo("38181.82");
        assertThat(detail.rates()).anySatisfy(rate -> {
            assertThat(rate.baseCurrency()).isEqualTo(Currency.USD);
            assertThat(rate.quoteCurrency()).isEqualTo(Currency.JPY);
            assertThat(rate.rate()).isEqualByComparingTo("157.60869565");
        });
    }
}
