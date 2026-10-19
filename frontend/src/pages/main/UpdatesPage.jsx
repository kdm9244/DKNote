import { useEffect,useRef,useState } from 'react';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import NoticeCard from '../../components/notices/NoticeCard';
import api from '../../api/client';
import { messageOf } from '../../api/workspace';

const emptyNotice=()=>({title:'',releaseVersion:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date()).replaceAll('-','.'),body:''});

export default function UpdatesPage() {
  const [data,setData]=useState({canManage:false,canPublish:false,notices:[]});
  const [form,setForm]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[mobilePreview,setMobilePreview]=useState(false);
  const textarea=useRef(null);
  useEffect(()=>{let active=true;api.get('/api/notices').then(r=>{if(active)setData(r.data);}).catch(e=>{if(active)setError(messageOf(e));}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const begin=notice=>{setForm(notice);setMobilePreview(false);setError('');};
  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await(form.id?api.put(`/api/notices/${form.id}`,form):api.post('/api/notices',form));
      setData(d=>({...d,notices:[r.data,...d.notices.filter(n=>n.id!==r.data.id)].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}));setForm(null);
    }catch(e){setError(messageOf(e));}finally{setBusy(false);}
  };
  const addBullet=()=>{
    const input=textarea.current;if(!input)return;
    const start=form.body.lastIndexOf('\n',Math.max(0,input.selectionStart-1))+1;
    const end=form.body.indexOf('\n',input.selectionEnd),until=end<0?form.body.length:end;
    const text=form.body.slice(start,until).split('\n').map(line=>/^\s*[•*-]\s/.test(line)?line:`• ${line}`).join('\n');
    setForm(f=>({...f,body:f.body.slice(0,start)+text+f.body.slice(until)}));
    requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+text.length,start+text.length);});
  };
  return <WorkspaceShell active="updates" title="업데이트 소식" subtitle="로그인 화면에 표시할 소식을 작성하고 관리하세요." actions={(data.canPublish||data.canManage)&&!form&&<button className="ws-button primary" disabled={busy} onClick={()=>begin(emptyNotice())}>공지 작성</button>}>
    <div className="notices-page">
      {error&&<p className="notice-alert" role="alert">{error}</p>}
      {form&&<section className={`notice-composer${mobilePreview?' shows-preview':''}`} aria-label="공지 작성">
        <header className="notice-composer-heading"><div><span className="notice-eyebrow">공지 작성</span><h2>{form.id?'공지를 수정해요':'새로운 소식을 전해요'}</h2><p>저장한 공지는 로그인 화면에 표시됩니다.</p></div></header>
        <div className="notice-mobile-tabs" role="group" aria-label="작성 화면 선택"><button type="button" aria-pressed={!mobilePreview} onClick={()=>setMobilePreview(false)}>작성</button><button type="button" aria-pressed={mobilePreview} onClick={()=>setMobilePreview(true)}>미리보기</button></div>
        <form onSubmit={submit}>
          <div className="notice-composer-grid">
            <div className="notice-compose-fields">
              <div className="notice-meta-fields"><label>제목<input required maxLength={200} placeholder="예: 더 편리해진 PDF와 학습노트" disabled={busy} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><label>버전<input required maxLength={40} placeholder="예: 2026.10.19" disabled={busy} value={form.releaseVersion} onChange={e=>setForm({...form,releaseVersion:e.target.value})}/></label></div>
              <label className="notice-content-label" htmlFor="notice-body">업데이트 내용</label>
              <div className="notice-writing-area"><div className="notice-writing-tools"><button type="button" disabled={busy} onClick={addBullet}>• 목록 넣기</button><span>변경한 내용을 한 줄씩 작성해 주세요.</span></div><textarea id="notice-body" ref={textarea} required maxLength={20000} placeholder={'• PDF 글자를 선택하고 복사할 수 있어요.\n• 학습노트의 표를 자유롭게 편집할 수 있어요.'} disabled={busy} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/><small className="notice-character-count">{form.body.length.toLocaleString()} / 20,000</small></div>
            </div>
            <aside className="notice-preview" aria-label="공지 미리보기"><div className="notice-preview-label"><span>미리보기</span><small>로그인 화면에 이렇게 보여요</small></div><NoticeCard notice={{...form,createdAt:form.createdAt||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date())}} level={3} preview/></aside>
          </div>
          <footer className="notice-compose-footer"><p>작성 내용을 미리보기에서 확인해 주세요.</p><button type="button" className="notice-button" disabled={busy} onClick={()=>setForm(null)}>취소</button><button className="notice-button is-primary" disabled={busy||!form.title.trim()||!form.body.trim()||!form.releaseVersion.trim()}>{busy?'저장 중…':'공지 저장'}</button></footer>
        </form>
      </section>}
      {loading?<p className="notice-empty" role="status">공지를 불러오는 중…</p>:!data.notices.length&&!error?<div className="notice-empty notice-list-empty"><strong>첫 소식을 기다리고 있어요.</strong><p>새로운 기능과 바뀐 점을 공지로 남겨보세요.</p></div>:<section className="notice-list" aria-label="등록한 공지">{data.notices.map(n=><div key={n.id} className="notice-list-entry"><NoticeCard notice={n}/>{data.canManage&&<div className="notice-entry-actions"><button className="notice-button" disabled={busy} onClick={()=>begin(n)}>수정</button><button className="notice-button is-danger" disabled={busy} onClick={async()=>{if(!confirm('이 공지를 삭제할까요?'))return;setBusy(true);setError('');try{await api.delete(`/api/notices/${n.id}`,{params:{version:n.version}});setData(d=>({...d,notices:d.notices.filter(v=>v.id!==n.id)}));}catch(e){setError(messageOf(e));}finally{setBusy(false);}}}>삭제</button></div>}</div>)}</section>}
    </div>
  </WorkspaceShell>;
}
