import { useEffect, useRef, useState } from 'react';

export default function TablePicker({disabled,onInsert}) {
  const [open,setOpen]=useState(false),[size,setSize]=useState({rows:3,cols:3}),[header,setHeader]=useState(true);
  const [left,setLeft]=useState(0);
  const root=useRef(null),trigger=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const close=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    document.addEventListener('pointerdown',close);
    return()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const insert=(rows,cols)=>{
    onInsert({rows:Math.max(1,Math.min(30,Math.trunc(Number(rows))||1)),cols:Math.max(1,Math.min(12,Math.trunc(Number(cols))||1)),withHeaderRow:header});
    setOpen(false);
  };
  return <div className="rich-table-picker" ref={root} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
    <button ref={trigger} type="button" disabled={disabled} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{setLeft(Math.min(0,window.innerWidth-16-root.current.getBoundingClientRect().left-254));setOpen(v=>!v);}}>▦ 표 만들기</button>
    {open&&<div className="rich-table-popover" style={{left}} role="dialog" aria-label="표 크기 선택">
      <strong aria-live="polite">{size.rows}행 × {size.cols}열</strong>
      <div className="rich-table-grid" role="grid" aria-label="표 크기 격자" onKeyDown={e=>{
        const delta={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]}[e.key];if(!delta)return;
        e.preventDefault();const rows=Math.max(1,Math.min(8,size.rows+delta[0])),cols=Math.max(1,Math.min(8,size.cols+delta[1]));
        setSize({rows,cols});root.current.querySelector(`[data-cell="${rows}-${cols}"]`)?.focus();
      }}>
        {Array.from({length:8},(_,r)=><div role="row" key={r}>{Array.from({length:8},(_,c)=><button role="gridcell" type="button" key={c} data-cell={`${r+1}-${c+1}`} aria-label={`${r+1}행 ${c+1}열 표 삽입`} aria-selected={r<size.rows&&c<size.cols} tabIndex={r+1===size.rows&&c+1===size.cols?0:-1} onFocus={()=>setSize({rows:r+1,cols:c+1})} onPointerEnter={()=>setSize({rows:r+1,cols:c+1})} onClick={()=>insert(r+1,c+1)}/>)}</div>)}
      </div>
      <label><input type="checkbox" checked={header} onChange={e=>setHeader(e.target.checked)}/> 첫 행을 제목으로</label>
      <details><summary>크기 직접 입력</summary><div className="rich-table-custom"><label>행<input aria-label="표 행 수" type="number" min="1" max="30" value={size.rows} onChange={e=>setSize(s=>({...s,rows:e.target.value}))}/></label><label>열<input aria-label="표 열 수" type="number" min="1" max="12" value={size.cols} onChange={e=>setSize(s=>({...s,cols:e.target.value}))}/></label><button type="button" onClick={()=>insert(size.rows,size.cols)}>표 삽입</button></div></details>
    </div>}
  </div>;
}
