package com.dm.travel_planner.domain.ledger.investment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/** One user's annual filing context, or one account's annual confirmation. */
@Entity @Table(name="investment_tax_records") @Getter @Setter @NoArgsConstructor
public class InvestmentTaxRecord {
    @Id @Column(length=180) private String id;
    @Column(nullable=false,length=50) private String userId;
    @Column(nullable=false) private int taxYear;
    @Column(length=50) private String accountId;
    @Column(length=10) private String residence;
    @Column(length=10) private String accountCountry;
    @Enumerated(EnumType.STRING) @Column(length=30) private InvestmentTaxAccountType accountType;
    @Column(length=20) private String filingStatus;
    @Enumerated(EnumType.STRING) @Column(length=10) private com.dm.travel_planner.domain.ledger.entity.Currency paymentCurrency;
    @Column(precision=19,scale=4) private BigDecimal confirmedProfit;
    @Column(precision=19,scale=4) private BigDecimal additionalTax;
    @Column(precision=19,scale=4) private BigDecimal refund;
    @Column(length=1000) private String memo;
    @Version private Long version;
}
