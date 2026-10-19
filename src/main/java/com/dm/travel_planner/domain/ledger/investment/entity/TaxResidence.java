package com.dm.travel_planner.domain.ledger.investment.entity;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
@Entity @Table(name="tax_residences",uniqueConstraints=@UniqueConstraint(columnNames={"user_id","effective_from"})) @Getter @Setter @NoArgsConstructor
public class TaxResidence {
    @Id @Column(length=100) private String id;
    @Column(nullable=false,length=50) private String userId;
    @Column(nullable=false,length=10) private String country;
    @Column(nullable=false) private LocalDate effectiveFrom;
    @Version private Long version;
}
