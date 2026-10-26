export const recordDraftPrefix = uid => `dknote_draft_${uid}_RECORD_`;
export const recordDraftKey = (uid, id) => `${recordDraftPrefix(uid)}draft_${id}`;
export const validDraftId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');

export function hasDraftContent(draft) {
  return Boolean(draft.title?.trim() || draft.body?.replace(/<[^>]*>/g, '').trim() || /<(table|hr)\b/i.test(draft.body || ''));
}

// Includes legacy drafts shared by all new notes under the same goal.
export function recordDrafts(uid) {
  const drafts = [];
  try {
    const prefix = recordDraftPrefix(uid);
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const draft = JSON.parse(localStorage.getItem(key));
        if (draft?.kind !== 'RECORD' || draft.id || !hasDraftContent(draft)) continue;
        const suffix = key.slice(prefix.length);
        drafts.push({key, draft, id:suffix.startsWith('draft_') && validDraftId(suffix.slice(6)) ? suffix.slice(6) : null});
      } catch { /* An invalid draft must not hide other recoverable notes. */ }
    }
  } catch { /* Draft storage is optional; saving notes still works. */ }
  return drafts;
}
