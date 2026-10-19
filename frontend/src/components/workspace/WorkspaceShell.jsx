import MainPortalSidebar from "../main/MainPortalSidebar";
import { useWorkspace } from "./workspaceContext";
import "../../styles/main-portal.css";
import "../../styles/workspace.css";
import "../../styles/workspace-viewport.css";
import "../../styles/notice-publisher.css";
import FeatureSidebar from "./FeatureSidebar";

export default function WorkspaceShell({
  active,
  title,
  subtitle,
  actions,
  children,
  sidebarContent,
}) {
  const { user, loading, error } = useWorkspace();
  if(user?.role==='NOTICE_PUBLISHER')return <div className="notice-publisher-page" style={{maxWidth:1160,margin:'0 auto',padding:'24px 16px'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:24}}><strong>DKNote · 공지 등록</strong><button className="ws-button" onClick={()=>{sessionStorage.removeItem('accessToken');window.location.assign('/login');}}>로그아웃</button></header>
    <main><h1>{title}</h1><p className="ws-muted">공지 등록 전용 계정입니다.</p><div className="ws-actions" style={{margin:'16px 0'}}>{actions}</div>{error&&<p className="ws-alert" role="alert">{error}</p>}{loading?<p role="status">불러오는 중…</p>:children}</main>
  </div>;
  return (
    <div
      className={`main-portal-layout workspace-layout feature-layout feature-${active} ${active === "home" ? "is-home" : ""}`}
    >
      {["calendar", "learning"].includes(active) ? (
        <FeatureSidebar scope={active} extra={sidebarContent} />
      ) : (
        <MainPortalSidebar active={active} user={user} />
      )}
      <main className="workspace-main">
        <header className="workspace-heading">
          <div>
            <small>
              DKNOTE ·{" "}
              {active === "calendar"
                ? "SCHEDULE"
                : active === "learning"
                  ? "LEARNING"
                  : "MY WORKSPACE"}
            </small>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="ws-actions">{actions}</div>
        </header>
        {error && (
          <div role="alert" className="ws-alert">
            {error}{" "}
            <button onClick={() => window.location.reload()}>
              다시 불러오기
            </button>
          </div>
        )}
        {loading ? (
          <div className="ws-empty" role="status">
            나의 공간을 불러오는 중…
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
