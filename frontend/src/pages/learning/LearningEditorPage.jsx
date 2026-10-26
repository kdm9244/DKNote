import { useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { useWorkspace } from '../../components/workspace/workspaceContext';
import { dateKey, KIND_LABEL, parentLabel } from '../../components/workspace/learningHelpers';
import { recordDraftKey, recordDrafts, validDraftId } from '../../services/learningDrafts';
import LearningEditor from './LearningEditor';

const kinds={roadmaps:'ROADMAP',milestones:'MILESTONE',tasks:'TASK',records:'RECORD'};
const sections=Object.fromEntries(Object.entries(kinds).map(([section,kind])=>[kind,section]));
const parents={ROADMAP:[],MILESTONE:['ROADMAP'],TASK:['MILESTONE'],RECORD:['ROADMAP','MILESTONE','TASK']};
export default function LearningEditorPage() {
  const {editorSection,entryId}=useParams(),[params]=useSearchParams(),location=useLocation(),navigate=useNavigate();
  const {entries,uid}=useWorkspace(),kind=kinds[editorSection];
  const [freshId] = useState(()=>crypto.randomUUID());
  const [draftError, setDraftError] = useState('');
  const isNewRecord = !entryId && kind === 'RECORD';
  const draftId = validDraftId(params.get('draft')) ? params.get('draft') : null;
  const drafts = isNewRecord ? recordDrafts(uid).filter(d=>d.id !== draftId) : [];
  const existing=entries.find(e=>e.id===entryId&&e.kind===kind);
  const parentId=entryId?existing?.parentId:params.get('parent');
  const parent=entries.find(e=>e.id===parentId&&parents[kind]?.includes(e.kind));
  const item=useMemo(()=>entryId?existing:{
    kind,title:'',body:'',parentId:parent?.id || null,startDate:kind==='RECORD'?dateKey():parent?.startDate || dateKey(),
    endDate:kind==='RECORD'?null:parent?.endDate || dateKey(),format:kind==='RECORD'?'richtext':'plain',
    position:entries.filter(e=>e.kind===kind&&e.parentId===(parent?.id || null)).length,details:{},
  },[entryId,existing,kind,parent,entries]);
  if(!kind)return <Navigate to="/learning" replace/>;
  if(isNewRecord && !draftId) {
    const search = new URLSearchParams(params);
    search.set('draft', freshId);
    return <Navigate to={{pathname:location.pathname,search:`?${search}`}} replace state={location.state}/>;
  }
  const fallback=entryId?`/learning/${editorSection}/${entryId}`:parent?`/learning/${sections[parent.kind]}/${parent.id}`:`/learning/${editorSection}`;
  const previous=location.state?.returnTo;
  const returnTo=typeof previous==='string'&&/^\/learning(?:\/|\?|$)/.test(previous)&&previous!==location.pathname+location.search?previous:fallback;
  const resumeDraft = saved => {
    try {
      const id = saved.id || crypto.randomUUID();
      if (!saved.id) {
        localStorage.setItem(recordDraftKey(uid,id), JSON.stringify(saved.draft));
        localStorage.removeItem(saved.key);
      }
      const search = new URLSearchParams({draft:id});
      if (saved.draft.parentId) search.set('parent',saved.draft.parentId);
      setDraftError('');
      navigate(`/learning/records/new?${search}`,{state:{returnTo}});
    } catch { setDraftError('초안을 열지 못했습니다. 브라우저 저장 공간을 확인한 뒤 다시 시도하세요. 기존 초안은 유지됩니다.'); }
  };
  return <WorkspaceShell active="learning" title={`${KIND_LABEL[kind]} ${entryId?'편집':'작성'}`}
    subtitle={parent?`${KIND_LABEL[parent.kind]} · ${parent.title}`:kind==='RECORD'?'오늘 배운 내용을 기록하세요.':'공부할 목표와 기간을 정하세요.'}>
    {isNewRecord && drafts.length>0 && <details className="learning-draft-list"><summary>작성 중인 노트 {drafts.length}개 · 이어서 작성</summary><p>새 노트는 빈 내용으로 시작합니다. 이전 초안을 계속 쓰려면 아래에서 선택하세요.</p><ul>{drafts.map(saved=><li key={saved.key}><button type="button" className="ws-button" onClick={()=>resumeDraft(saved)}>{saved.draft.title || '제목 없는 노트'} · 이어서 작성</button><small>{parentLabel(entries,saved.draft) || '독립 노트'}</small></li>)}</ul></details>}
    {draftError && <p role="alert" className="ws-alert">{draftError}</p>}
    {item?<LearningEditor key={entryId || (isNewRecord ? draftId : `new-${kind}-${parent?.id || 'independent'}`)} item={item} draftId={draftId}
      onClose={()=>navigate(returnTo,{replace:true})}
      onSaved={result=>navigate(`/learning/${sections[result.kind]}/${result.id}`,{replace:true})}/>:<div className="ws-empty">
        {kind==='RECORD'?'노트가 없거나 접근할 수 없습니다.':'항목이 없거나 접근할 수 없습니다.'} <Link className="ws-button" to={`/learning/${editorSection}`}>목록으로</Link>
      </div>}
  </WorkspaceShell>;
}
