BEGIN;
DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM app_schema_migrations WHERE name='20261011-personal-checklist') THEN
    UPDATE checklist_items c SET memo=concat_ws(E'\n',NULLIF(c.memo,''),'이전 담당자: '||u.nickname)
    FROM team_members tm JOIN users u ON u.user_id=tm.user_id WHERE c.assignee_member_id=tm.team_member_id;
    UPDATE checklist_items SET memo=concat_ws(E'\n',NULLIF(memo,''),'이전 담당: '||assignee) WHERE assignee IS NOT NULL AND assignee<>'';
    ALTER TABLE checklist_items DROP COLUMN assignee_member_id;
    ALTER TABLE checklist_items DROP COLUMN assignee;
    INSERT INTO app_schema_migrations(name) VALUES('20261011-personal-checklist');
END IF;
END $$;
COMMIT;
