import React from 'react';

export default function AccountIdentityCard({
  variant,
  mark,
  status,
  statusTone = 'neutral',
  eyebrow,
  accountName,
  bankName,
  accountNumber,
  tags = [],
  footerLabel,
  footerValue,
  footerBadge,
}) {
  return (
    <div className={`ledger-identity-card ledger-identity-card--${variant}`}>
      <div className="ledger-identity-card__top">
        <span className="ledger-identity-card__mark">{mark}</span>
        <span className={`ledger-identity-card__status is-${statusTone}`}><i />{status}</span>
      </div>

      <p className="ledger-identity-card__eyebrow">{eyebrow}</p>
      <h2>{accountName}</h2>

      <div className="ledger-identity-card__meta">
        <span>{bankName || '금융기관 미등록'}</span>
        <span>{accountNumber || '계좌번호 미등록'}</span>
      </div>

      <div className="ledger-identity-card__tags">
        {tags.filter(Boolean).map((tag) => (
          <span key={`${tag.label}-${tag.tone || 'default'}`} className={tag.tone ? `is-${tag.tone}` : ''}>{tag.label}</span>
        ))}
      </div>

      <div className="ledger-identity-card__footer">
        <span>{footerLabel}</span>
        <strong>{footerValue || '-'}</strong>
        <em>{footerBadge || '대기'}</em>
      </div>
    </div>
  );
}
