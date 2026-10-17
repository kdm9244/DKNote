-- Back up first. Run against a restored database before applying to the running project.
BEGIN;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM app_schema_migrations WHERE name='20261011-remove-retired-features') THEN
    IF EXISTS (SELECT 1 FROM board_posts) OR EXISTS (SELECT 1 FROM board_post_images)
       OR EXISTS (SELECT 1 FROM board_post_comments) OR EXISTS (SELECT 1 FROM feed_uploads)
       OR EXISTS (SELECT 1 FROM activity_images) THEN
        RAISE EXCEPTION 'Retired feeds/photos contain records; archive migration is required. No tables were removed.';
    END IF;
    -- Retain former metadata in the private archive rather than silently discarding it.
    UPDATE trips SET legacy_archive=json_build_object('priorArchiveText',legacy_archive,
      'removedDatabaseFields',json_build_object('status',status,'totalActualDays',total_actual_days,'coverImageUrl',cover_image_url))::text;
    UPDATE activities SET short_intro=concat_ws(E'\n',NULLIF(short_intro,''),'이전 지도 링크: '||google_map_url)
      WHERE google_map_url IS NOT NULL AND google_map_url<>'';
    UPDATE budget_items SET memo=concat_ws(E'\n',NULLIF(memo,''),'이전 결제자: '||payer_name)
      WHERE payer_name IS NOT NULL AND payer_name<>'';
    UPDATE budget_items SET payment_method='PERSONAL_CARD',memo=concat_ws(E'\n',NULLIF(memo,''),'이전 공금 카드 결제') WHERE payment_method='SHARED_CARD';
    DROP TABLE board_post_comments;
    DROP TABLE board_post_images;
    DROP TABLE board_posts;
    DROP TABLE feed_uploads;
    DROP TABLE activity_images;
    DROP TABLE team_members;
    DROP TABLE teams;
    ALTER TABLE trips DROP COLUMN status;
    ALTER TABLE trips DROP COLUMN total_actual_days;
    ALTER TABLE trips DROP COLUMN cover_image_url;
    ALTER TABLE activities DROP COLUMN status;
    ALTER TABLE activities DROP COLUMN google_place_id;
    ALTER TABLE activities DROP COLUMN google_map_url;
    ALTER TABLE budget_items DROP COLUMN payer_name;
    INSERT INTO app_schema_migrations(name) VALUES('20261011-remove-retired-features');
END IF;
END $$;
COMMIT;
