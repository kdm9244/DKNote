package com.dm.travel_planner.domain.ledger.investment.service;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.TaxResidenceRepository;
import com.dm.travel_planner.domain.ledger.entity.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.time.LocalDate;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
@ExtendWith(MockitoExtension.class)
class TaxResidenceServiceTest {
 @Mock TaxResidenceRepository repository; @InjectMocks TaxResidenceService service;
 TaxResidence row(String country,String from){var r=new TaxResidence();r.setCountry(country);r.setEffectiveFrom(LocalDate.parse(from));return r;}
 @Test void changeAppliesFromEffectiveDateOnly(){when(repository.findByUserIdOrderByEffectiveFromAsc("u")).thenReturn(List.of(row("JP","2026-01-01"),row("KR","2026-10-01")));assertThat(service.countryAt("u",LocalDate.of(2025,12,31))).isEqualTo("UNSET");assertThat(service.countryAt("u",LocalDate.of(2026,9,30))).isEqualTo("JP");assertThat(service.countryAt("u",LocalDate.of(2026,10,1))).isEqualTo("KR");}
 @Test void koreanBrokerWithJapaneseResidenceUsesAnnualTreatment(){assertThat(TaxResidenceService.defaultTreatment("JP","KR",InvestmentTaxAccountType.GENERAL)).isEqualTo(InvestmentTaxTreatment.ANNUAL);assertThat(TaxResidenceService.defaultTreatment("JP","JP",InvestmentTaxAccountType.SPECIFIC_WITHHOLDING)).isEqualTo(InvestmentTaxTreatment.WITHHOLDING);assertThat(TaxResidenceService.defaultTreatment("JP","JP",InvestmentTaxAccountType.NISA)).isEqualTo(InvestmentTaxTreatment.NISA);assertThat(TaxResidenceService.defaultTreatment("KR","JP",InvestmentTaxAccountType.NISA)).isEqualTo(InvestmentTaxTreatment.ANNUAL);}
 @Test void staleHistoryEditDoesNotOverwrite(){var r=row("JP","2026-01-01");r.setVersion(3L);when(repository.findById("u:2026-01-01")).thenReturn(Optional.of(r));assertThatThrownBy(()->service.save("u",new TaxResidenceService.Edit("KR",LocalDate.of(2026,1,1),2L))).hasMessageContaining("409");assertThat(r.getCountry()).isEqualTo("JP");verify(repository,never()).saveAndFlush(any());}
 @Test void koreanBrokerageCannotBeNisa(){var account=Account.builder().accountType(AccountType.INVESTMENT).accountPurpose(AccountPurpose.STOCK_BROKERAGE).build();assertThatThrownBy(()->account.configureBrokerage("KR",InvestmentTaxAccountType.NISA)).isInstanceOf(IllegalArgumentException.class);account.configureBrokerage("JP",InvestmentTaxAccountType.NISA);assertThat(account.getAccountPurpose()).isEqualTo(AccountPurpose.NISA);account.configureBrokerage("KR",InvestmentTaxAccountType.GENERAL);assertThat(account.getAccountPurpose()).isEqualTo(AccountPurpose.STOCK_BROKERAGE);}
}
