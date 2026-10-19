package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "investment_account_profiles")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentAccountProfile {
    @Id
    @Column(name = "account_id", length = 50)
    private String accountId;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_profiles_account"))
    private Account account;

    @Column(name = "is_primary", nullable = false)
    @Builder.Default
    private Boolean isPrimary = false;

    @Column(name = "auto_sync_enabled", nullable = false)
    @Builder.Default
    private Boolean autoSyncEnabled = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "sync_status", nullable = false, length = 20)
    @Builder.Default
    private InvestmentSyncStatus syncStatus = InvestmentSyncStatus.NEVER;

    @Column(name = "sync_provider", length = 30)
    private String syncProvider;

    @Enumerated(EnumType.STRING) @Column(name="tax_account_type",nullable=false,length=30) @org.hibernate.annotations.ColumnDefault("'UNSET'")
    @Builder.Default private InvestmentTaxAccountType taxAccountType=InvestmentTaxAccountType.UNSET;

    public void updateTaxAccountType(InvestmentTaxAccountType value){if(value!=null)taxAccountType=value;}

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void updateSettings(Boolean primary, Boolean autoSyncEnabled, String syncProvider) {
        if (primary != null) this.isPrimary = primary;
        if (autoSyncEnabled != null) this.autoSyncEnabled = autoSyncEnabled;
        if (syncProvider != null) this.syncProvider = syncProvider;
    }

    public void markSyncing(String provider) {
        syncStatus = InvestmentSyncStatus.SYNCING;
        syncProvider = provider;
    }

    public void completeSync(InvestmentSyncStatus status) {
        syncStatus = status;
        lastSyncedAt = LocalDateTime.now();
    }
}
