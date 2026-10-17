import { useEffect, useRef, useState } from 'react';
import { ACTIVITY_TYPES, TRAVEL_CURRENCIES } from '../../services/travelPlanning';

const timezones = ['Asia/Seoul', 'Asia/Tokyo', 'Asia/Taipei', 'Asia/Shanghai', 'Asia/Bangkok', 'Asia/Singapore', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Pacific/Honolulu', 'Australia/Sydney'];
const types = Object.entries(ACTIVITY_TYPES);
const currencies = TRAVEL_CURRENCIES.map(c => [c, c]);
// [name, label, input type, optional attributes]
const schemas = {
  trip: [['title','여행 이름','text',{required:true,maxLength:100}],['destination','목적지','text',{maxLength:200}],['startDate','시작일','date',{required:true}],['endDate','종료일','date',{required:true}],['timezone','여행지 시간대','select',{options:timezones.map(v=>[v,v])}],['targetBudget','목표 예산 (원)','number',{min:0,step:1}],['description','짧은 소개','text',{maxLength:255}],['notes','여행 메모','textarea',{maxLength:10000}]],
  activity: [['title','일정 이름','text',{required:true,maxLength:100}],['type','종류','select',{options:types}],['startTime','시작 시간','time'],['endTime','종료 시간','time'],['location','장소·주소','text',{maxLength:200}],['departureLocation','출발지 (이동 일정)','text',{maxLength:200}],['arrivalLocation','도착지 (이동 일정)','text',{maxLength:200}],['travelMinutes','이 일정까지 필요한 이동 시간 (분)','number',{min:0,max:1440,step:1}],['cost','예상 비용','number',{min:0,max:1000000000,step:0.01}],['currency','통화','select',{options:currencies}],['fxRate','1 외화 단위당 원화 환율','number',{min:0.000001,max:1000000000,step:'any'}],['memo','메모','textarea',{maxLength:10000}]],
  place: [['title','장소 이름','text',{required:true,maxLength:100}],['address','주소','text',{maxLength:200}],['url','참고 링크','url',{maxLength:500}],['memo','메모','textarea',{maxLength:10000}]],
  reservation: [['title','예약 이름','text',{required:true,maxLength:100}],['type','예약 종류','select',{options:[['FLIGHT','항공·교통'],['HOTEL','숙소'],['TICKET','입장권'],['OTHER','기타']]}],['status','예약 상태','select',{options:[['PLANNED','예약 예정'],['BOOKED','예약 완료'],['CANCELLED','취소']]}],['confirmation','예약번호','text',{maxLength:100}],['startsAt','이용·체크인 일시','datetime-local'],['endsAt','종료·체크아웃 일시','datetime-local'],['cancelBy','취소 기한','datetime-local'],['address','주소·출발 장소','text',{maxLength:200}],['url','예약 확인 링크','url',{maxLength:500}],['activityId','연결할 일정','select',{options:[]}],['memo','메모','textarea',{maxLength:10000}]],
  expense: [['title','지출 이름','text',{required:true,maxLength:100}],['category','분류','select',{options:['식비','숙소','교통','입장료','쇼핑','기타'].map(v=>[v,v])}],['amount','실제 지출 금액','number',{min:0,max:1000000000,step:0.01,required:true}],['currency','통화','select',{options:currencies}],['fxRate','1 외화 단위당 원화 환율','number',{min:0.000001,max:1000000000,step:'any'}],['date','지출 날짜','date',{required:true}],['paymentMethod','결제 방법','select',{options:[['CASH','현금'],['PERSONAL_CARD','카드'],['OTHER','기타']]}],['memo','메모','textarea',{maxLength:10000}]],
  checklist: [['title','준비물 이름','text',{required:true,maxLength:100}],['category','분류','text',{required:true,maxLength:50}],['memo','메모','textarea',{maxLength:10000}],['linkUrl','참고 링크','url',{maxLength:500}]],
};
const defaults = {status:'PLANNED',currency:'KRW',timezone:'Asia/Seoul',category:'기타',paymentMethod:'CASH',travelMinutes:0,cost:0,amount:0};
const extraFields = {
  trip:['targetBudget','description','notes'],
  activity:['travelMinutes','cost','currency','fxRate','memo'],
  place:['memo'],
  reservation:['cancelBy','address','url','activityId','memo'],
  expense:['memo'],
  checklist:['memo','linkUrl'],
};
export default function TravelForm({ kind, initial = {}, draft, context, activities = [], busy, error, onSave, onClose, onCancel, onDraftChange }) {
  const [values,setValues] = useState(()=>Object.fromEntries(schemas[kind].map(([name])=>[name,draft?.[name] ?? initial[name] ?? (name==='type'?(kind==='activity'?'SPOT':'HOTEL'):defaults[name] ?? '')])));
  const [more,setMore] = useState(()=>extraFields[kind].some(name=>(draft || initial)[name] && (draft || initial)[name]!==defaults[name]));
  const region=useRef(null);
  useEffect(()=>{region.current?.scrollIntoView({block:'nearest',behavior:'smooth'});region.current?.querySelector('input')?.focus({preventScroll:true});},[]);
  const currency=values.currency;
  const title = {trip:'여행 정보',activity:'일정',place:'장소 보관',reservation:'예약·자료',expense:'지출',checklist:'준비물'}[kind];
  const editing=Boolean(initial.id || initial.itemId);
  const caption=kind==='trip'&&!editing?'새 여행 만들기':`${title} ${editing?'수정':'추가'}`;
  const change=(name,value)=>{const next={...values,[name]:value};setValues(next);onDraftChange?.(next);};
  const submit = e => {
    e.preventDefault();
    const data = { ...values, version: initial.version };
    for (const key of ['startTime','endTime','startsAt','endsAt','cancelBy','activityId']) if (key in data && !data[key]) data[key] = null;
    for (const key of ['amount','cost','travelMinutes','targetBudget']) if (key in data) data[key] = Number(data[key] || 0);
    if ('currency' in data) data.fxRate = currency === 'KRW' ? 1 : values.fxRate ? Number(values.fxRate) : null;
    if(kind==='activity'){
      if(data.type==='TRANSPORT')data.location='';
      else {data.departureLocation='';data.arrivalLocation='';}
    }
    if (kind === 'checklist') data.scope = 'PERSONAL';
    onSave(data);
  };
  const field=([name,label,type,attrs = {}])=>{
        if (name === 'fxRate' && currency === 'KRW') return null;
        if(kind==='activity' && ['departureLocation','arrivalLocation'].includes(name) && values.type!=='TRANSPORT')return null;
        if(kind==='activity' && name==='location' && values.type==='TRANSPORT')return null;
        const { options, ...props } = attrs;
        const value = values[name];
        const full=type==='textarea'||['title','destination','location','address','url','departureLocation','arrivalLocation','activityId'].includes(name)||(kind==='activity'&&name==='type');
        return <label key={name} className={full?'is-full':''}><span>{label}</span>{type === 'select'
          ? <select name={name} aria-label={label} value={value} onChange={e=>change(name,e.target.value)} disabled={busy}>{(name==='activityId'?[['','연결하지 않음'],...activities.map(a=>[a.id,`${a.date} · ${a.title}`])]:options).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          : type==='textarea' ? <textarea name={name} value={value} onChange={e=>change(name,e.target.value)} rows={3} disabled={busy} {...props}/>
          : <input name={name} type={type} value={type==='time'?String(value).slice(0,5):type==='datetime-local'?String(value).slice(0,16):value} onChange={e=>change(name,e.target.value)} disabled={busy} required={kind==='activity'&&['departureLocation','arrivalLocation'].includes(name)?true:props.required} {...props}/>}</label>;
  };
  return <section ref={region} className="travel-editor travel-card" role="region" aria-label={caption}>
    <header className="travel-editor-header"><div><h2>{caption}</h2>{context&&<p>{context}</p>}</div><button type="button" disabled={busy} onClick={onClose} aria-label={`${caption} 닫기`}>접기</button></header>
    <form className="travel-form" onSubmit={submit}>
      {schemas[kind].filter(([name])=>!extraFields[kind].includes(name)).map(field)}
      <details className="travel-form-more is-full" open={more} onToggle={e=>setMore(e.currentTarget.open)}><summary>추가 정보{kind==='activity'?' · 이동 시간·비용·메모':''}</summary><div className="travel-form-extra">{schemas[kind].filter(([name])=>extraFields[kind].includes(name)).map(field)}</div></details>
      {kind === 'activity' && <p className="travel-help is-full">시간을 정하지 않았다면 시작·종료를 모두 비워 두세요. 이동 시간은 직접 입력하며 자동 경로 계산은 하지 않습니다.</p>}
      {(kind === 'activity' || kind === 'expense') && currency !== 'KRW' && <p className="travel-help is-full">예: 1엔 = 9원이면 9를 입력합니다. 환율을 비워 두면 원래 금액만 저장하고 원화 합계는 ‘환율 입력 필요’로 표시합니다.</p>}
      {kind==='reservation' && <p className="travel-help is-full">일시는 여행지 시간대 기준입니다. 저장 후 확인서나 티켓을 첨부할 수 있습니다.</p>}
      {error && <p role="alert" className="travel-error is-full">{error}</p>}
      <footer className="is-full"><span className="travel-help">접으면 입력 내용이 유지됩니다.</span><button type="button" disabled={busy} onClick={onCancel}>취소</button><button className="is-primary" disabled={busy}>{busy?'저장 중…':'저장'}</button></footer>
    </form>
  </section>;
}
