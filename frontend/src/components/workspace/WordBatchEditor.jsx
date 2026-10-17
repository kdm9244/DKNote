import { useEffect, useState } from 'react';
import { useWorkspace } from './workspaceContext';
import { messageOf } from '../../api/workspace';
import { parseWordPaste,wordIdentity } from '../../services/wordPaste';
import '../../styles/learning-editor.css';
export default function WordBatchEditor({parentId=null,page=1}) {
  const {entries,importWords,uid}=useWorkspace();
  const draftKey=`dknote_words_draft_${uid}_${parentId || 'library'}_${page}`;
  const [initial]=useState(()=>{try{return JSON.parse(localStorage.getItem(draftKey)) || {};}catch{return {};}});
  const [text,setText]=useState(initial.text || ''),[rows,setRows]=useState(initial.rows || []),[language,setLanguage]=useState(initial.language || 'ja'),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [requestId,setRequestId]=useState(()=>initial.requestId || crypto.randomUUID());
  useEffect(()=>{try{if(text||rows.length)localStorage.setItem(draftKey,JSON.stringify({text,rows,language,requestId}));else localStorage.removeItem(draftKey);}catch{setNotice('브라우저 임시 저장 공간이 부족합니다. 단어를 등록하세요.');}},[draftKey,text,rows,language,requestId]);
  const update=(i,key,value)=>{setRows(current=>current.map((r,n)=>n===i?{...r,[key]:value}:r));setRequestId(crypto.randomUUID());};
  const review=()=>{try{setRows(parseWordPaste(text).map(r=>({...r,selected:true})));setRequestId(crypto.randomUUID());setNotice('표에서 내용을 확인하고 등록할 단어를 선택하세요.');}catch(e){setNotice(e.message);}};
  const duplicates=new Set(entries.filter(e=>e.kind==='WORD').map(e=>wordIdentity(e.title,e.details.language || 'other')));
  return <section className="word-import">
    <h3>단어 표 입력 · 여러 줄 붙여넣기</h3>
    <p className="ws-muted">단어만 붙여넣거나, 단어·뜻 또는 단어·읽는 법·뜻을 탭으로 나눠 붙여넣으세요. 뜻은 나중에 채울 수 있습니다.</p>
    <textarea aria-label="여러 단어 붙여넣기" maxLength={100000} placeholder={'可用性\tかようせい\t가용성\n冗長化\t이중화'} value={text} onChange={e=>setText(e.target.value)} />
    <div className="ws-actions"><button className="ws-button" type="button" disabled={busy} onClick={review}>붙여넣기 미리보기</button><button className="ws-button" type="button" disabled={busy||rows.length>=200} onClick={()=>{setRows([...rows,{title:'',reading:'',body:'',selected:true}]);setRequestId(crypto.randomUUID());}}>＋ 입력 행</button><select aria-label="일괄 등록 언어" value={language} onChange={e=>{setLanguage(e.target.value);setRequestId(crypto.randomUUID());}}><option value="ja">일본어</option><option value="en">영어</option><option value="ko">한국어</option><option value="other">기타</option></select></div>
    {rows.length>0&&<><div className="word-input-table"><table><thead><tr><th>선택</th><th>단어</th><th>읽는 법</th><th>뜻 / 예문</th><th>중복</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i} className={duplicates.has(wordIdentity(r.title,language))?'duplicate':''}><td><input type="checkbox" aria-label={`${i+1}행 등록`} checked={r.selected} onChange={e=>update(i,'selected',e.target.checked)} disabled={busy}/></td>{['title','reading','body'].map((key,j)=><td key={key}><input aria-label={`${i+1}행 ${['단어','읽는 법','뜻'][j]}`} value={r[key]} maxLength={key==='body'?10000:200} onChange={e=>update(i,key,e.target.value)} disabled={busy}/></td>)}<td>{duplicates.has(wordIdentity(r.title,language))?'기존 단어':''}</td></tr>)}</tbody></table></div><p className="ws-muted">같은 PDF·페이지의 단어·읽는 법·뜻이 모두 같은 항목은 자동으로 건너뜁니다. 다른 출처는 별도로 연결됩니다.</p><button className="ws-button primary" type="button" disabled={busy||!rows.some(r=>r.selected&&r.title.trim())} onClick={async()=>{setBusy(true);try{const selected=rows.filter(r=>r.selected);if(selected.some(r=>!r.title.trim()))throw new Error('선택한 행에 단어를 입력하세요.');const result=await importWords({requestId,parentId,page,language,rows:selected.map(({title,reading,body})=>({title,reading,body}))});setNotice(`${result.length}개 단어를 등록했습니다. 중복 ${selected.length-result.length}개는 건너뛰었습니다.`);setRows([]);setText('');setRequestId(crypto.randomUUID());}catch(e){setNotice(e.response?messageOf(e):e.message);}finally{setBusy(false);}}}>{busy?'등록 중…':'선택한 단어 일괄 등록'}</button></>}
    {notice&&<p role="status" className="pdf-note-state">{notice}</p>}
  </section>;
}
