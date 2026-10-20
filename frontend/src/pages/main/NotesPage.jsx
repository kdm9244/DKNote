import { useEffect, useRef, useState } from 'react';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { useWorkspace } from '../../components/workspace/workspaceContext';
import { messageOf } from '../../api/workspace';
import '../../styles/main-portal.css';
import '../../styles/personal-notes.css';

function MemoEditor({ memo, uid, save }) {
  const key = `dknote_memo_${uid}_${memo.id}`;
  const base = useRef(memo);
  const initial = () => {
    try { return JSON.parse(localStorage.getItem(key)) || { title: memo.title, body: memo.body, pinned: !!memo.details?.pinned }; }
    catch { return { title: memo.title, body: memo.body, pinned: !!memo.details?.pinned }; }
  };
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const failed = useRef(false);
  const latest = useRef(draft); latest.current = draft;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const change = (changes) => {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Server saving remains available. */ }
    failed.current = false; setDraft(next); setStatus('저장 대기 중…');
  };
  useEffect(() => {
    const current = base.current;
    if (draft.title === current.title && draft.body === current.body && draft.pinned === !!current.details?.pinned) return;
    if (saving || failed.current) return;
    if (!draft.title.trim()) { setStatus('제목을 입력하면 자동 저장합니다.'); return; }
    const timer = setTimeout(async () => {
      const snapshot = draft;
      setSaving(true); setStatus('저장 중…');
      try {
        const result = await save(base.current, { title: snapshot.title.trim(), body: snapshot.body, details: { ...base.current.details, pinned: snapshot.pinned } });
        base.current = result;
        if (latest.current === snapshot) {
          // Keep the editor and the trimmed server title in sync without another write.
          latest.current = { ...snapshot, title: result.title };
          try { localStorage.removeItem(key); } catch { /* Optional local draft. */ }
          if (mounted.current) { setDraft(latest.current); setStatus('저장됨'); }
        }
      } catch (error) {
        failed.current = true;
        if (mounted.current) setStatus(messageOf(error));
      } finally { if (mounted.current) setSaving(false); }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, saving, retry, key, save]);
  return <section className="ws-panel memo-editor">
    <div className="ws-section-title"><h2>메모 작성</h2><label><input type="checkbox" checked={draft.pinned} onChange={e => change({ pinned: e.target.checked })} /> 상단 고정</label></div>
    <label className="ws-field">제목<input aria-label="메모 제목" maxLength={200} value={draft.title} onChange={e => change({ title: e.target.value })} /></label>
    <label className="ws-field memo-body">내용<textarea aria-label="메모 내용" maxLength={500000} placeholder="생각이나 할 일을 자유롭게 적어보세요." value={draft.body} onChange={e => change({ body: e.target.value })} /></label>
    <div className="memo-save"><span role="status">{status || '변경하면 자동 저장합니다.'}</span><button className="ws-button" disabled={saving} onClick={() => { failed.current = false; setRetry(n => n + 1); }}>지금 저장</button></div>
  </section>;
}

export default function NotesPage() {
  const { entries, uid, save, remove, loading, error } = useWorkspace();
  const [selected, setSelected] = useState(null), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const memos = entries.filter(e => e.kind === 'MEMO').sort((a, b) => Number(!!b.details?.pinned) - Number(!!a.details?.pinned) || b.updatedAt.localeCompare(a.updatedAt));
  const visible = memos.filter(e => `${e.title} ${e.body}`.toLowerCase().includes(query.toLowerCase()));
  const current = memos.find(e => e.id === selected);
  const create = async () => {
    setBusy(true); setNotice('');
    try { const result = await save({ kind: 'MEMO', title: '새 메모', body: '', format: 'plain', details: {} }); setSelected(result.id); }
    catch (e) { setNotice(messageOf(e)); } finally { setBusy(false); }
  };
  const deleteMemo = async (memo) => {
    if (!window.confirm(`‘${memo.title}’ 메모를 삭제할까요?`)) return;
    setBusy(true); setNotice('');
    try {
      await remove(memo.id);
      try { localStorage.removeItem(`dknote_memo_${uid}_${memo.id}`); } catch { /* Optional local draft. */ }
      if (selected === memo.id) setSelected(null);
    } catch (e) { setNotice(messageOf(e)); } finally { setBusy(false); }
  };
  return <WorkspaceShell active="notes" title="메모" subtitle="생각, 할 일, 발견한 내용을 자유롭게 적어두세요.">
      {(notice || error) && <p className="ws-alert" role="alert">{notice || error}</p>}
      <div className="memo-layout"><section className="ws-panel memo-list">
        <div className="ws-section-title"><h2>내 메모 {memos.length}</h2><button className="ws-button primary" disabled={busy || loading} onClick={create}>＋ 새 메모</button></div>
        <input aria-label="메모 검색" placeholder="제목·내용 검색" value={query} onChange={e => setQuery(e.target.value)} />
        {loading ? <p>불러오는 중…</p> : !visible.length && <p className="ws-muted">{query ? '검색 결과가 없습니다.' : '새 메모를 작성해 보세요.'}</p>}
        {visible.map(memo => <article key={memo.id} className={selected === memo.id ? 'is-selected' : ''}>
          <button className="memo-select" onClick={() => setSelected(memo.id)}><strong>{memo.details?.pinned ? '📌 ' : ''}{memo.title}</strong><span>{memo.body.slice(0, 100) || '내용 없음'}</span><small>{new Date(memo.updatedAt).toLocaleString('ko-KR')}</small></button>
          <button className="ws-button" aria-label={`${memo.title} 삭제`} disabled={busy} onClick={() => deleteMemo(memo)}>삭제</button>
        </article>)}
      </section>{current ? <MemoEditor key={current.id} memo={current} uid={uid} save={save} /> : <section className="ws-panel memo-placeholder"><p>메모를 선택하거나 새로 작성하세요.</p></section>}</div>
  </WorkspaceShell>;
}
