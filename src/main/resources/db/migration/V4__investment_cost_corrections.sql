alter table investment_transactions add column if not exists tax_kind varchar(30) not null default 'UNCLASSIFIED';
alter table investment_transactions add column if not exists version bigint not null default 0;
alter table investment_account_profiles add column if not exists tax_account_type varchar(30) not null default 'UNSET';
