ALTER TABLE accounts ADD COLUMN brokerage_country varchar(10);
ALTER TABLE accounts ADD COLUMN brokerage_tax_type varchar(30);
UPDATE accounts a SET brokerage_tax_type=p.tax_account_type FROM investment_account_profiles p WHERE a.account_id=p.account_id;
UPDATE accounts a SET brokerage_country=r.account_country, brokerage_tax_type=r.account_type
FROM (SELECT DISTINCT ON(account_id) account_id,account_country,account_type FROM investment_tax_records WHERE account_id IS NOT NULL AND account_country IN('KR','JP') ORDER BY account_id,tax_year DESC) r WHERE a.account_id=r.account_id;
UPDATE accounts SET brokerage_country='JP',brokerage_tax_type='NISA' WHERE account_purpose='NISA' AND brokerage_country IS NULL;
CREATE TABLE tax_residences(id varchar(100) PRIMARY KEY,user_id varchar(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,country varchar(10) NOT NULL,effective_from date NOT NULL,version bigint,UNIQUE(user_id,effective_from));
INSERT INTO tax_residences(id,user_id,country,effective_from,version) SELECT user_id||':'||make_date(tax_year,1,1),user_id,residence,make_date(tax_year,1,1),0 FROM investment_tax_records WHERE account_id IS NULL AND residence IN('KR','JP');
ALTER TABLE investment_transactions ADD COLUMN tax_residence varchar(10);
ALTER TABLE investment_transactions ADD COLUMN tax_account_country varchar(10);
ALTER TABLE investment_transactions ADD COLUMN tax_account_type varchar(30);
ALTER TABLE investment_transactions ADD COLUMN tax_treatment varchar(20);
ALTER TABLE investment_tax_records ADD COLUMN estimate_snapshot text;
ALTER TABLE investment_tax_records ADD COLUMN estimate_fingerprint varchar(64);
ALTER TABLE investment_tax_records ADD COLUMN estimate_rates text;
ALTER TABLE investment_tax_records ADD COLUMN estimated_at timestamp(6);
ALTER TABLE investment_tax_records ADD COLUMN settlement_payments text;
ALTER TABLE investment_tax_records ADD COLUMN settled_date date;
ALTER TABLE investment_tax_records ADD COLUMN completed_at timestamp(6);
