import { layoutWeekSpans, prioritizeDailyEvents } from '../../services/calendarSpans';
import { dateKey } from './learningHelpers';
import '../../styles/calendar-spans.css';
export default function CalendarGrid({gridRef,days,view,events,eventLimit,selected,focus,onSelect,onOpen,onDrop,onMore,onProjects}) {
  const count=view==='day'?1:7;
  const weeks=Array.from({length:Math.ceil(days.length/count)},(_,i)=>days.slice(i*count,(i+1)*count));
  return <><div ref={gridRef} className={`calendar-grid spanning is-${view}`}>
    {weeks.map(week=>{
      const spans=view==='day'?[]:layoutWeekSpans(events,week);
      const shownSpans=spans.filter(s=>s.lane<(view==='month'?1:8));
      const rows=shownSpans.length?Math.max(...shownSpans.map(s=>s.lane))+1:0;
      return <div className="calendar-week" key={week[0]} style={{'--span-rows':rows,gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>
        {week.map(key=>{
          const all=events.filter(e=>e.startDate<=key&&(e.endDate || e.startDate)>=key);
          const singles=prioritizeDailyEvents(all.filter(e=>view==='day'||!e.endDate||e.endDate===e.startDate));
          const visible=singles.slice(0,view==='month'?Math.max(1,eventLimit-rows):100);
          const hiddenDaily=singles.length-visible.length;
          return <div key={key} className={`calendar-cell ${key===selected?'selected':''} ${key===dateKey()?'today':''} ${key.slice(0,7)!==focus.slice(0,7)?'other-month':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,key)}>
            <button className="calendar-date" aria-label={`${key} 일정 보기`} onClick={()=>onSelect(key)}>{Number(key.slice(-2))}</button>
            <div className="calendar-single-events" style={{paddingTop:rows*(view==='month'?17:19)}}>{visible.map(e=><button key={e.id} aria-label={e.title} className={`calendar-event ${e.completed?'completed':''}`} style={{'--event-color':e.details.color || '#6b90c8'}} title={e.title} onClick={()=>{onSelect(key);onOpen(e);}} draggable={!e.google&&['EVENT','SCHEDULE'].includes(e.kind)} onDragStart={drag=>drag.dataTransfer.setData('text/plain',e.id)}>{e.kind==='SCHEDULE'&&<span aria-hidden="true">{e.completed?'✓ ':'· '}</span>}{e.details.startTime&&<small>{e.details.startTime} </small>}{e.title}</button>)}
            {hiddenDaily>0&&view!=='day'&&<button className="calendar-more" aria-label={`${key} 숨긴 일정 ${hiddenDaily}개 더 보기`} title="당일 일정을 상세 목록에서 모두 보기" onClick={()=>{onSelect(key);onMore?.();}}>＋{hiddenDaily}</button>}</div>
          </div>;
        })}
        {shownSpans.length>0&&<div className="calendar-span-layer" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>{shownSpans.map(({event:e,start,end,lane,continuesBefore,continuesAfter})=><button key={e.id} className={`calendar-period ${e.completed?'completed':''} ${continuesBefore?'continues-before':''} ${continuesAfter?'continues-after':''}`} style={{gridColumn:`${start+1} / ${end+2}`,gridRow:lane+1,'--event-color':e.details.color || '#9a83c3'}} title={`${e.title} · ${e.startDate} ~ ${e.endDate}`} aria-label={`${e.title} 기간 ${e.startDate}부터 ${e.endDate}까지`} onClick={()=>{onSelect(week[start]);onOpen(e);}} draggable={!e.google&&e.kind==='EVENT'} onDragStart={drag=>drag.dataTransfer.setData('text/plain',e.id)}>{continuesBefore?'‹ ':''}{e.completed?'✓ ':''}{e.title}{continuesAfter?' ›':''}</button>)}</div>}
        {spans.length>shownSpans.length&&<button type="button" className="calendar-project-more" aria-label={`${week[0]} 주 기간 프로젝트 ${spans.length}개 보기`} onClick={()=>onProjects?.({week,events:spans.map(s=>s.event)})}>기간 ＋{spans.length-shownSpans.length}</button>}
      </div>;
    })}
  </div></>;
}
