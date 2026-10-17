
    create table account_transfers (
        destination_amount numeric(18,2) not null,
        destination_currency varchar(3) not null check ((destination_currency in ('KRW','JPY','USD'))),
        exchange_rate numeric(20,8) not null,
        fee_amount numeric(18,2) not null,
        source_amount numeric(18,2) not null,
        source_currency varchar(3) not null check ((source_currency in ('KRW','JPY','USD'))),
        created_at timestamp(6) not null,
        transferred_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        status varchar(20) not null,
        destination_account_id varchar(50) not null,
        source_account_id varchar(50) not null,
        transfer_id varchar(50) not null,
        user_id varchar(50) not null,
        memo text,
        primary key (transfer_id)
    );

    create table accounts (
        cached_book_balance numeric(18,2) not null,
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        display_order integer not null,
        initial_balance numeric(18,2) not null,
        initial_balance_date date not null,
        initial_exchange_rate numeric(18,8),
        interest_rate numeric(6,4),
        is_active boolean not null,
        last_actual_balance numeric(18,2),
        maturity_date date,
        minimum_balance numeric(18,2),
        monthly_payment numeric(18,2),
        target_balance numeric(18,2),
        balance_updated_at timestamp(6) not null,
        created_at timestamp(6) not null,
        last_reconciled_at timestamp(6),
        updated_at timestamp(6) not null,
        interest_type varchar(20),
        account_purpose varchar(30) not null check ((account_purpose in ('CASH','TRANSIT_CARD','GENERAL_CHECKING','SALARY_CHECKING','LIVING_CHECKING','EMERGENCY_CHECKING','ALLOWANCE_CHECKING','INSTALLMENT_SAVINGS','TIME_DEPOSIT','FREE_SAVINGS','STOCK_BROKERAGE','CMA','NISA','PENSION','OTHER_INVESTMENT','FOREIGN_SAVINGS','FOREIGN_LIVING','LOAN','CREDIT_LINE'))),
        account_type varchar(30) not null check ((account_type in ('CHECKING','SAVINGS','INVESTMENT','FOREIGN_CURRENCY','DEBT'))),
        account_id varchar(50) not null,
        account_number_masked varchar(50),
        bank_name varchar(50),
        user_id varchar(50) not null,
        account_name varchar(100) not null,
        primary key (account_id)
    );

    create table activities (
        cost numeric(18,2),
        end_time time(0),
        fx_rate numeric(18,6),
        sequence integer not null,
        start_time time(0),
        travel_minutes integer not null,
        created_at timestamp(6) not null,
        version bigint not null,
        currency varchar(10) not null,
        activity_type varchar(20) not null check ((activity_type in ('MEAL','HOTEL','SPOT','TRANSPORT','SHOPPING','MEETING','OTHER'))),
        activity_id varchar(50) not null,
        day_id varchar(50) not null,
        title varchar(100) not null,
        arrival_location varchar(200),
        departure_location varchar(200),
        meeting_location varchar(200),
        short_intro TEXT,
        primary key (activity_id)
    );

    create table budget_items (
        amount numeric(18,2) not null,
        expense_date date,
        fx_rate numeric(18,6),
        created_at timestamp(6) not null,
        version bigint not null,
        currency varchar(10) not null,
        budget_id varchar(50) not null,
        category varchar(50) not null,
        payment_method varchar(50),
        trip_id varchar(50) not null,
        title varchar(100) not null,
        memo TEXT,
        primary key (budget_id)
    );

    create table budgets (
        budget_amount numeric(18,2) not null,
        currency varchar(3) not null,
        target_month varchar(7) not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        rollover_setting varchar(30) not null,
        budget_id varchar(50) not null,
        category_id varchar(50),
        category_name varchar(50) not null,
        user_id varchar(50) not null,
        primary key (budget_id),
        constraint uk_budgets_user_month_category_name unique (user_id, target_month, category_name)
    );

    create table checklist_attachments (
        created_at timestamp(6) not null,
        file_size bigint,
        scope varchar(20) default 'PERSONAL' not null check ((scope in ('SHARED','PERSONAL'))),
        attachment_id varchar(50) not null,
        item_id varchar(50) not null,
        uploaded_by_id varchar(50),
        content_type varchar(150),
        file_url varchar(500) not null,
        file_name varchar(255) not null,
        primary key (attachment_id)
    );

    create table checklist_items (
        is_checked boolean not null,
        sequence integer not null,
        created_at timestamp(6) not null,
        scope varchar(20) default 'SHARED' not null check ((scope in ('SHARED','PERSONAL'))),
        category varchar(50) not null,
        created_by_id varchar(50),
        item_id varchar(50) not null,
        owner_id varchar(50),
        trip_id varchar(50) not null,
        title varchar(100) not null,
        link_url varchar(500),
        memo TEXT,
        primary key (item_id)
    );

    create table days (
        day_number integer not null,
        travel_date date not null,
        day_id varchar(50) not null,
        trip_id varchar(50) not null,
        primary key (day_id)
    );

    create table fixed_expenses (
        amount numeric(18,2) not null,
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        is_active boolean not null,
        next_payment_date date not null,
        payment_day_of_month integer,
        start_date date not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        account_id varchar(50),
        fixed_expense_id varchar(50) not null,
        user_id varchar(50) not null,
        title varchar(100) not null,
        primary key (fixed_expense_id)
    );

    create table foreign_currency_transactions (
        amount numeric(20,4) not null,
        currency varchar(3) check ((currency in ('KRW','JPY','USD'))),
        exchange_rate numeric(18,8),
        exchange_rate_currency varchar(3) check ((exchange_rate_currency in ('KRW','JPY','USD'))),
        fee_krw numeric(18,2) not null,
        krw_exchange_rate numeric(18,8),
        created_at timestamp(6) not null,
        transaction_date timestamp(6) not null,
        updated_at timestamp(6) not null,
        transaction_type varchar(20) not null check ((transaction_type in ('DEPOSIT','WITHDRAWAL'))),
        purpose varchar(40) not null,
        account_id varchar(50) not null,
        foreign_transaction_id varchar(50) not null,
        user_id varchar(50) not null,
        title varchar(150) not null,
        memo varchar(1000),
        primary key (foreign_transaction_id)
    );

    create table goal_contributions (
        amount numeric(18,2) not null,
        contributed_at timestamp(6) not null,
        created_at timestamp(6) not null,
        contribution_id varchar(50) not null,
        goal_id varchar(50) not null,
        source_account_id varchar(50),
        transfer_id varchar(50),
        user_id varchar(50) not null,
        memo varchar(500),
        primary key (contribution_id)
    );

    create table investment_account_profiles (
        auto_sync_enabled boolean not null,
        is_primary boolean not null,
        created_at timestamp(6) not null,
        last_synced_at timestamp(6),
        updated_at timestamp(6) not null,
        sync_status varchar(20) not null check ((sync_status in ('NEVER','SYNCING','SUCCESS','PARTIAL','FAILED'))),
        sync_provider varchar(30),
        account_id varchar(50) not null,
        primary key (account_id)
    );

    create table investment_account_snapshots (
        cash_balance numeric(18,2) not null,
        dividend_income numeric(18,2) not null,
        invested_principal numeric(18,2) not null,
        market_value numeric(18,2) not null,
        realized_profit_loss numeric(18,2) not null,
        snapshot_date date not null,
        total_asset_value numeric(18,2) not null,
        unrealized_profit_loss numeric(18,2) not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        account_id varchar(50) not null,
        account_snapshot_id varchar(50) not null,
        user_id varchar(50) not null,
        primary key (account_snapshot_id),
        constraint uk_investment_account_snapshot_day unique (account_id, snapshot_date)
    );

    create table investment_fee_settings (
        buy_fee_rate numeric(10,6) not null,
        dividend_tax_rate numeric(10,6) not null,
        sell_fee_rate numeric(10,6) not null,
        sell_tax_rate numeric(10,6) not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        market_group varchar(10) not null check ((market_group in ('KR','US','JP'))),
        account_id varchar(50) not null,
        fee_setting_id varchar(50) not null,
        user_id varchar(50) not null,
        primary key (fee_setting_id),
        constraint uk_investment_fee_account_market unique (account_id, market_group)
    );

    create table investment_notes (
        is_pinned boolean not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        account_id varchar(50) not null,
        note_id varchar(50) not null,
        user_id varchar(50) not null,
        title varchar(100) not null,
        content text,
        primary key (note_id)
    );

    create table investment_plan_items (
        exchange_rate numeric(20,8) not null,
        quote_currency varchar(3) not null check ((quote_currency in ('KRW','JPY','USD'))),
        reference_price numeric(18,4) not null,
        target_ratio numeric(7,3) not null,
        created_at timestamp(6) not null,
        price_quoted_at timestamp(6),
        updated_at timestamp(6) not null,
        ticker_code varchar(20) not null,
        asset_class varchar(30) not null check ((asset_class in ('INDEX_ETF','DOMESTIC_STOCK','FOREIGN_STOCK','DIVIDEND_ASSET','CASH'))),
        market varchar(30),
        investment_id varchar(50),
        investment_plan_id varchar(50) not null,
        investment_plan_item_id varchar(50) not null,
        symbol_name varchar(100) not null,
        primary key (investment_plan_item_id),
        constraint uk_investment_plan_item_ticker unique (investment_plan_id, ticker_code)
    );

    create table investment_plans (
        execution_day integer not null,
        monthly_amount numeric(18,2) not null,
        start_date date not null,
        target_amount numeric(18,2) not null,
        target_date date,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        status varchar(20) not null,
        investment_account_id varchar(50) not null,
        investment_plan_id varchar(50) not null,
        source_account_id varchar(50),
        user_id varchar(50) not null,
        title varchar(100) not null,
        memo text,
        primary key (investment_plan_id)
    );

    create table investment_price_snapshots (
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        exchange_rate numeric(20,8) not null,
        price numeric(18,4) not null,
        created_at timestamp(6) not null,
        quoted_at timestamp(6) not null,
        source varchar(30) not null,
        investment_id varchar(50) not null,
        price_snapshot_id varchar(50) not null,
        primary key (price_snapshot_id)
    );

    create table investment_target_allocations (
        target_ratio numeric(5,2) not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        asset_class varchar(30) not null check ((asset_class in ('INDEX_ETF','DOMESTIC_STOCK','FOREIGN_STOCK','DIVIDEND_ASSET','CASH'))),
        account_id varchar(50) not null,
        target_allocation_id varchar(50) not null,
        user_id varchar(50) not null,
        primary key (target_allocation_id),
        constraint uk_investment_target_account_asset unique (account_id, asset_class)
    );

    create table investment_transactions (
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        exchange_rate numeric(20,8) not null,
        fee_amount numeric(18,2) not null,
        gross_amount numeric(18,2) not null,
        net_amount numeric(18,2) not null,
        quantity numeric(18,6) not null,
        realized_profit_loss numeric(18,2) not null,
        tax_amount numeric(18,2) not null,
        unit_price numeric(18,4) not null,
        created_at timestamp(6) not null,
        trade_date timestamp(6) not null,
        updated_at timestamp(6) not null,
        trade_type varchar(20) not null check ((trade_type in ('BUY','SELL','DIVIDEND','DEPOSIT','WITHDRAWAL'))),
        investment_id varchar(50) not null,
        investment_transaction_id varchar(50) not null,
        transaction_id varchar(50),
        external_transaction_key varchar(100) unique,
        memo text,
        primary key (investment_transaction_id)
    );

    create table investments (
        cached_avg_buy_price numeric(18,4) not null,
        cached_avg_buy_price_base numeric(18,4) not null,
        cached_current_price numeric(18,4) not null,
        cached_exchange_rate numeric(20,8) not null,
        cached_market_value numeric(18,2) not null,
        cached_quantity numeric(18,6) not null,
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        is_active boolean not null,
        target_quantity numeric(18,6),
        created_at timestamp(6) not null,
        position_updated_at timestamp(6) not null,
        price_updated_at timestamp(6),
        updated_at timestamp(6) not null,
        ticker_code varchar(20) not null,
        asset_class varchar(30) not null check ((asset_class in ('INDEX_ETF','DOMESTIC_STOCK','FOREIGN_STOCK','DIVIDEND_ASSET','CASH'))),
        market varchar(30),
        account_id varchar(50) not null,
        investment_id varchar(50) not null,
        user_id varchar(50) not null,
        symbol_name varchar(100) not null,
        primary key (investment_id),
        constraint uk_investments_user_acc_ticker unique (user_id, account_id, ticker_code)
    );

    create table monthly_financial_plans (
        debt_repayment_target numeric(18,2) not null,
        expected_income numeric(18,2) not null,
        investment_target numeric(18,2) not null,
        savings_target numeric(18,2) not null,
        target_month varchar(7) not null,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        plan_id varchar(50) not null,
        user_id varchar(50) not null,
        memo varchar(1000),
        primary key (plan_id),
        constraint uk_monthly_plan_user_month unique (user_id, target_month)
    );

    create table reconciliations (
        actual_balance numeric(18,2) not null,
        book_balance numeric(18,2) not null,
        diff_amount numeric(18,2) not null,
        created_at timestamp(6) not null,
        reconciled_at timestamp(6) not null,
        reason_code varchar(30) not null,
        account_id varchar(50) not null,
        reconciliation_id varchar(50) not null,
        user_id varchar(50) not null,
        memo varchar(255),
        primary key (reconciliation_id)
    );

    create table transactions (
        amount numeric(18,2) not null,
        base_currency_amount numeric(18,2) not null,
        currency varchar(3) not null check ((currency in ('KRW','JPY','USD'))),
        exchange_rate numeric(18,8),
        is_fixed_expense boolean not null,
        created_at timestamp(6) not null,
        transaction_date timestamp(6) not null,
        updated_at timestamp(6) not null,
        transfer_direction varchar(10) check ((transfer_direction in ('OUT','IN'))),
        status varchar(30),
        transaction_type varchar(30) not null check ((transaction_type in ('INCOME','EXPENSE','TRANSFER'))),
        account_id varchar(50),
        category_id varchar(50),
        payment_method varchar(50),
        reconciliation_id varchar(50),
        transaction_id varchar(50) not null,
        transfer_id varchar(50),
        user_id varchar(50) not null,
        title varchar(200) not null,
        memo varchar(255),
        primary key (transaction_id)
    );

    create table travel_places (
        version bigint not null,
        id varchar(50) not null,
        trip_id varchar(50) not null,
        title varchar(100) not null,
        address varchar(200),
        url varchar(500),
        memo TEXT,
        primary key (id)
    );

    create table travel_reservations (
        cancel_by timestamp(6),
        ends_at timestamp(6),
        starts_at timestamp(6),
        version bigint not null,
        status varchar(20) not null,
        type varchar(20) not null,
        activity_id varchar(50),
        attachment_item_id varchar(50) not null,
        id varchar(50) not null,
        trip_id varchar(50) not null,
        confirmation varchar(100),
        title varchar(100) not null,
        address varchar(200),
        url varchar(500),
        memo TEXT,
        primary key (id)
    );

    create table trips (
        custom_target_budget integer,
        end_date date not null,
        start_date date not null,
        version integer not null,
        created_at timestamp(6) not null,
        owner_id varchar(50) not null,
        trip_id varchar(50) not null,
        timezone varchar(60) not null,
        title varchar(100) not null,
        destination varchar(200),
        description varchar(255),
        legacy_archive TEXT,
        notes TEXT,
        primary key (trip_id)
    );

    create table users (
        created_at timestamp(6) not null,
        google_token_expires_at timestamp(6),
        provider varchar(20) not null check ((provider in ('LOCAL','GOOGLE'))),
        role varchar(20) not null check ((role in ('USER','ADMIN'))),
        nickname varchar(50) not null,
        user_id varchar(50) not null,
        email varchar(100) not null unique,
        google_access_token varchar(512),
        google_refresh_token varchar(512),
        google_granted_scopes varchar(2000),
        password varchar(255),
        primary key (user_id)
    );

    create table wishlists (
        currency varchar(3) not null,
        current_amount numeric(18,2) not null,
        monthly_target_amount numeric(18,2) not null,
        priority integer not null,
        target_amount numeric(18,2) not null,
        target_date date,
        completed_at timestamp(6),
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        icon_color varchar(20),
        status varchar(20) not null,
        goal_type varchar(30) not null,
        linked_account_id varchar(50),
        user_id varchar(50) not null,
        wish_id varchar(50) not null,
        title varchar(100) not null,
        description text,
        primary key (wish_id)
    );

    create table workspace_entries (
        completed boolean not null,
        end_date date,
        position integer not null,
        start_date date,
        created_at timestamp(6) not null,
        updated_at timestamp(6) not null,
        version bigint,
        format varchar(20) not null,
        kind varchar(20) not null check ((kind in ('EVENT','TEMPLATE','ROADMAP','MILESTONE','TASK','SCHEDULE','RECORD','COMMENT','PDF','WORD'))),
        id varchar(36) not null,
        parent_id varchar(36),
        user_id varchar(50) not null,
        title varchar(200) not null,
        body text not null,
        details text not null,
        primary key (id)
    );

    create table workspace_preferences (
        version bigint,
        user_id varchar(50) not null,
        settings text not null,
        primary key (user_id)
    );

    create index idx_account_transfer_user_date 
       on account_transfers (user_id, transferred_at);

    create index idx_account_transfer_source 
       on account_transfers (source_account_id);

    create index idx_account_transfer_destination 
       on account_transfers (destination_account_id);

    create index idx_foreign_tx_account_date 
       on foreign_currency_transactions (account_id, transaction_date);

    create index idx_investment_account_snapshot_date 
       on investment_account_snapshots (account_id, snapshot_date);

    create index idx_investment_notes_account_updated 
       on investment_notes (account_id, updated_at);

    create index idx_investment_plan_items_plan 
       on investment_plan_items (investment_plan_id);

    create index idx_investment_plans_user_status 
       on investment_plans (user_id, status);

    create index idx_investment_price_investment_quoted 
       on investment_price_snapshots (investment_id, quoted_at);

    create index idx_investment_tx_investment_date 
       on investment_transactions (investment_id, trade_date);

    create index idx_investment_tx_trade_type 
       on investment_transactions (trade_type);

    create index idx_investments_account_active 
       on investments (account_id, is_active);

    create index idx_investments_account_asset 
       on investments (account_id, asset_class);

    create index travel_places_trip_idx 
       on travel_places (trip_id);

    create index travel_reservations_trip_idx 
       on travel_reservations (trip_id);

    create index idx_workspace_owner_kind 
       on workspace_entries (user_id, kind);

    create index idx_workspace_parent 
       on workspace_entries (user_id, parent_id);

    alter table if exists activities 
       add constraint FKsfjlubexde07ksblsk6lcchij 
       foreign key (day_id) 
       references days;

    alter table if exists budget_items 
       add constraint FKswlpm3l9mdgy3im36b2lfrarl 
       foreign key (trip_id) 
       references trips;

    alter table if exists checklist_attachments 
       add constraint FKqyw9o6l9h3gqtqwh78343dms3 
       foreign key (item_id) 
       references checklist_items;

    alter table if exists checklist_attachments 
       add constraint FKcm7y9p4s77u5n5asax5gd8jbi 
       foreign key (uploaded_by_id) 
       references users;

    alter table if exists checklist_items 
       add constraint FKr0pvhhpa73t0mvh62d6epltf9 
       foreign key (created_by_id) 
       references users;

    alter table if exists checklist_items 
       add constraint FKbyj9bfqt66ctptdxdht26xhuh 
       foreign key (owner_id) 
       references users;

    alter table if exists checklist_items 
       add constraint FK2ssdudso4kspxtmr0v4eym1qf 
       foreign key (trip_id) 
       references trips;

    alter table if exists days 
       add constraint FK7dspvcfhrejvpgmi5s6s4s5fj 
       foreign key (trip_id) 
       references trips;

    alter table if exists investment_account_snapshots 
       add constraint fk_investment_snapshots_account 
       foreign key (account_id) 
       references accounts;

    alter table if exists investment_account_snapshots 
       add constraint fk_investment_snapshots_user 
       foreign key (user_id) 
       references users;

    alter table if exists investment_notes 
       add constraint fk_investment_notes_account 
       foreign key (account_id) 
       references accounts;

    alter table if exists investment_notes 
       add constraint fk_investment_notes_user 
       foreign key (user_id) 
       references users;

    alter table if exists investment_plan_items 
       add constraint fk_investment_plan_items_investment 
       foreign key (investment_id) 
       references investments;

    alter table if exists investment_plan_items 
       add constraint fk_investment_plan_items_plan 
       foreign key (investment_plan_id) 
       references investment_plans;

    alter table if exists investment_plans 
       add constraint fk_investment_plans_account 
       foreign key (investment_account_id) 
       references accounts;

    alter table if exists investment_plans 
       add constraint fk_investment_plans_source_account 
       foreign key (source_account_id) 
       references accounts;

    alter table if exists investment_plans 
       add constraint fk_investment_plans_user 
       foreign key (user_id) 
       references users;

    alter table if exists investment_price_snapshots 
       add constraint fk_investment_prices_investment 
       foreign key (investment_id) 
       references investments;

    alter table if exists investment_target_allocations 
       add constraint fk_investment_targets_account 
       foreign key (account_id) 
       references accounts;

    alter table if exists investment_target_allocations 
       add constraint fk_investment_targets_user 
       foreign key (user_id) 
       references users;

    alter table if exists investment_transactions 
       add constraint fk_investment_transactions_investment 
       foreign key (investment_id) 
       references investments;

    alter table if exists investments 
       add constraint fk_investments_account 
       foreign key (account_id) 
       references accounts;

    alter table if exists investments 
       add constraint fk_investments_user 
       foreign key (user_id) 
       references users;

    alter table if exists travel_places 
       add constraint FKj8hv537hrnlqbxm0rv8mlp1k6 
       foreign key (trip_id) 
       references trips;

    alter table if exists travel_reservations 
       add constraint FKos6tlq7mvsu3899ccc3nlb6t5 
       foreign key (trip_id) 
       references trips;
