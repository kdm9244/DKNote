package com.dm.travel_planner.domain.ledger.investment.entity;

import com.dm.travel_planner.domain.ledger.entity.Account;
import com.dm.travel_planner.domain.user.entity.User;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "investment_notes", indexes = {
        @Index(name = "idx_investment_notes_account_updated", columnList = "account_id,updated_at")
})
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvestmentNote {
    @Id
    @Column(name = "note_id", length = 50)
    private String noteId;

    @Column(name = "user_id", nullable = false, length = 50)
    private String userId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_notes_user"))
    private User user;

    @Column(name = "account_id", nullable = false, length = 50)
    private String accountId;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_investment_notes_account"))
    private Account account;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "content", columnDefinition = "text")
    private String content;

    @Column(name = "is_pinned", nullable = false)
    @Builder.Default
    private Boolean isPinned = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (noteId == null) noteId = UUID.randomUUID().toString().replace("-", "");
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
