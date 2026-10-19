package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.*;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentTaxRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class InvestmentTaxServiceTest {
    @Mock InvestmentTaxRecordRepository records;
    @Mock AccountRepository accounts;
    @InjectMocks InvestmentTaxService service;
    InvestmentTaxService.Edit edit(String country,InvestmentTaxAccountType type,Long version){return new InvestmentTaxService.Edit("JP",country,type,"REVIEW",com.dm.travel_planner.domain.ledger.entity.Currency.JPY,new BigDecimal("-1200"),new BigDecimal("50"),BigDecimal.ZERO,"報告書を確認",version);}
    void owner(){when(accounts.findByAccountIdAndUserId("a","u")).thenReturn(Optional.of(Account.builder().accountId("a").accountType(AccountType.INVESTMENT).build()));}
    @Test void rejectsOtherUsersAccount(){when(accounts.findByAccountIdAndUserId("a","u")).thenReturn(Optional.empty());assertThatThrownBy(()->service.save("u",2026,"a",edit("JP",InvestmentTaxAccountType.GENERAL,null))).hasMessageContaining("404");verifyNoInteractions(records);}
    @Test void rejectsStaleConfirmation(){owner();var record=new InvestmentTaxRecord();record.setVersion(2L);when(records.findById("u:2026:a")).thenReturn(Optional.of(record));assertThatThrownBy(()->service.save("u",2026,"a",edit("JP",InvestmentTaxAccountType.GENERAL,1L))).hasMessageContaining("409");verify(records,never()).saveAndFlush(any());}
    @Test void savesNegativeProfitWithoutTreatingItAsTaxExemption(){owner();when(records.findById("u:2026:a")).thenReturn(Optional.empty());when(records.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));var saved=service.save("u",2026,"a",edit("JP",InvestmentTaxAccountType.NISA,null));assertThat(saved.getConfirmedProfit()).isEqualByComparingTo("-1200");assertThat(saved.getFilingStatus()).isEqualTo("REVIEW");assertThat(saved.getResidence()).isNull();assertThat(saved.getAdditionalTax()).isEqualByComparingTo("50");}
    @Test void annualResidenceIsSeparateFromAccountSettings(){when(records.findById("u:2025:year")).thenReturn(Optional.empty());when(records.saveAndFlush(any())).thenAnswer(i->i.getArgument(0));var saved=service.save("u",2025,null,edit("JP",InvestmentTaxAccountType.GENERAL,null));assertThat(saved.getResidence()).isEqualTo("JP");assertThat(saved.getAccountId()).isNull();assertThat(saved.getAccountType()).isNull();verifyNoInteractions(accounts);}
    @Test void rejectsJapaneseTypeOnKoreanAccount(){owner();assertThatThrownBy(()->service.save("u",2026,"a",edit("KR",InvestmentTaxAccountType.NISA,null))).hasMessageContaining("400");verifyNoInteractions(records);}
    @Test void rejectsInvalidYear(){assertThatThrownBy(()->service.get("u",2201)).hasMessageContaining("400");verifyNoInteractions(records);}
}
