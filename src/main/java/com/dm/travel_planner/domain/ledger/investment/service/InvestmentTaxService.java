package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.InvestmentTaxRecordRepository;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class InvestmentTaxService {
    private final InvestmentTaxRecordRepository records;
    private final AccountRepository accounts;
    public record Edit(@NotNull @Pattern(regexp="UNSET|KR|JP|REVIEW") String residence,
        @Pattern(regexp="UNSET|KR|JP|OTHER") String accountCountry, InvestmentTaxAccountType accountType,
        @Pattern(regexp="UNCHECKED|REVIEW|FILED|PAID") String filingStatus,
        com.dm.travel_planner.domain.ledger.entity.Currency paymentCurrency,
        @Digits(integer=15,fraction=4) BigDecimal confirmedProfit,
        @DecimalMin("0") @Digits(integer=15,fraction=4) BigDecimal additionalTax,
        @DecimalMin("0") @Digits(integer=15,fraction=4) BigDecimal refund,
        @Size(max=1000) String memo, Long version) {}
    private void year(int year){if(year<1900||year>2200)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"연도를 확인하세요.");}
    public List<InvestmentTaxRecord> get(String user,int year){year(year);return records.findByUserIdAndTaxYear(user,year);}
    @Transactional
    public InvestmentTaxRecord save(String user,int year,String accountId,Edit edit){
        year(year);
        if(accountId!=null){
            var account=accounts.findByAccountIdAndUserId(accountId,user).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
            if(account.getAccountType()!=AccountType.INVESTMENT)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"투자 계좌를 선택하세요.");
            if(edit.accountCountry()==null||edit.accountType()==null||edit.filingStatus()==null||edit.paymentCurrency()==null)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"계좌 설정을 확인하세요.");
            if(edit.accountCountry().equals("KR")&&Set.of(InvestmentTaxAccountType.NISA,InvestmentTaxAccountType.SPECIFIC_WITHHOLDING,InvestmentTaxAccountType.SPECIFIC_NO_WITHHOLDING).contains(edit.accountType()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"일본 계좌 유형은 한국 계좌에 적용할 수 없습니다.");
        }
        String id=user+":"+year+":"+(accountId==null?"year":accountId);
        var record=records.findById(id).orElseGet(InvestmentTaxRecord::new);
        if(!Objects.equals(record.getVersion(),edit.version()))throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 화면에서 수정했습니다. 새로고침 후 다시 시도하세요.");
        record.setId(id);record.setUserId(user);record.setTaxYear(year);record.setAccountId(accountId);
        if(accountId==null)record.setResidence(edit.residence());
        else {record.setAccountCountry(edit.accountCountry());record.setAccountType(edit.accountType());record.setFilingStatus(edit.filingStatus());record.setPaymentCurrency(edit.paymentCurrency());record.setConfirmedProfit(edit.confirmedProfit());record.setAdditionalTax(edit.additionalTax());record.setRefund(edit.refund());record.setMemo(edit.memo());}
        return records.saveAndFlush(record);
    }
}
