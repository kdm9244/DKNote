import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from './workspaceContext';
import { messageOf } from '../../api/workspace';

export default function LinkedMaterials({ item, value, onChange, disabled = false }) {
  const { entries, save } = useWorkspace();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const storedIds = value ?? item?.details?.materialIds;
  const ids = Array.isArray(storedIds) ? storedIds.filter(id=>typeof id === 'string') : [];
  const materials = entries.filter(e => ['RECORD', 'PDF', 'MEMO'].includes(e.kind));
  const linked = materials.filter(e => ids.includes(e.id));
  const results = materials.filter(e=>e.title.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = async id => {
    if (disabled || saving.current) return;
    const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
    if (onChange) { onChange(next); return; }
    saving.current = true;
    setBusy(true); setError('');
    try { await save(item, { details: { ...item.details, materialIds: next } }); }
    catch (e) { setError(messageOf(e)); }
    finally { saving.current = false; setBusy(false); }
  };
  const href = e => e.kind === 'MEMO' ? `/notes?memo=${encodeURIComponent(e.id)}` : `/learning/${e.kind === 'PDF' ? 'pdf' : 'records'}/${e.id}`;
  return <section className="linked-materials" aria-label="연결된 자료">
    <h3>연결된 자료 <small>{linked.length}개</small></h3>
    <p className="ws-muted">하나의 일정에 여러 학습노트·PDF·메모를 연결할 수 있습니다.</p>
    {linked.map(e => <div key={e.id}><Link to={href(e)}>{e.kind === 'PDF' ? 'PDF' : e.kind === 'MEMO' ? '메모' : '학습노트'} · {e.title}</Link></div>)}
    {!linked.length && <p className="ws-muted">연결된 자료가 없습니다.</p>}
    <details><summary>자료 연결·해제</summary>
      <label className="ws-field">자료 검색<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="자료 제목 검색"/></label>
      <div style={{maxHeight: 220, overflowY: 'auto'}}>
        {results.map(e=><label key={e.id} style={{display:'flex', gap:8, padding:'6px 0', overflowWrap:'anywhere'}}>
          <input type="checkbox" checked={ids.includes(e.id)} disabled={disabled || busy} onChange={()=>toggle(e.id)}/>
          {e.kind === 'PDF' ? 'PDF' : e.kind === 'MEMO' ? '메모' : '학습노트'} · {e.title}
        </label>)}
      </div>
      {!materials.length && <p className="ws-muted">자료를 작성한 뒤 이곳에서 연결하세요.</p>}
      {materials.length > 0 && !results.length && <p className="ws-muted" role="status">검색 결과가 없습니다.</p>}
    </details>
    <small className="ws-muted" role="status" aria-live="polite">{onChange ? '일정을 저장하면 연결 변경이 반영됩니다.' : busy ? '저장 중…' : error ? '저장하지 못했습니다. 연결은 변경되지 않았습니다. 다시 선택해 주세요.' : '연결 변경은 자동 저장됩니다.'}</small>
    {error && <p role="alert" className="ws-alert">{error}</p>}
  </section>;
}
