CREATE TABLE investment_tax_records (
 id varchar(180) PRIMARY KEY,
 user_id varchar(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 tax_year integer NOT NULL,
 account_id varchar(50) REFERENCES accounts(account_id) ON DELETE CASCADE,
 residence varchar(10), account_country varchar(10), account_type varchar(30),
 filing_status varchar(20), payment_currency varchar(10), confirmed_profit numeric(19,4),
 additional_tax numeric(19,4), refund numeric(19,4), memo varchar(1000), version bigint,
 UNIQUE(user_id,tax_year,account_id)
);
CREATE INDEX idx_investment_tax_user_year ON investment_tax_records(user_id,tax_year);
