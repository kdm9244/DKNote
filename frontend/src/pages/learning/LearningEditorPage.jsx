import { useMemo } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import WorkspaceShell from '../../components/workspace/WorkspaceShell';
import { useWorkspace } from '../../components/workspace/workspaceContext';
import { dateKey, KIND_LABEL } from '../../components/workspace/learningHelpers';
import LearningEditor from './LearningEditor';

const kinds={roadmaps:'ROADMAP',milestones:'MILESTONE',tasks:'TASK',records:'RECORD'};
const sections=Object.fromEntries(Object.entries(kinds).map(([section,kind])=>[kind,section]));
const parents={ROADMAP:[],MILESTONE:['ROADMAP'],TASK:['MILESTONE'],RECORD:['ROADMAP','MILESTONE','TASK']};
export default function LearningEditorPage() {
  const {editorSection,entryId}=useParams(),[params]=useSearchParams(),location=useLocation(),navigate=useNavigate();
  const {entries}=useWorkspace(),kind=kinds[editorSection];
  const existing=entries.find(e=>e.id===entryId&&e.kind===kind);
  const parentId=entryId?existing?.parentId:params.get('parent');
  const parent=entries.find(e=>e.id===parentId&&parents[kind]?.includes(e.kind));
  const item=useMemo(()=>entryId?existing:{
    kind,title:'',body:'',parentId:parent?.id || null,startDate:kind==='RECORD'?dateKey():parent?.startDate || dateKey(),
    endDate:kind==='RECORD'?null:parent?.endDate || dateKey(),format:kind==='RECORD'?'richtext':'plain',
    position:entries.filter(e=>e.kind===kind&&e.parentId===(parent?.id || null)).length,details:{},
  },[entryId,existing,kind,parent,entries]);
  if(!kind)return <Navigate to="/learning" replace/>;
  const fallback=entryId?`/learning/${editorSection}/${entryId}`:parent?`/learning/${sections[parent.kind]}/${parent.id}`:`/learning/${editorSection}`;
  const previous=location.state?.returnTo;
  const returnTo=typeof previous==='string'&&/^\/learning(?:\/|\?|$)/.test(previous)&&previous!==location.pathname+location.search?previous:fallback;
  return <WorkspaceShell active="learning" title={`${KIND_LABEL[kind]} ${entryId?'편집':'작성'}`}
    subtitle={parent?`${KIND_LABEL[parent.kind]} · ${parent.title}`:kind==='RECORD'?'오늘 배운 내용을 기록하세요.':'공부할 목표와 기간을 정하세요.'}>
    {item?<LearningEditor key={entryId || `new-${kind}-${parent?.id || 'independent'}`} item={item}
      onClose={()=>navigate(returnTo,{replace:true})}
      onSaved={result=>navigate(`/learning/${sections[result.kind]}/${result.id}`,{replace:true})}/>:<div className="ws-empty">
        {kind==='RECORD'?'노트가 없거나 접근할 수 없습니다.':'항목이 없거나 접근할 수 없습니다.'} <Link className="ws-button" to={`/learning/${editorSection}`}>목록으로</Link>
      </div>}
  </WorkspaceShell>;
}
