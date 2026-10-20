ALTER TABLE workspace_entries DROP CONSTRAINT IF EXISTS workspace_entries_kind_check;
ALTER TABLE workspace_entries ADD CONSTRAINT workspace_entries_kind_check
    CHECK (kind IN ('EVENT','TEMPLATE','ROADMAP','MILESTONE','TASK','SCHEDULE','RECORD','COMMENT','PDF','WORD','MEMO'));
