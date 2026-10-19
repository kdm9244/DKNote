package com.dm.travel_planner.domain.ledger.investment.service;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.TaxResidenceRepository;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDate;
import java.util.*;
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class TaxResidenceService {
    private final TaxResidenceRepository repository;
    public record Edit(@NotNull @Pattern(regexp="KR|JP") String country,@NotNull LocalDate effectiveFrom,Long version) {}
    public List<TaxResidence> list(String user){return repository.findByUserIdOrderByEffectiveFromAsc(user);}
    public String countryAt(String user,LocalDate date){return list(user).stream().filter(r->!r.getEffectiveFrom().isAfter(date)).reduce((a,b)->b).map(TaxResidence::getCountry).orElse("UNSET");}
    @Transactional public TaxResidence save(String user,Edit edit){
        if(edit.effectiveFrom().getYear()<1900||edit.effectiveFrom().getYear()>2200)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"적용 시작일을 확인하세요.");
        String id=user+":"+edit.effectiveFrom();var row=repository.findById(id).orElseGet(TaxResidence::new);
        if(!Objects.equals(row.getVersion(),edit.version()))throw new ResponseStatusException(HttpStatus.CONFLICT,"거주지 설정이 변경되었습니다. 다시 불러오세요.");
        row.setId(id);row.setUserId(user);row.setCountry(edit.country());row.setEffectiveFrom(edit.effectiveFrom());return repository.saveAndFlush(row);
    }
    public static InvestmentTaxTreatment defaultTreatment(String residence,String accountCountry,InvestmentTaxAccountType type){
        if(!Set.of("JP","KR").contains(residence)||accountCountry==null||type==null||type==InvestmentTaxAccountType.UNSET)return InvestmentTaxTreatment.UNSET;
        if("JP".equals(residence)&&"JP".equals(accountCountry)){
            if(type==InvestmentTaxAccountType.NISA)return InvestmentTaxTreatment.NISA;
            if(type==InvestmentTaxAccountType.SPECIFIC_WITHHOLDING)return InvestmentTaxTreatment.WITHHOLDING;
        }
        return InvestmentTaxTreatment.ANNUAL;
    }
}
