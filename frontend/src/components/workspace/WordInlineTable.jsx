import { useState } from 'react';
import { useWorkspace } from './workspaceContext';
import { messageOf } from '../../api/workspace';
function WordRow({item,onAdvanced}) {
  const {save,remove,mastery}=useWorkspace();
  const [edit,setEdit]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const value=edit || item;
  const change=(key,next)=>{setEdit(current=>({...current || item,[key]:next}));setNotice('');};
  return <tr><td><input aria-label={`${item.title} 암기 완료`} type="checkbox" checked={item.completed} disabled={busy} onChange={async e=>{setBusy(true);try{await mastery([item.id],e.target.checked);}catch(error){setNotice(messageOf(error));}finally{setBusy(false);}}}/></td>
    <td data-label="단어"><input aria-label={`${item.title} 단어 수정`} maxLength={200} disabled={busy} value={value.title} onChange={e=>change('title',e.target.value)}/></td>
    <td data-label="읽는 법"><input aria-label={`${item.title} 읽는 법 수정`} maxLength={200} disabled={busy} value={value.details.reading || ''} onChange={e=>change('details',{...value.details,reading:e.target.value})}/></td>
    <td data-label="뜻 / 예문"><input aria-label={`${item.title} 뜻 수정`} maxLength={10000} disabled={busy} value={value.body} onChange={e=>change('body',e.target.value)}/></td>
    <td><button type="button" className="ws-button" disabled={busy||!edit} onClick={async()=>{setBusy(true);try{await save(edit);setEdit(null);setNotice('저장됨');}catch(error){setNotice(messageOf(error));}finally{setBusy(false);}}}>저장</button><details className="word-row-actions"><summary>기타</summary>{onAdvanced&&<button type="button" className="ws-button" disabled={busy||Boolean(edit)} onClick={()=>onAdvanced(item)}>언어·페이지 편집</button>}<button type="button" className="ws-button danger" disabled={busy} onClick={async()=>{if(!confirm('이 단어를 삭제할까요?'))return;setBusy(true);try{await remove(item.id);}catch(error){setNotice(messageOf(error));}finally{setBusy(false);}}}>삭제</button></details><small role="status" className={`word-row-state ${notice==='저장됨'?'is-saved':notice?'is-error':''}`}>{busy?'저장 중…':edit?'저장 필요':notice}</small></td></tr>;
}
export default function WordInlineTable({words,onAdvanced}) {
  return <div className="word-input-table is-editing"><table><thead><tr><th>암기</th><th>단어</th><th>읽는 법</th><th>뜻 / 예문</th><th>저장</th></tr></thead><tbody>{words.map(word=><WordRow key={word.id} item={word} onAdvanced={onAdvanced}/>)}</tbody></table></div>;
}

