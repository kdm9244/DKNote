-- Extend the Hibernate-generated enum constraint for explicit net-profit settlements.
ALTER TABLE investment_transactions DROP CONSTRAINT IF EXISTS investment_transactions_trade_type_check;
ALTER TABLE investment_transactions ADD CONSTRAINT investment_transactions_trade_type_check
    CHECK (trade_type IN ('BUY', 'SELL', 'DIVIDEND', 'DEPOSIT', 'WITHDRAWAL', 'PROFIT_SETTLEMENT'));
