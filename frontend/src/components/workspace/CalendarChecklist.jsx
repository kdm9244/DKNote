import { useState } from 'react';

export default function CalendarChecklist({ event, saving, error, onToggle, onChange }) {
  const [editing,setEditing]=useState(null),[title,setTitle]=useState(''),[expanded,setExpanded]=useState(false),[menu,setMenu]=useState(null);
  const checks = event.details.checks || [];
  if (!checks.length) return null;
  return <fieldset className="calendar-day-checks" disabled={saving} aria-busy={saving}>
    <legend>체크 {checks.filter(check => check.done).length}/{checks.length}</legend>
    {(expanded?checks:checks.slice(0,5)).map((check, index) => <div className="calendar-check-row" key={check.id || index}><label className={check.done ? 'is-done' : ''}>
      <input type="checkbox" checked={Boolean(check.done)} onChange={() => onToggle(event, index)} />
      <span>{check.title}</span>
    </label>{onChange && (!event.google || event.sidecar) && <div className="calendar-check-actions">
      <button type="button" aria-label={`${check.title} 메뉴`} aria-expanded={menu===index} onClick={()=>setMenu(menu===index?null:index)}>⋯</button>
      {menu===index&&<div className="calendar-check-menu" onKeyDown={e=>{if(e.key==='Escape')setMenu(null);}}>
      <button type="button" aria-label={`${check.title} 수정`} onClick={()=>{setMenu(null);setEditing(index);setTitle(check.title);}}>수정</button>
      <button type="button" aria-label={`${check.title} 삭제`} onClick={async()=>{if(await onChange(event,checks.filter((_,i)=>i!==index))){setEditing(null);setMenu(null);}}}>삭제</button></div>}
    </div>}{editing===index && <div className="calendar-check-edit">
      <input aria-label="체크 항목 내용" maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/>
      <button type="button" disabled={!title.trim()} onClick={async()=>{if(await onChange(event,checks.map((c,i)=>i===index?{...c,title:title.trim()}:c)))setEditing(null);}}>저장</button>
      <button type="button" onClick={()=>setEditing(null)}>취소</button>
    </div>}</div>)}
    {checks.length>5&&<button type="button" className="ws-button calendar-check-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'접기':`나머지 ${checks.length-5}개 보기`}</button>}
    {saving && <small role="status">저장 중…</small>}
    {error && <p className="calendar-check-error" role="alert">{error}</p>}
  </fieldset>;
}
