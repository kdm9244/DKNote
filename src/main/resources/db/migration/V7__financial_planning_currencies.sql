-- Keep existing monetary values as KRW; currencies have independent monthly plans/budgets.
ALTER TABLE monthly_financial_plans ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'KRW';
ALTER TABLE monthly_financial_plans DROP CONSTRAINT uk_monthly_plan_user_month;
ALTER TABLE monthly_financial_plans ADD CONSTRAINT uk_monthly_plan_user_month_currency
    UNIQUE (user_id, target_month, currency);

ALTER TABLE budgets DROP CONSTRAINT uk_budgets_user_month_category_name;
ALTER TABLE budgets ADD CONSTRAINT uk_budgets_user_month_currency_category
    UNIQUE (user_id, target_month, currency, category_name);
