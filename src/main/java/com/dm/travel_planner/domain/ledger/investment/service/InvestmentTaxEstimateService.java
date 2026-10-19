package com.dm.travel_planner.domain.ledger.investment.service;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.ledger.entity.AccountType;
import com.dm.travel_planner.domain.ledger.entity.Currency;
import com.dm.travel_planner.domain.ledger.repository.AccountRepository;
import com.dm.travel_planner.domain.ledger.investment.entity.*;
import com.dm.travel_planner.domain.ledger.investment.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.*;
import java.time.*;
import java.util.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Preparation estimate from recorded book gains. Does not post money to the ledger. */
@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class InvestmentTaxEstimateService {
    private final AccountRepository accounts;
    private final InvestmentRepository holdings;
    private final InvestmentTransactionRepository transactions;
    private final InvestmentTaxRecordRepository records;
    private final TaxResidenceService residences;
    private final ObjectMapper json;
    private static final BigDecimal ZERO=BigDecimal.ZERO;
    private static final Set<String> RATE_KEYS=Set.of("KRW_JPY","USD_JPY","JPY_KRW","USD_KRW");
    public record Calculate(Map<String,BigDecimal> rates,Long version) {}
    public record Settle(@NotNull @Pattern(regexp="COMPLETE|REOPEN") String action,
                         Map<String,BigDecimal> payments,LocalDate paidDate,Long version) {}
    public record CountryTotal(String country,Currency currency,BigDecimal realizedProfit,
                               BigDecimal estimatedTax,BigDecimal withheld,boolean complete) {}
    public record AccountLine(String accountId,String accountName,Currency currency,BigDecimal realizedProfit,
                              int sales,List<String> issues) {}
    public record Report(int year,List<CountryTotal> totals,Map<Currency,BigDecimal> transactionTaxes,
                         Map<Currency,BigDecimal> unclassifiedTaxes, List<AccountLine> accounts,
                         List<String> issues,List<String> requiredRates,String fingerprint) {}
    public record Overview(int year,Report current,Report estimate,Map<String,BigDecimal> rates,
                           Map<String,BigDecimal> payments,LocalDate paidDate,LocalDateTime completedAt,
                           LocalDateTime estimatedAt,boolean changed,Long version,List<InvestmentTaxRecord> legacyRecords) {}
    private static class Bucket {String country;Currency currency;BigDecimal profit=ZERO,withheld=ZERO;boolean complete=true;
        Bucket(String c){country=c;currency=c.equals("JP")?Currency.JPY:Currency.KRW;}}
    public record TradeContext(String residence,String accountCountry,InvestmentTaxAccountType accountType,InvestmentTaxTreatment treatment) {}
    public TradeContext context(String user,String accountId,LocalDate date){
        var account=accounts.findByAccountIdAndUserId(accountId,user).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
        if(account.getAccountType()!=AccountType.INVESTMENT)throw bad("증권계좌를 선택하세요.");
        String residence=residences.countryAt(user,date);
        return new TradeContext(residence,account.getBrokerageCountry(),account.getBrokerageTaxType(),TaxResidenceService.defaultTreatment(residence,account.getBrokerageCountry(),account.getBrokerageTaxType()));
    }
    private void checkYear(int year){if(year<1900||year>2200)throw bad("연도를 확인하세요.");}
    private ResponseStatusException bad(String text){return new ResponseStatusException(HttpStatus.BAD_REQUEST,text);}
    private String key(String user,int year){return user+":"+year+":year";}
    private InvestmentTaxRecord yearRecord(String user,int year){return records.findById(key(user,year)).orElseGet(()->{var r=new InvestmentTaxRecord();r.setId(key(user,year));r.setUserId(user);r.setTaxYear(year);return r;});}
    private void revision(InvestmentTaxRecord row,Long version){if(!Objects.equals(row.getVersion(),version))throw new ResponseStatusException(HttpStatus.CONFLICT,"다른 화면에서 수정했습니다. 새로고침 후 다시 시도하세요.");}
    private <T>T read(String s,Class<T> type){try{return s==null?null:json.readValue(s,type);}catch(Exception e){throw bad("저장된 정산 정보를 읽지 못했습니다.");}}
    private Map<String,BigDecimal> map(String s){try{return s==null?new TreeMap<>():json.readValue(s,new TypeReference<TreeMap<String,BigDecimal>>(){});}catch(Exception e){throw bad("정산 금액 형식을 확인하세요.");}}
    private String write(Object value){try{return json.writeValueAsString(value);}catch(Exception e){throw bad("정산 정보를 저장하지 못했습니다.");}}
    private Map<String,BigDecimal> validRates(Map<String,BigDecimal> input){var result=new TreeMap<String,BigDecimal>();if(input!=null)input.forEach((k,v)->{if(!RATE_KEYS.contains(k)||v==null||v.signum()<=0||v.compareTo(new BigDecimal("1000000"))>0||v.scale()>8)throw bad("참고 환율은 0보다 크고 소수점 8자리 이하여야 합니다.");result.put(k,v.stripTrailingZeros());});return result;}
    public Overview overview(String user,int year){
        checkYear(year);var row=yearRecord(user,year);var rates=map(row.getEstimateRates());var current=report(user,year,rates);
        return new Overview(year,current,read(row.getEstimateSnapshot(),Report.class),rates,map(row.getSettlementPayments()),row.getSettledDate(),row.getCompletedAt(),row.getEstimatedAt(),row.getEstimateFingerprint()!=null&&!row.getEstimateFingerprint().equals(current.fingerprint()),row.getVersion(),records.findByUserIdAndTaxYear(user,year).stream().filter(r->r.getAccountId()!=null).toList());
    }
    @Transactional public Overview calculate(String user,int year,Calculate request){
        checkYear(year);var row=yearRecord(user,year);revision(row,request.version());if(row.getCompletedAt()!=null)throw bad("정산 수정을 눌러 완료 상태를 해제하세요.");
        var rates=validRates(request.rates());var report=report(user,year,rates);
        row.setEstimateSnapshot(write(report));row.setEstimateFingerprint(report.fingerprint());row.setEstimateRates(write(rates));row.setEstimatedAt(LocalDateTime.now());records.saveAndFlush(row);return overview(user,year);
    }
    @Transactional public Overview settle(String user,int year,Settle request){
        checkYear(year);var row=yearRecord(user,year);revision(row,request.version());
        if("REOPEN".equals(request.action())){row.setCompletedAt(null);records.saveAndFlush(row);return overview(user,year);}
        if(row.getCompletedAt()!=null)throw bad("이미 정산 완료된 연도입니다.");
        if(row.getEstimateSnapshot()==null)throw bad("먼저 예상 세금을 계산하세요.");
        var current=report(user,year,map(row.getEstimateRates()));
        if(!Objects.equals(row.getEstimateFingerprint(),current.fingerprint()))throw new ResponseStatusException(HttpStatus.CONFLICT,"거래 또는 설정이 변경되었습니다. 예상 세금을 다시 계산하세요.");
        if(current.totals().isEmpty()||!current.issues().isEmpty()||current.totals().stream().anyMatch(t->!t.complete()))throw bad("자료 부족 항목을 확인한 후 정산을 완료하세요.");
        if(request.paidDate()==null||request.paidDate().isBefore(LocalDate.of(year,1,1))||request.paidDate().isAfter(LocalDate.now(ZoneId.of("Asia/Seoul"))))throw bad("실제 납부일 또는 확인일을 입력하세요.");
        var payments=new TreeMap<String,BigDecimal>();var expected=new TreeSet<String>();current.totals().forEach(t->expected.add(t.currency().name()));
        if(request.payments()==null||!request.payments().keySet().equals(expected))throw bad("통화별 실제 추가 납부액을 입력하세요. 추가 납부가 없으면 0을 입력하세요.");
        request.payments().forEach((c,v)->{if(v==null||v.signum()<0||v.precision()-v.scale()>15||v.scale()>4)throw bad("실제 납부액을 확인하세요.");payments.put(c,v);});
        row.setSettlementPayments(write(payments));row.setSettledDate(request.paidDate());row.setCompletedAt(LocalDateTime.now());records.saveAndFlush(row);return overview(user,year);
    }
    public Report report(String user,int year,Map<String,BigDecimal> rates){
        var issues=new LinkedHashSet<String>();var required=new TreeSet<String>();var buckets=new TreeMap<String,Bucket>();var taxes=new TreeMap<Currency,BigDecimal>();var unknownTaxes=new TreeMap<Currency,BigDecimal>();var lines=new ArrayList<AccountLine>();var digest=new StringBuilder("estimate-v1|").append(year).append('|').append(new TreeMap<>(rates));
        var history=residences.list(user);var legacy=records.findByUserIdAndTaxYear(user,year);
        var accountList=accounts.findByUserIdOrderByDisplayOrderAsc(user).stream().filter(a->a.getAccountType()==AccountType.INVESTMENT).sorted(Comparator.comparing(Account::getAccountId)).toList();
        for(var account:accountList){
            var lineIssues=new LinkedHashSet<String>();BigDecimal bookProfit=ZERO;int sales=0;
            var old=legacy.stream().filter(r->account.getAccountId().equals(r.getAccountId())).findFirst().orElse(null);
            for(var holding:holdings.findByAccountIdAndUserId(account.getAccountId(),user).stream().sorted(Comparator.comparing(Investment::getInvestmentId)).toList()){
                for(var tx:transactions.findByInvestmentIdOrderByCreatedAtAscInvestmentTransactionIdAsc(holding.getInvestmentId())){
                    if(tx.getTradeDate().getYear()>year)continue;
                    digest.append('|').append(tx.getInvestmentTransactionId()).append(':').append(tx.getTradeDate()).append(':').append(tx.getVersion()).append(':').append(tx.getQuantity()).append(':').append(tx.getGrossAmount()).append(':').append(tx.getFeeAmount()).append(':').append(tx.getTaxAmount()).append(':').append(tx.getRealizedProfitLoss()).append(':').append(tx.getTaxKind()).append(':').append(tx.getExchangeRate());
                    if(tx.getTradeDate().getYear()!=year)continue;
                    if(tx.getTaxKind()==InvestmentTaxKind.TRANSACTION_TAX)taxes.merge(tx.getCurrency(),tx.getTaxAmount(),BigDecimal::add);
                    if(tx.getTaxKind()==InvestmentTaxKind.UNCLASSIFIED&&tx.getTaxAmount().signum()>0)unknownTaxes.merge(tx.getCurrency(),tx.getTaxAmount(),BigDecimal::add);
                    if(tx.getTradeType()!=InvestmentTradeType.SELL)continue;
                    sales++;String res=tx.getTaxResidence();if(res==null||res.equals("UNSET"))res=history.stream().filter(h->!h.getEffectiveFrom().isAfter(tx.getTradeDate().toLocalDate())).reduce((a,b)->b).map(TaxResidence::getCountry).orElse("UNSET");
                    String country=tx.getTaxAccountCountry()!=null?tx.getTaxAccountCountry():old!=null&&Set.of("KR","JP").contains(Objects.requireNonNullElse(old.getAccountCountry(),""))?old.getAccountCountry():account.getBrokerageCountry();
                    var type=tx.getTaxAccountType()!=null&&tx.getTaxAccountType()!=InvestmentTaxAccountType.UNSET?tx.getTaxAccountType():old!=null&&old.getAccountType()!=null&&old.getAccountType()!=InvestmentTaxAccountType.UNSET?old.getAccountType():account.getBrokerageTaxType();
                    var treatment=tx.getTaxTreatment();if(treatment==null||treatment==InvestmentTaxTreatment.UNSET)treatment=TaxResidenceService.defaultTreatment(res,country,type);
                    digest.append(':').append(res).append(':').append(country).append(':').append(type).append(':').append(treatment).append(':').append(holding.getAssetClass()).append(':').append(holding.getMarket());
                    BigDecimal paid=tx.getTaxKind()==InvestmentTaxKind.WITHHOLDING_TAX?tx.getTaxAmount().multiply(tx.getExchangeRate()):ZERO;
                    BigDecimal gain=tx.getRealizedProfitLoss().add(paid);bookProfit=bookProfit.add(gain);
                    if(!Set.of("KR","JP").contains(res)){lineIssues.add("매도일의 세법상 거주지 설정 필요");continue;}
                    var bucket=buckets.computeIfAbsent(res,Bucket::new);
                    if(country==null||type==null||type==InvestmentTaxAccountType.UNSET||treatment==InvestmentTaxTreatment.UNSET){bucket.complete=false;lineIssues.add("계좌 국가·유형 설정 필요");continue;}
                    if(res.equals("JP")&&treatment==InvestmentTaxTreatment.NISA&&country.equals("JP")&&type==InvestmentTaxAccountType.NISA)continue;
                    if(tx.getTaxKind()==InvestmentTaxKind.UNCLASSIFIED&&tx.getTaxAmount().signum()>0){bucket.complete=false;lineIssues.add("거래 비용 수정에서 기존 세금 구분 필요");continue;}
                    if(tx.getTaxKind()==InvestmentTaxKind.OTHER_TAX&&tx.getTaxAmount().signum()>0){bucket.complete=false;lineIssues.add("기타 세금의 종류 확인 필요");continue;}
                    if(year<2020||year>2026){bucket.complete=false;lineIssues.add("이 연도의 예상 세율은 아직 지원하지 않습니다");continue;}
                    if(!isListedMarket(holding.getMarket())){bucket.complete=false;lineIssues.add("상장주식 시장 정보 확인 필요");continue;}
                    if(res.equals("KR")&&holding.getAssetClass()==InvestmentAssetClass.INDEX_ETF){bucket.complete=false;lineIssues.add("한국 거주 기준 ETF 과세는 별도 확인 필요");continue;}
                    boolean koreanStock=res.equals("KR")&&isKoreanMarket(holding.getMarket());
                    if(koreanStock)continue; // basic listed small-shareholder scenario, explicitly shown in UI
                    String rateKey=account.getCurrency().name()+"_"+bucket.currency.name();
                    BigDecimal fx=account.getCurrency()==bucket.currency?BigDecimal.ONE:rates.get(rateKey);
                    if(fx==null){required.add(rateKey);bucket.complete=false;lineIssues.add("참고 환율 필요: "+account.getCurrency()+" → "+bucket.currency);continue;}
                    bucket.profit=bucket.profit.add(gain.multiply(fx));
                    // Only domestic income-tax withholding offsets this country's estimate. Never credit transaction taxes or foreign income taxes automatically.
                    if(country.equals(res)&&tx.getTaxKind()==InvestmentTaxKind.WITHHOLDING_TAX)bucket.withheld=bucket.withheld.add(paid.multiply(fx));
                    else if(paid.signum()>0){bucket.complete=false;lineIssues.add("국외 원천징수액은 별도 세액공제 확인 필요");}
                }
            }
            if(sales>0)lines.add(new AccountLine(account.getAccountId(),account.getAccountName(),account.getCurrency(),round(bookProfit),sales,List.copyOf(lineIssues)));
            for(String issue:lineIssues)issues.add(account.getAccountName()+": "+issue);
        }
        if(buckets.isEmpty()&&issues.isEmpty()){
            String res=history.stream().filter(h->h.getEffectiveFrom().getYear()<=year).reduce((a,b)->b).map(TaxResidence::getCountry).orElse(null);if(res!=null)buckets.put(res,new Bucket(res));else issues.add("가계부 설정에서 세법상 거주지를 설정하세요.");
        }
        if(!issues.isEmpty())buckets.values().forEach(b->b.complete=false);
        var totals=new ArrayList<CountryTotal>();for(var b:buckets.values()){
            BigDecimal taxable=b.profit.subtract(b.country.equals("KR")?new BigDecimal("2500000"):ZERO).max(ZERO);
            BigDecimal tax=taxable.multiply(new BigDecimal(b.country.equals("JP")?"0.20315":"0.22")).setScale(0,RoundingMode.HALF_UP);
            totals.add(new CountryTotal(b.country,b.currency,round(b.profit),b.complete?tax:null,round(b.withheld),b.complete));
        }
        digest.append('|').append(totals).append('|').append(lines);
        try{String fp=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(digest.toString().getBytes(StandardCharsets.UTF_8)));return new Report(year,totals,taxes,unknownTaxes,lines,List.copyOf(issues),List.copyOf(required),fp);}catch(Exception e){throw new IllegalStateException(e);}
    }
    private boolean isKoreanMarket(String market){return market!=null&&Set.of("KR","KRX","KOSPI","KOSDAQ","KONEX").contains(market.toUpperCase(Locale.ROOT));}
    private boolean isListedMarket(String market){return isKoreanMarket(market)||market!=null&&Set.of("JP","TSE","TOKYO","US","NASDAQ","NYSE","AMEX","NYS","NAS","AMS").contains(market.toUpperCase(Locale.ROOT));}
    private BigDecimal round(BigDecimal value){return value.setScale(2,RoundingMode.HALF_UP);}
}
