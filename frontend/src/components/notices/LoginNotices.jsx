import { useEffect,useRef,useState } from 'react';
import NoticeCard from './NoticeCard';
import {Link} from 'react-router-dom';
import usePublicNotices from './usePublicNotices';

export default function LoginNotices() {
  const {notices,loading,error,retry}=usePublicNotices();
  const [selected,setSelected]=useState(0);
  const content=useRef(null);
  useEffect(()=>{if(content.current)content.current.scrollTop=0;},[selected]);
  return <aside className="auth-updates" aria-label="업데이트 소식">
    <header className="auth-updates-heading"><span className="auth-updates-label"><i aria-hidden="true"/>새로운 소식</span><h2>업데이트 소식</h2><p>DKNote에서 달라진 점을 확인하세요.</p></header>
    <div className="auth-updates-content" ref={content} tabIndex={0} aria-label="공지 내용">
      {loading?<p className="notice-empty" role="status">소식을 불러오는 중…</p>:error?<div className="notice-empty"><p>소식을 불러오지 못했습니다.</p><button type="button" onClick={retry}>다시 불러오기</button></div>:notices.length?<NoticeCard key={notices[selected]?.id} notice={notices[selected]||notices[0]} level={3}/>:<div className="notice-empty"><strong>새로운 소식을 준비하고 있어요.</strong><p>업데이트가 등록되면 이곳에서 확인할 수 있습니다.</p></div>}
    </div>
    <footer className="auth-updates-footer"><span>{notices.length&&!loading&&!error?`${selected+1} / ${notices.length}`:'업데이트 안내'}</span>{notices.length>1&&!loading&&!error&&<nav aria-label="공지 이동"><button type="button" disabled={selected===0} onClick={()=>setSelected(n=>n-1)}>‹ 최신 소식</button><button type="button" disabled={selected===notices.length-1} onClick={()=>setSelected(n=>n+1)}>이전 소식 ›</button></nav>}</footer>
    <Link className="auth-updates-mobile-link" to="/news" state={{fromLogin:true}}><span><small>업데이트 소식{notices[0]&&` · ${notices[0].createdAt.slice(0,10)}`}</small><strong>{loading?'소식을 불러오는 중…':notices[0]?.title||'업데이트 안내'}</strong></span><span>전체 보기 →</span></Link>
  </aside>;
}
