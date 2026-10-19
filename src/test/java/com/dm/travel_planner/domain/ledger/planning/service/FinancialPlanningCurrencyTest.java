package com.dm.travel_planner.domain.ledger.planning.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.planning.dto.*;
import com.dm.travel_planner.domain.ledger.planning.entity.*;
import com.dm.travel_planner.domain.ledger.planning.repository.*;
import com.dm.travel_planner.domain.ledger.repository.*;
import com.dm.travel_planner.domain.ledger.service.AccountTransferService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FinancialPlanningCurrencyTest {
    @Mock MonthlyFinancialPlanRepository planRepository;
    @Mock LedgerCategoryBudgetRepository budgetRepository;
    @Mock FinancialGoalRepository goalRepository;
    @Mock GoalContributionRepository contributionRepository;
    @Mock TransactionRepository transactionRepository;
    @Mock FixedExpenseRepository fixedExpenseRepository;
    @Mock AccountRepository accountRepository;
    @Mock AccountTransferService accountTransferService;
    @InjectMocks FinancialPlanningService service;
    BigDecimal n(String value) { return new BigDecimal(value); }
    Transaction tx(Currency currency, TransactionType type, String value) {
        return Transaction.builder().userId("u").currency(currency).transactionType(type).amount(n(value))
                .categoryId("식비 · 카페").memo("수기 입력").transactionDate(LocalDateTime.of(2026,10,20,12,0)).build();
    }
    FinancialGoal goal(String currency) {
        return FinancialGoal.builder().goalId("g").userId("u").currency(currency).title("여행")
                .targetAmount(n("10000")).currentAmount(n("100")).build();
    }
    FinancialGoalRequest request(String currency, String account) {
        return new FinancialGoalRequest("여행",null,"TRAVEL",n("10000"),n("0"),n("1000"),null,1,account,null,currency);
    }
    Account account(String id, Currency currency) {
        return Account.builder().accountId(id).userId("u").accountName(id).currency(currency).accountType(AccountType.CHECKING).isActive(true).build();
    }
    @Test void yenExpenseIs860YenAndDoesNotIncludeWonOrDollars() {
        when(transactionRepository.findByUserIdAndTransactionDateGreaterThanEqualAndTransactionDateLessThanOrderByTransactionDateDesc(eq("u"),any(),any()))
                .thenReturn(List.of(tx(Currency.JPY,TransactionType.EXPENSE,"860"),tx(Currency.KRW,TransactionType.EXPENSE,"10000"),tx(Currency.USD,TransactionType.EXPENSE,"20"),
                        tx(Currency.JPY,TransactionType.INCOME,"200000"),tx(Currency.KRW,TransactionType.INCOME,"3000000")));
        when(budgetRepository.findByUserIdAndTargetMonthAndCurrencyOrderByCategoryNameAsc("u","2026-10","JPY"))
                .thenReturn(List.of(LedgerCategoryBudget.builder().categoryName("식비 · 카페").currency("JPY").budgetAmount(n("1000")).build()));
        when(fixedExpenseRepository.findByUserIdAndIsActiveTrueOrderByNextPaymentDateAsc("u"))
                .thenReturn(List.of(FixedExpense.builder().currency(Currency.JPY).amount(n("500")).build(),FixedExpense.builder().currency(Currency.KRW).amount(n("90000")).build()));
        var result=service.getDashboard("u","2026-10","JPY");
        assertThat(result.currency()).isEqualTo("JPY");
        assertThat(result.actualExpense()).isEqualByComparingTo("860");
        assertThat(result.actualIncome()).isEqualByComparingTo("200000");
        assertThat(result.fixedExpenseAmount()).isEqualByComparingTo("500");
        assertThat(result.categoryBudgetTotal()).isEqualByComparingTo("1000");
        assertThat(result.categoryBudgets()).hasSize(1);
        assertThat(result.categoryBudgets().getFirst().categoryName()).isEqualTo("식비 · 카페");
        assertThat(result.categoryBudgets().getFirst().remainingAmount()).isEqualByComparingTo("140");
        assertThat(result.categoryBudgets().getFirst().usageRate()).isEqualByComparingTo("86");
    }
    @Test void eachCurrencyReadsItsOwnPlanAndGoals() {
        when(goalRepository.findByUserIdAndStatusNotOrderByPriorityAscCreatedAtDesc("u","ARCHIVED")).thenReturn(List.of(goal("KRW"),goal("JPY"),goal("USD")));
        for(String currency:List.of("KRW","JPY","USD")) {
            when(planRepository.findByUserIdAndTargetMonthAndCurrency("u","2026-10",currency))
                    .thenReturn(Optional.of(MonthlyFinancialPlan.builder().currency(currency).expectedIncome(n("123" )).build()));
            var result=service.getDashboard("u","2026-10",currency);
            assertThat(result.expectedIncome()).isEqualByComparingTo("123");
            assertThat(result.goals()).extracting(FinancialGoalResponse::currency).containsExactly(currency);
        }
    }
    @Test void yenSavingDoesNotOverwriteWonPlan() {
        service.saveMonthlyPlan("u",new MonthlyPlanRequest("2026-10",n("200000"),n("1000"),null,null,"yen","JPY"));
        var capture=ArgumentCaptor.forClass(MonthlyFinancialPlan.class);verify(planRepository).save(capture.capture());
        assertThat(capture.getValue().getCurrency()).isEqualTo("JPY");
        verify(planRepository,never()).findByUserIdAndTargetMonthAndCurrency("u","2026-10","KRW");
    }
    @Test void budgetReplacementOnlyDeletesSelectedCurrency() {
        service.replaceCategoryBudgets("u",new CategoryBudgetsRequest("2026-10",List.of(new CategoryBudgetsRequest.CategoryBudgetInput("식비",n("30000"))),"JPY"));
        verify(budgetRepository).deleteByUserIdAndTargetMonthAndCurrency("u","2026-10","JPY");
        verify(budgetRepository,never()).deleteByUserIdAndTargetMonthAndCurrency(any(),any(),eq("KRW"));
        verify(budgetRepository).saveAll(argThat(rows->{var row=rows.iterator().next();return row.getCurrency().equals("JPY")&&row.getBudgetAmount().compareTo(n("30000"))==0;}));
    }
    @Test void legacyRequestDefaultsToWon() {
        service.saveMonthlyPlan("u",new MonthlyPlanRequest("2026-10",n("1"),null,null,null,null,null));
        verify(planRepository).save(argThat(plan->plan.getCurrency().equals("KRW")));
    }
    @Test void yenGoalRetainsCurrencyAndOnlyAcceptsYenAccount() {
        when(accountRepository.findByAccountIdAndUserId("j","u")).thenReturn(Optional.of(account("j",Currency.JPY)));
        when(goalRepository.save(any())).thenAnswer(i->i.getArgument(0));
        assertThat(service.createGoal("u",request("JPY","j")).currency()).isEqualTo("JPY");
        when(accountRepository.findByAccountIdAndUserId("k","u")).thenReturn(Optional.of(account("k",Currency.KRW)));
        assertThatThrownBy(()->service.createGoal("u",request("JPY","k"))).hasMessageContaining("같은 통화");
        verify(goalRepository,times(1)).save(any());
    }
    @Test void existingGoalCurrencyCannotBeReinterpreted() {
        var goal=goal("KRW");when(goalRepository.findByGoalIdAndUserId("g","u")).thenReturn(Optional.of(goal));
        assertThatThrownBy(()->service.updateGoal("u","g",request("JPY",null))).hasMessageContaining("통화는 변경할 수 없습니다");
        assertThat(goal.getCurrency()).isEqualTo("KRW");
    }
    @Test void oldUpdateRequestPreservesYenGoalCurrency() {
        when(goalRepository.findByGoalIdAndUserId("g","u")).thenReturn(Optional.of(goal("JPY")));
        assertThat(service.updateGoal("u","g",request(null,null)).currency()).isEqualTo("JPY");
    }
    @Test void mismatchedContributionCannotMoveMoney() {
        var goal=FinancialGoal.builder().goalId("g").userId("u").currency("JPY").linkedAccountId("j").targetAmount(n("10000")).build();
        when(goalRepository.findByGoalIdAndUserId("g","u")).thenReturn(Optional.of(goal));
        when(accountRepository.findByAccountIdAndUserId("k","u")).thenReturn(Optional.of(account("k",Currency.KRW)));
        assertThatThrownBy(()->service.addContribution("u","g",new GoalContributionRequest(n("100"),"k",null,null))).hasMessageContaining("같은 통화");
        verifyNoInteractions(accountTransferService,contributionRepository);
        assertThat(goal.getCurrentAmount()).isEqualByComparingTo("0");
    }
    @Test void unsupportedCurrencyRejected() {assertThatThrownBy(()->service.getDashboard("u","2026-10","EUR")).hasMessageContaining("지원하지 않는 계획 통화");}
}
