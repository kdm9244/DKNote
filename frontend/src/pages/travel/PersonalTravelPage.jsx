import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import FeatureSidebar from '../../components/workspace/FeatureSidebar';
import { useWorkspace } from '../../components/workspace/workspaceContext';
import TravelForm from './TravelForm';
import TravelFiles from './TravelFiles';
import { travelRequest as request } from '../../api/travel';
import { ACTIVITY_TYPES, mapsLink, money, safeLink, scheduleWarnings } from '../../services/travelPlanning';
import '../../styles/personal-travel.css';

const dateHere = () => {const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export default function PersonalTravelPage() {
  const { tripId } = useParams(), location = useLocation(), navigate = useNavigate(), { user } = useWorkspace();
  const section = tripId ? location.pathname.split('/')[3] || 'itinerary' : 'list';
  const [data,setData] = useState(null), [items,setItems] = useState([]), [dayId,setDayId] = useState('');
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [form,setForm] = useState(()=>new URLSearchParams(location.search).get('create')==='trip'?{kind:'trip',key:'trip--new',initial:{startDate:dateHere(),endDate:dateHere()}}:null);
  const [attachmentId,setAttachmentId] = useState(null), [showInfo,setShowInfo] = useState(false), [listFilter,setListFilter] = useState('전체');
  const generation = useRef(0);
  const drafts = useRef(new Map()), previousTrip = useRef(tripId);
  useEffect(()=>{if(previousTrip.current!==tripId){previousTrip.current=tripId;drafts.current.clear();setForm(null);setShowInfo(false);}},[tripId]);
  const load = useCallback(async () => {
    const number=++generation.current;
    if (!tripId) {const next=await request('/api/travel/trips');if(number===generation.current)setItems(next);return;}
    let next=await request(`/api/travel/trips/${tripId}`);
    // Import existing browser-only notes/photos as a private archive after server ownership succeeds.
    const migrationKey=`personal_travel_import_${user?.userId || user?.id}_${tripId}`;
    if(user && !localStorage.getItem(migrationKey)) {
      const oldNote=localStorage.getItem(`travel_planner_notes_${tripId}`), archive={};
      for(let i=0;i<localStorage.length;i++) {
        const key=localStorage.key(i);
        if(key.startsWith(`travel_planner_reviews_${tripId}_`) || key.startsWith(`travel_planner_photos_${tripId}_`) || key===`travel_planner_trip_info_${tripId}`) {
          try { archive[key]=JSON.parse(localStorage.getItem(key)); } catch { /* Retain malformed legacy data in local storage. */ }
        }
      }
      const serialized=JSON.stringify(archive);let migrationComplete=true;
      if(oldNote || Object.keys(archive).length) {
        if(serialized.length>2000000) {
          migrationComplete=false;
          setNotice('이전 사진 기록은 용량이 커서 이 브라우저에 보존했습니다. 여행 정보에서 이전 기록을 내려받을 수 있습니다.');
          next.legacyArchive=serialized;
        } else {
          try {
            await request(`/api/travel/trips/${tripId}/legacy`,'POST',{notes:oldNote,archive:serialized,version:next.trip.version});
            next=await request(`/api/travel/trips/${tripId}`);
          } catch {
            migrationComplete=false;
            setNotice('이전 브라우저 기록의 계정 저장을 완료하지 못했습니다. 기존 기록은 보존되어 있습니다.');
            next.legacyArchive=serialized;
          }
        }
      }
      if(migrationComplete)localStorage.setItem(migrationKey,'done');
    }
    next.checklist = next.checklist.map(c=>({...c,isChecked:c.isChecked ?? c.checked ?? false}));
    if(number===generation.current){setData(next);setDayId(current=>next.days.some(d=>d.id===current)?current:next.days.find(d=>d.date===dateHere())?.id || next.days[0]?.id || '');}
  },[tripId,user]);
  useEffect(()=>{let active=true;setLoading(true);setData(null);setError('');setAttachmentId(null);load().catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;generation.current++;};},[load]);
  const run=async(action,message='저장했습니다.')=>{
    if(busy)return false;setBusy(true);setError('');setNotice('');
    try{await action();await load();setNotice(message);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}
  };
  const open=(kind,initial={},extra={})=>{
    const key=`${kind}-${initial.id || initial.itemId || `${extra.day || initial.dayId || ''}-${initial.title || 'new'}`}`;
    setError('');setNotice('');setForm({kind,initial,...extra,key,draft:drafts.current.get(key)});
  };
  const closeForm=(discard=false)=>{if(discard)drafts.current.delete(form?.key);setForm(null);setError('');};
  const save=async values=>{
    const {kind,initial,day:targetDay}=form;
    const id=initial.id || initial.itemId;
    const prefix=`/api/travel/trips/${tripId}`;
    if(kind==='trip'&&!tripId){
      setBusy(true);setError('');try{const t=await request('/api/travel/trips','POST',values);setForm(null);navigate(`/trips/${t.id}/itinerary`);}catch(e){setError(e.message);}finally{setBusy(false);}return;
    }
    const path=kind==='trip'?prefix:kind==='activity'?`/api/travel/days/${targetDay || initial.dayId || dayId}/activities${id?`/${id}`:''}`:kind==='checklist'?id?`/api/checklist/${id}`:`/api/trips/${tripId}/checklist`:`${prefix}/${{place:'places',reservation:'reservations',expense:'expenses'}[kind]}${id?`/${id}`:''}`;
    if(await run(()=>request(path,id || kind==='trip'?'PUT':'POST',values))){drafts.current.delete(form.key);setForm(null);}
  };
  const remove=(kind,item)=>{
    if(!window.confirm(`${item.title} 항목을 삭제할까요?${kind==='reservation'?' 첨부파일은 준비물의 서류·티켓에 보존됩니다.':''}`))return;
    const path=kind==='activity'?`/api/travel/activities/${item.id}?version=${item.version}`:kind==='checklist'?`/api/checklist/${item.itemId}`:`/api/travel/trips/${tripId}/${{place:'places',reservation:'reservations',expense:'expenses'}[kind]}/${item.id}?version=${item.version}`;
    run(()=>request(path,'DELETE'),'삭제했습니다.');
  };
  const deleteTrip=async()=>{
    if(busy || !window.confirm('이 여행과 일정·예약·준비물·지출을 모두 삭제할까요? 이 작업은 되돌릴 수 없습니다.'))return;
    setBusy(true);setError('');
    try{await request(`/api/travel/trips/${tripId}?version=${data.trip.version}`,'DELETE');navigate('/planner');}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const move=(a,target,index)=>run(()=>request(`/api/travel/activities/${a.id}/move`,'POST',{dayId:target,index,version:a.version}),'일정을 옮겼습니다.');
  const download=async file=>{try{const blob=await request(file.fileUrl);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.fileName;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e.message);}};
  const allActivities=data?.days.flatMap(d=>d.activities.map(a=>({...a,date:d.date}))) || [];
  const selectedDay=data?.days.find(d=>d.id===dayId), warnings=scheduleWarnings(selectedDay?.activities || []);
  const menu=tripId?[['itinerary','⌁','일정'],['reservations','▤','예약·자료'],['checklist','✓','준비물'],['budget','₩','예산·지출']].map(([key,icon,label])=>({key,icon,label,path:`/trips/${tripId}/${key}`,end:true})).concat([{key:'list',icon:'←',label:'여행 목록',path:'/planner',end:true}])
    :[{key:'list',icon:'⌂',label:'여행 목록',path:'/planner',end:true},{key:'new',icon:'＋',label:'새 여행',onClick:()=>open('trip',{startDate:dateHere(),endDate:dateHere()})}];
  if(tripId&&!['itinerary','reservations','checklist','budget'].includes(section))return <Navigate to={`/trips/${tripId}/itinerary`} replace/>;
  const editor=(kind)=>form?.kind===kind?<TravelForm key={form.key || 'new-trip'} {...form} activities={allActivities} busy={busy} error={error}
    context={kind==='activity'?`${data.days.find(d=>d.id===(form.day || form.initial.dayId || dayId))?.date || ''}에 저장됩니다.`:undefined}
    onSave={save} onClose={()=>closeForm()} onCancel={()=>closeForm(true)}
    onDraftChange={draft=>{drafts.current.set(form.key,draft);setForm(current=>({...current,draft}));}}/>:null;
  const files=(itemId)=>{
    const item=data?.checklist.find(c=>c.itemId===itemId);
    return item&&attachmentId===itemId?<TravelFiles item={item} busy={busy} error={error} onClose={()=>setAttachmentId(null)} onDownload={download}
      onUpload={uploaded=>{const payload=new FormData();for(const f of uploaded)payload.append('files',f);payload.append('scope','PERSONAL');return run(()=>request(`/api/checklist/${itemId}/attachments`,'POST',payload));}}
      onDelete={f=>run(()=>request(`/api/checklist/${itemId}/attachments/${f.attachmentId}`,'DELETE'),'파일을 삭제했습니다.')}/>:null;
  };
  const reservationFileIds=new Set(data?.reservations.map(r=>r.attachmentItemId));
  const prep=data?.checklist.filter(c=>!reservationFileIds.has(c.itemId)) || [];
  return <div className="feature-layout feature-travel personal-travel-page">
    <FeatureSidebar scope="travel" menuItems={menu}/>
    <main className="personal-travel-main">
      <header className="personal-travel-heading"><div><small>MY TRAVEL NOTE</small><h1>{tripId?data?.trip.title || '여행 일정':'나의 여행'}</h1><p>{tripId?`${data?.trip.destination || '목적지 미정'} · ${data?.trip.startDate || ''} — ${data?.trip.endDate || ''}`:'가고 싶은 곳을 모으고, 하루씩 계획해 보세요.'}</p></div><div className="travel-actions">{tripId?<><button disabled={!data||busy} onClick={()=>setShowInfo(!showInfo)} aria-expanded={showInfo}>여행 정보</button><button disabled={!data||busy} onClick={()=>open('trip',data.trip)}>정보 수정</button></>:<button className="is-primary" onClick={()=>open('trip',{startDate:dateHere(),endDate:dateHere()})}>＋ 새 여행</button>}</div></header>
      {error&&!form&&<div className="travel-error" role="alert">{error} <button disabled={busy} onClick={()=>run(load,'다시 불러왔습니다.')}>다시 불러오기</button></div>}
      {notice&&<p className="travel-notice" role="status">{notice}</p>}
      {editor('trip')}
      {loading?<div className="travel-empty">여행을 불러오는 중입니다.</div>:!tripId?<>
        <div className="travel-filters">{['전체','계획 중','여행 중','여행 완료'].map(v=><button key={v} className={listFilter===v?'is-active':''} onClick={()=>setListFilter(v)}>{v}</button>)}</div>
        <div className="personal-trip-grid">{items.filter(t=>listFilter==='전체'||t.status===listFilter).map(t=><Link className="personal-trip-card" key={t.id} to={`/trips/${t.id}/itinerary`}><span className="travel-badge">{t.status}</span><h2>{t.title}</h2><p>{t.destination || '목적지 미정'}</p><time>{t.startDate} — {t.endDate}</time><span className="trip-open">계획 열기 ↗</span></Link>)}</div>{!items.length&&<div className="travel-empty">아직 여행이 없습니다. 새 여행에서 이름과 기간을 정해 주세요.</div>}
      </>:data?<>
        {showInfo&&<section className="travel-card travel-info"><div><strong>{data.trip.status}</strong><span>{data.trip.timezone} 기준</span><p>{data.trip.description}</p><p className="travel-text">{data.trip.notes || '여행 정보 수정에서 메모를 남길 수 있습니다.'}</p></div>{data.legacyArchive&&<details><summary>이전 여행 기록</summary><p>이전 정보와 사진 기록을 내려받을 수 있습니다.</p><button onClick={()=>{const blob=new Blob([data.legacyArchive],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='이전-여행-기록.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>이전 기록 내려받기</button></details>}<button className="travel-delete-trip" disabled={busy} onClick={deleteTrip}>여행 삭제</button></section>}
        {section==='itinerary'&&<>
          <div className="travel-daybar">{data.days.map(d=><button key={d.id} onClick={()=>setDayId(d.id)} className={dayId===d.id?'is-active':''}><b>{d.number}일차</b><small>{d.date.slice(5)}</small></button>)}</div>
          <div className="travel-section-title"><div><h2>{selectedDay?.date} 일정</h2><small>{selectedDay?.activities.length || 0}개 일정 · {data.trip.timezone} 기준</small></div><button className="is-primary" disabled={busy||!selectedDay} onClick={()=>open('activity',{}, {day:dayId})}>＋ 일정 추가</button></div>
          <div className={`travel-plan-grid${form?.kind==='activity'||form?.kind==='place'?' is-editing':''}`}><section className="travel-timeline">
            {!selectedDay?.activities.length&&<div className="travel-empty">아직 일정이 없습니다. 직접 추가하거나 보관한 장소를 일정에 넣어 보세요.</div>}
            {selectedDay?.activities.map((a,index)=><article className="travel-activity travel-card" key={a.id}>
              <div className="travel-time"><strong>{a.startTime?.slice(0,5)||'시간 미정'}</strong><small>{a.endTime?.slice(0,5)||''}</small></div><div className="travel-activity-body"><span className="travel-badge">{ACTIVITY_TYPES[a.type] || '일정'}</span><h3>{a.title}</h3><p>{a.type==='TRANSPORT'?`${a.departureLocation} → ${a.arrivalLocation}`:a.location}</p>{a.memo&&<p className="travel-text">{a.memo}</p>}{Number(a.cost)>0&&<small>예상 {money(a.cost,a.currency)}</small>}{a.travelMinutes>0&&<small>이전 일정에서 이동 {a.travelMinutes}분</small>}
                {warnings.get(a.id)?.map(text=><p className="travel-warning" key={text}>{text}</p>)}
                {data.reservations.filter(r=>r.activityId===a.id).map(r=><Link className="travel-reservation-chip" key={r.id} to={`/trips/${tripId}/reservations`}>▤ {r.title} · {r.status==='BOOKED'?'예약 완료':r.status==='CANCELLED'?'취소':'예약 예정'}</Link>)}
                <div className="travel-actions"><a href={mapsLink(a)} target="_blank" rel="noopener noreferrer">지도 열기 ↗</a><button disabled={busy} onClick={()=>open('activity',a)}>수정</button><button disabled={busy} onClick={()=>remove('activity',a)}>삭제</button></div>
              </div><div className="travel-order"><button aria-label={`${a.title} 위로 이동`} disabled={busy||index===0} onClick={()=>move(a,dayId,index-1)}>↑</button><button aria-label={`${a.title} 아래로 이동`} disabled={busy||index===selectedDay.activities.length-1} onClick={()=>move(a,dayId,index+1)}>↓</button><select aria-label={`${a.title} 날짜 이동`} value={dayId} disabled={busy} onChange={e=>move(a,e.target.value,data.days.find(d=>d.id===e.target.value).activities.length)}>{data.days.map(d=><option value={d.id} key={d.id}>{d.number}일차</option>)}</select></div>
            </article>)}
          </section>{form?.kind==='activity'?<aside className="travel-edit-column">{editor('activity')}</aside>:<aside className="travel-places travel-card">{editor('place')}<div className="travel-section-title"><div><h2>보관한 장소</h2><small>날짜를 정하기 전 모아 두세요.</small></div><button disabled={busy} onClick={()=>open('place')}>＋ 장소</button></div>{!data.places.length&&<p className="travel-help">가고 싶은 식당, 카페, 관광지를 보관할 수 있습니다.</p>}{data.places.map(p=><article key={p.id}><h3>{p.title}</h3><p>{p.address}</p><p className="travel-text">{p.memo}</p><div className="travel-actions"><button disabled={busy||!dayId} onClick={()=>open('activity',{title:p.title,location:p.address,memo:p.memo},{day:dayId})}>이 날짜에 추가</button><button disabled={busy} onClick={()=>open('place',p)}>수정</button><button disabled={busy} onClick={()=>remove('place',p)}>삭제</button><a href={safeLink(p.url)||mapsLink(p)} target="_blank" rel="noopener noreferrer">장소 보기 ↗</a></div></article>)}</aside>}</div>
        </>}
        {section==='reservations'&&<><div className="travel-section-title"><div><h2>예약·자료</h2><small>항공·숙소·입장권과 확인서를 함께 보관합니다.</small></div><button className="is-primary" disabled={busy} onClick={()=>open('reservation')}>＋ 예약 추가</button></div>{editor('reservation')}<div className="travel-resource-grid">{data.reservations.map(r=><article className="travel-card travel-booking" key={r.id}><span className="travel-badge">{r.status==='BOOKED'?'예약 완료':r.status==='CANCELLED'?'취소':'예약 예정'}</span><h3>{r.title}</h3><p>{r.startsAt?.replace('T',' ').slice(0,16) || '일시 미정'}{r.endsAt&&` → ${r.endsAt.replace('T',' ').slice(0,16)}`}</p><p>{r.address}</p>{r.confirmation&&<p>예약번호 <strong>{r.confirmation}</strong></p>}{r.cancelBy&&<p className="travel-warning">취소 기한 {r.cancelBy.replace('T',' ').slice(0,16)}</p>}{r.activityId&&<p>연결 일정: {allActivities.find(a=>a.id===r.activityId)?.title}</p>}<p className="travel-text">{r.memo}</p><div className="travel-actions"><button disabled={busy} onClick={()=>open('reservation',r)}>수정</button><button disabled={busy} aria-expanded={attachmentId===r.attachmentItemId} onClick={()=>setAttachmentId(current=>current===r.attachmentItemId?null:r.attachmentItemId)}>첨부파일 {data.checklist.find(c=>c.itemId===r.attachmentItemId)?.attachments?.length || 0}</button>{safeLink(r.url)&&<a href={safeLink(r.url)} target="_blank" rel="noopener noreferrer">예약 확인 ↗</a>}<button disabled={busy} onClick={()=>remove('reservation',r)}>삭제</button></div>{files(r.attachmentItemId)}</article>)}</div>{!data.reservations.length&&<div className="travel-empty">예약한 항공편이나 숙소부터 추가해 보세요.</div>}</>}
        {section==='checklist'&&<><div className="travel-section-title"><div><h2>준비물</h2><small>{prep.filter(c=>c.isChecked).length} / {prep.length} 준비 완료</small></div><button className="is-primary" disabled={busy} onClick={()=>open('checklist')}>＋ 준비물</button></div>{editor('checklist')}<div className="travel-checklist travel-card">{prep.map(c=><article key={c.itemId}><input type="checkbox" aria-label={c.title} checked={c.isChecked} disabled={busy||!c.toggleable} onChange={()=>run(()=>request(`/api/checklist/${c.itemId}/toggle`,'PATCH'),'체크 상태를 저장했습니다.')}/><div><small>{c.category}</small><strong className={c.isChecked?'is-done':''}>{c.title}</strong>{c.memo&&<p>{c.memo}</p>}</div><div className="travel-actions"><button disabled={busy} aria-expanded={attachmentId===c.itemId} onClick={()=>setAttachmentId(current=>current===c.itemId?null:c.itemId)}>파일 {c.attachments?.length || 0}</button>{c.editable&&<button disabled={busy} onClick={()=>open('checklist',c)}>수정</button>}{c.deletable&&<button disabled={busy} onClick={()=>remove('checklist',c)}>삭제</button>}</div>{files(c.itemId)}</article>)}{!prep.length&&<div className="travel-empty">준비할 물건과 할 일을 추가해 주세요.</div>}</div></>}
        {section==='budget'&&<><div className="travel-section-title"><div><h2>예산·지출</h2><small>개인 여행 비용을 기록합니다.</small></div><button className="is-primary" disabled={busy} onClick={()=>open('expense',{date:selectedDay?.date || data.trip.startDate})}>＋ 지출 추가</button></div>{editor('expense')}<div className="travel-budget-summary"><div className="travel-card"><small>목표 예산</small><strong>{money(data.trip.targetBudget)}</strong><button disabled={busy} onClick={()=>open('trip',data.trip)}>예산 수정</button></div><div className="travel-card"><small>일정 예상 비용</small><strong>{data.budget.plannedKrw===null?'환율 입력 필요':money(data.budget.plannedKrw)}</strong></div><div className="travel-card"><small>실제 지출</small><strong>{data.budget.actualKrw===null?'환율 입력 필요':money(data.budget.actualKrw)}</strong><span>{Object.entries(data.budget.nativeTotals).map(([c,n])=>money(n,c)).join(' · ')}</span></div><div className="travel-card"><small>남은 예산</small><strong>{data.budget.actualKrw===null?'환율 입력 필요':money(Number(data.trip.targetBudget || 0)-data.budget.actualKrw)}</strong></div></div><p className="travel-help">원화 합계는 각 항목에 저장한 환율로 계산합니다. 가계부에는 별도로 등록되며 이 화면에서 자동으로 중복 등록하지 않습니다.</p><div className="travel-expenses travel-card">{data.expenses.map(e=><article key={e.id}><div><small>{e.date} · {e.category}</small><h3>{e.title}</h3>{e.memo&&<p>{e.memo}</p>}</div><div><strong>{money(e.amount,e.currency)}</strong>{e.currency!=='KRW'&&<small>{e.fxRate?`적용 환율 ${e.fxRate}원 / 1 ${e.currency}`:'환율 입력 필요'}</small>}</div><div className="travel-actions"><button disabled={busy} onClick={()=>open('expense',e)}>수정</button><button disabled={busy} onClick={()=>remove('expense',e)}>삭제</button></div></article>)}{!data.expenses.length&&<div className="travel-empty">아직 지출 기록이 없습니다.</div>}</div></>}
      </>:null}
    </main>

  </div>;
}
