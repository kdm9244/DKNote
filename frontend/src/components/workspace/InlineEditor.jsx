import { useEffect, useRef } from 'react';
import '../../styles/inline-editor.css';

export default function InlineEditor({title,onClose,children,wide=false,busy=false}) {
  const ref=useRef(null);
  useEffect(()=>{
    ref.current?.scrollIntoView({block:'nearest',behavior:'smooth'});
    ref.current?.querySelector('input:not([type="checkbox"]),textarea')?.focus({preventScroll:true});
  },[]);
  return <section ref={ref} className={`ws-inline-editor ws-panel${wide?' is-wide':''}`} role="region" aria-label={title}>
    <header><h2>{title}</h2><button type="button" className="ws-button" disabled={busy} onClick={onClose} aria-label="편집 닫기">접기</button></header>
    {children}
  </section>;
}
