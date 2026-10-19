package com.dm.travel_planner.domain.ledger.investment.controller;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentTaxService;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxRecord;
import com.dm.travel_planner.global.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.time.LocalDate;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentTaxEstimateService;
import com.dm.travel_planner.domain.ledger.investment.service.TaxResidenceService;
import com.dm.travel_planner.domain.ledger.investment.entity.TaxResidence;
@RestController @RequiredArgsConstructor @RequestMapping("/api/ledger/taxes")
public class InvestmentTaxController {
    private final InvestmentTaxService service;
    private final InvestmentTaxEstimateService estimates;
    private final TaxResidenceService residences;
    @GetMapping("/residences") public List<TaxResidence> residences(@AuthenticationPrincipal Object p){return residences.list(AuthenticatedUser.id(p));}
    @PutMapping("/residences") public TaxResidence residence(@AuthenticationPrincipal Object p,@RequestBody @Valid TaxResidenceService.Edit edit){return residences.save(AuthenticatedUser.id(p),edit);}
    @GetMapping("/trade-context") public InvestmentTaxEstimateService.TradeContext context(@AuthenticationPrincipal Object p,@RequestParam String accountId,@RequestParam LocalDate date){return estimates.context(AuthenticatedUser.id(p),accountId,date);}
    @GetMapping("/{year}/overview") public InvestmentTaxEstimateService.Overview overview(@PathVariable int year,@AuthenticationPrincipal Object p){return estimates.overview(AuthenticatedUser.id(p),year);}
    @PostMapping("/{year}/estimate") public InvestmentTaxEstimateService.Overview calculate(@PathVariable int year,@AuthenticationPrincipal Object p,@RequestBody InvestmentTaxEstimateService.Calculate request){return estimates.calculate(AuthenticatedUser.id(p),year,request);}
    @PutMapping("/{year}/settlement") public InvestmentTaxEstimateService.Overview settle(@PathVariable int year,@AuthenticationPrincipal Object p,@RequestBody @Valid InvestmentTaxEstimateService.Settle request){return estimates.settle(AuthenticatedUser.id(p),year,request);}
    @GetMapping("/{year}") public List<InvestmentTaxRecord> get(@PathVariable int year,@AuthenticationPrincipal Object principal){return service.get(AuthenticatedUser.id(principal),year);}
    @PutMapping("/{year}") public InvestmentTaxRecord saveYear(@PathVariable int year,@AuthenticationPrincipal Object principal,@RequestBody @Valid InvestmentTaxService.Edit edit){return service.save(AuthenticatedUser.id(principal),year,null,edit);}
    @PutMapping("/{year}/accounts/{accountId}") public InvestmentTaxRecord saveAccount(@PathVariable int year,@PathVariable String accountId,@AuthenticationPrincipal Object principal,@RequestBody @Valid InvestmentTaxService.Edit edit){return service.save(AuthenticatedUser.id(principal),year,accountId,edit);}
}
