-- Apply to a restored verification database first; stop old server and back up before production.
BEGIN;
CREATE TABLE IF NOT EXISTS app_schema_migrations (name varchar(100) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM app_schema_migrations WHERE name='20261011-personal-travel') THEN
    ALTER TABLE trips ADD COLUMN owner_id varchar(50);
    UPDATE trips t SET owner_id=tm.owner_id FROM teams tm WHERE t.team_id=tm.team_id;
    IF EXISTS (SELECT 1 FROM trips WHERE owner_id IS NULL) THEN
        RAISE EXCEPTION 'Trip ownership is unresolved; migration rolled back.';
    END IF;
    ALTER TABLE trips ALTER COLUMN owner_id SET NOT NULL;
    ALTER TABLE trips ADD CONSTRAINT trips_owner_fk FOREIGN KEY(owner_id) REFERENCES users(user_id);
    CREATE INDEX trips_owner_idx ON trips(owner_id);
    UPDATE activities a SET title=o.title,cost=o.cost FROM activity_options o WHERE o.activity_id=a.activity_id AND o.is_winner=true;
    ALTER TABLE trips DROP COLUMN team_id;
    ALTER TABLE trips DROP COLUMN is_finalized;
    ALTER TABLE trips ADD COLUMN destination varchar(200);
    ALTER TABLE trips ADD COLUMN notes text;
    ALTER TABLE trips ADD COLUMN legacy_archive text;
    ALTER TABLE trips ADD COLUMN timezone varchar(60) NOT NULL DEFAULT 'Asia/Seoul';
    ALTER TABLE activities DROP COLUMN is_locked;
    ALTER TABLE activities DROP COLUMN is_voting_enabled;
    ALTER TABLE activities ALTER COLUMN start_time DROP NOT NULL;
    ALTER TABLE activities ALTER COLUMN end_time DROP NOT NULL;
    ALTER TABLE activities ALTER COLUMN cost TYPE numeric(18,2);
    ALTER TABLE activities ADD COLUMN currency varchar(10) NOT NULL DEFAULT 'KRW';
    ALTER TABLE activities ADD COLUMN fx_rate numeric(18,6);
    ALTER TABLE activities ADD COLUMN travel_minutes integer NOT NULL DEFAULT 0;
    ALTER TABLE activities ADD COLUMN version bigint NOT NULL DEFAULT 0;
    UPDATE activities SET fx_rate=1 WHERE currency='KRW';
    ALTER TABLE budget_items ALTER COLUMN amount TYPE numeric(18,2);
    ALTER TABLE budget_items ADD COLUMN fx_rate numeric(18,6);
    ALTER TABLE budget_items ADD COLUMN version bigint NOT NULL DEFAULT 0;
    UPDATE budget_items SET fx_rate=1 WHERE currency='KRW';
    DROP TABLE poll_votes;
    DROP TABLE poll_options;
    DROP TABLE polls;
    DROP TABLE survey_answers;
    DROP TABLE survey_responses;
    DROP TABLE survey_questions;
    DROP TABLE surveys;
    DROP TABLE activity_options;
    DROP TABLE budget_deposits;
    INSERT INTO app_schema_migrations(name) VALUES('20261011-personal-travel');
END IF;
END $$;
COMMIT;
