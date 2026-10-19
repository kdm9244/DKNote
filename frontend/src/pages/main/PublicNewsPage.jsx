import {useLocation,useNavigate} from 'react-router-dom';
import NoticeCard from '../../components/notices/NoticeCard';
import usePublicNotices from '../../components/notices/usePublicNotices';

export default function PublicNewsPage() {
  const {notices,loading,error,retry}=usePublicNotices(),navigate=useNavigate(),location=useLocation();
  return <div className="public-news-page">
    <header><button type="button" className="notice-button" onClick={()=>location.state?.fromLogin?navigate(-1):navigate('/login',{replace:true})}>← 로그인으로</button><span>DKNote</span></header>
    <h1>업데이트 소식</h1><p className="public-news-intro">새로운 기능과 달라진 점을 확인하세요.</p>
    {loading?<p role="status">소식을 불러오는 중…</p>:error?<div className="notice-alert" role="alert"><p>소식을 불러오지 못했습니다.</p><button className="notice-button" onClick={retry}>다시 불러오기</button></div>:notices.length?<div className="public-news-list">{notices.map(n=><NoticeCard key={n.id} notice={n}/>)}</div>:<p className="notice-empty">새로운 소식을 준비하고 있어요.</p>}
  </div>;
}
