import { useEffect, useRef, useState } from 'react';
import { useWorkspace } from './workspaceContext';
import RichEditor from './RichEditor';
import SaveStatus from './SaveStatus';
import { messageOf } from '../../api/workspace';
export default function PdfPageNotes({pdf,page}) {
  const {uid,savePdfPage}=useWorkspace();
  const draftKey=`dknote_pdf_draft_${uid}_${pdf.id}_${page}`;
  const base=useRef(pdf.details.pages?.[String(page)] || {});
  const [draft,setDraft]=useState(()=>{try{return JSON.parse(localStorage.getItem(draftKey)) || {body:base.current.body || '',format:base.current.format || 'richtext'};}catch{return {body:base.current.body || '',format:base.current.format || 'richtext'};}});
  const [state,setState]=useState(''),[dirty,setDirty]=useState(Boolean(localStorage.getItem(draftKey))),[error,setError]=useState(false);
  const current=useRef(draft);current.current=draft;const inFlight=useRef(false),mounted=useRef(true);
  const change=(body,format)=>{if(!base.current.body&&!current.current.body&&!body.replace(/<[^>]*>/g,'').trim()&&!body.includes('<table'))return;const next={body,format,previousBody:base.current.body??null,previousFormat:base.current.format??null};setDraft(next);current.current=next;setDirty(true);setError(false);setState('임시 저장됨 · 자동 저장 대기');try{localStorage.setItem(draftKey,JSON.stringify(next));}catch{setState('임시 저장 공간 부족 · 서버에 저장하세요.');}};
  const persist=async()=>{
    if(inFlight.current)return;inFlight.current=true;const snapshot={...current.current};
    if(mounted.current)setState('저장 중…');
    try {
      const result=await savePdfPage(pdf.id,page,{body:snapshot.body,format:snapshot.format,previousBody:'previousBody' in snapshot?snapshot.previousBody:base.current.body??null,previousFormat:'previousFormat' in snapshot?snapshot.previousFormat:base.current.format??null});
      base.current=result.details.pages[String(page)];
      if(current.current.body===snapshot.body&&current.current.format===snapshot.format){localStorage.removeItem(draftKey);if(mounted.current){setDirty(false);setState(`${page}페이지 필기를 저장했습니다.`);}}
      else {const next={...current.current,previousBody:base.current.body,previousFormat:base.current.format};current.current=next;localStorage.setItem(draftKey,JSON.stringify(next));if(mounted.current){setDraft(next);setState('자동 저장 대기');}}
    }catch(e){if(mounted.current){setError(true);setState(messageOf(e));}}
    finally{inFlight.current=false;}
  };
  const saveRef=useRef(persist);saveRef.current=persist;
  useEffect(()=>{if(!dirty||error)return;const timer=setTimeout(()=>saveRef.current(),1200);return()=>clearTimeout(timer);},[draft,dirty,error]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{const warn=e=>{if(localStorage.getItem(draftKey)){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[draftKey]);
  const phase=error?'error':state==='저장 중…'?'saving':dirty?'draft':state?'saved':'idle';
  return <><div className="pdf-note-heading"><div><h3>{page}페이지 필기</h3><SaveStatus mode="auto" phase={phase} message={state || (dirty?'초안 복구됨 · 자동 저장 대기':'변경 내용 없음')} /></div></div><RichEditor body={draft.body} format={draft.format} onChange={change} onSave={persist} label="페이지 필기" showHelp={false}/><div className="pdf-note-footer"><button type="button" className="ws-button" onClick={persist} disabled={phase==='saving'}>페이지 필기 저장</button></div></>;
}

