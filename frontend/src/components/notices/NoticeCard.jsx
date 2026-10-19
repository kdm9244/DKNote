import '../../styles/notices.css';

function cleanLine(line) {
  return line.replace(/^\s*(?:[-*•·]\s+|\d+[.)]\s+)/,'').trim();
}

export function NoticeBody({ body }) {
  if(!body?.trim())return <p className="notice-placeholder">작성한 내용이 이곳에 표시됩니다.</p>;
  return <div className="notice-body">{body.trim().split(/\n\s*\n/).map((block,index)=>{
    const lines=block.split('\n').map(line=>line.trim()).filter(Boolean);
    return lines.length>1||/^\s*[-*•·]\s+/.test(block)
      ? <ul key={index}>{lines.map((line,i)=><li key={i}>{cleanLine(line)}</li>)}</ul>
      : <p key={index}>{block}</p>;
  })}</div>;
}

export default function NoticeCard({notice,level=2,preview=false}) {
  const Heading=level===3?'h3':'h2';
  return <article className={`notice-card${preview?' is-preview':''}`}>
    <header className="notice-meta"><span className="notice-version">{notice.releaseVersion?.trim()||'버전'}</span>{notice.createdAt&&<time dateTime={notice.createdAt}>{notice.createdAt.slice(0,10).replaceAll('-','. ')}</time>}</header>
    <Heading className="notice-title">{notice.title?.trim()||'공지 제목'}</Heading>
    <NoticeBody body={notice.body}/>
  </article>;
}
