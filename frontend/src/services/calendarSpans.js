// Pack each week's clipped intervals into stable, non-overlapping lanes.
export function prioritizeDailyEvents(events) {
  return [...events].sort((a,b)=>Number(Boolean(a.completed))-Number(Boolean(b.completed)));
}
export function layoutWeekSpans(events,days) {
  if(!days.length)return [];
  const first=days[0],last=days.at(-1);
  const spans=events.filter(e=>e.startDate&&e.endDate>e.startDate&&e.startDate<=last&&e.endDate>=first)
    .map(event=>({event,start:Math.max(0,days.findIndex(d=>d>=event.startDate)),end:event.endDate>=last?days.length-1:days.findLastIndex(d=>d<=event.endDate),continuesBefore:event.startDate<first,continuesAfter:event.endDate>last}))
    .sort((a,b)=>a.event.startDate.localeCompare(b.event.startDate)||(b.end-b.start)-(a.end-a.start)||a.event.id.localeCompare(b.event.id));
  const laneEnds=[];
  return spans.map(span=>{let lane=laneEnds.findIndex(end=>end<span.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=span.end;return {...span,lane};});
}
