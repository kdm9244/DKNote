import { useId, useMemo, useState } from 'react';
import { KIND_LABEL } from './learningHelpers';
import '../../styles/learning-goal-picker.css';

const levels = ['ROADMAP', 'MILESTONE', 'TASK'];
const levelLabels = ['로드맵', '세부 목표', '학습 할 일'];

// A level may be the final destination; selecting a child is always optional.
export default function LearningGoalPicker({ entries, value, onChange, label = '연결할 목표', emptyLabel = '독립 노트', disabled = false }) {
  const id = useId();
  const [query, setQuery] = useState('');
  const { goals, paths, labels } = useMemo(() => {
    const goals = entries.filter(e => levels.includes(e.kind));
    const byId = new Map(goals.map(e => [e.id, e]));
    const paths = new Map(), labels = new Map();
    for (const goal of goals) {
      const path = [], seen = new Set();
      let current = goal;
      while (current && !seen.has(current.id)) {
        seen.add(current.id);
        path.unshift(current);
        current = byId.get(current.parentId);
      }
      paths.set(goal.id, path);
      labels.set(goal.id, path.map(e => e.title).join(' / '));
    }
    return { goals, paths, labels };
  }, [entries]);
  const path = paths.get(value) || [];
  const selected = path.at(-1);
  const search = query.trim().toLocaleLowerCase();
  const results = search ? goals.filter(e => labels.get(e.id).toLocaleLowerCase().includes(search)) : [];
  const choose = next => { onChange(next || null); setQuery(''); };
  return <fieldset className="learning-goal-picker" disabled={disabled}>
    <legend>{label}</legend>
    <div className="goal-search-field">
      <input id={id} type="search" aria-label={`${label} 검색`} placeholder="목표 이름 또는 경로 검색" value={query} onChange={e => setQuery(e.target.value)} />
      {value && <button type="button" className="ws-button" onClick={() => choose(null)}>{emptyLabel}</button>}
    </div>
    {search ? <div className="goal-search-results">
      <p role="status">검색 결과 {results.length}개{results.length > 40 ? ' · 앞 40개 표시, 검색어를 좁혀주세요.' : ''}</p>
      <ul aria-label={`${label} 검색 결과`}>
        {results.slice(0, 40).map(e => <li key={e.id}><button type="button" aria-pressed={value === e.id} onClick={() => choose(e.id)}>
          <span>{KIND_LABEL[e.kind]} · <strong>{e.title}</strong></span>
          <small>{paths.get(e.id).slice(0, -1).map(e => e.title).join(' / ') || '최상위 목표'}</small>
        </button></li>)}
      </ul>
      {!results.length && <small>이름이나 로드맵 경로의 일부로 다시 검색해보세요.</small>}
    </div> : <div className="goal-levels">
      {levels.map((kind, index) => {
        const parent = path.find(e => e.kind === levels[index - 1]);
        const active = path.find(e => e.kind === kind);
        const options = goals.filter(e => e.kind === kind && (!index || e.parentId === parent?.id));
        return <label key={kind}>
          <span>{index + 1}. {levelLabels[index]}</span>
          <select aria-label={`${label} ${levelLabels[index]}`} value={active?.id || ''} disabled={index > 0 && !parent} onChange={e => choose(e.target.value || parent?.id)}>
            <option value="">{index ? '여기까지 연결' : emptyLabel}</option>
            {options.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </label>;
      })}
    </div>}
    <div className="goal-current" aria-live="polite"><span>선택 위치</span><strong>{selected ? labels.get(selected.id) : emptyLabel}</strong></div>
  </fieldset>;
}
