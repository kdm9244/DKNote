import MainPortalSidebar from "../main/MainPortalSidebar";
import { useWorkspace } from "./workspaceContext";
import "../../styles/main-portal.css";
import "../../styles/workspace.css";
import "../../styles/workspace-viewport.css";
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
