package com.dm.travel_planner.domain.ledger.investment.controller;
import com.dm.travel_planner.domain.ledger.investment.service.InvestmentTaxService;
import com.dm.travel_planner.domain.ledger.investment.entity.InvestmentTaxRecord;
import com.dm.travel_planner.global.security.AuthenticatedUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequiredArgsConstructor @RequestMapping("/api/ledger/taxes")
public class InvestmentTaxController {
    private final InvestmentTaxService service;
    @GetMapping("/{year}") public List<InvestmentTaxRecord> get(@PathVariable int year,@AuthenticationPrincipal Object principal){return service.get(AuthenticatedUser.id(principal),year);}
    @PutMapping("/{year}") public InvestmentTaxRecord saveYear(@PathVariable int year,@AuthenticationPrincipal Object principal,@RequestBody @Valid InvestmentTaxService.Edit edit){return service.save(AuthenticatedUser.id(principal),year,null,edit);}
    @PutMapping("/{year}/accounts/{accountId}") public InvestmentTaxRecord saveAccount(@PathVariable int year,@PathVariable String accountId,@AuthenticationPrincipal Object principal,@RequestBody @Valid InvestmentTaxService.Edit edit){return service.save(AuthenticatedUser.id(principal),year,accountId,edit);}
}
