import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import SidebarUserCard from "../common/SidebarUserCard";
import { useWorkspace } from "./workspaceContext";
import "../../styles/feature-workspaces.css";
import "../../styles/bright-workspaces.css";
import "../../styles/workspace-polish.css";

const MENUS = {
  calendar: [
    ["", "▦", "달력"],
    ["today", "✓", "오늘 일정"],
    ["events", "☷", "일정 목록"],
    ["templates", "▤", "체크리스트 템플릿"],
    ["sources", "⚙", "캘린더·연결 설정"],
  ],
  learning: [
    ["", "⌂", "학습 홈"],
    ["today", "✓", "오늘 할 학습"],
    ["roadmaps", "◇", "로드맵"],
    ["records", "✎", "학습노트·PDF"],
    ["words", "あ", "단어장"],
  ],
};
export default function FeatureSidebar({ scope, extra, menuItems, userOverride }) {
  const { user, entries } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width:760px)").matches,
  );
  const [openRoadmaps, setOpenRoadmaps] = useState(new Set());
  const aside = useRef(null),
    toggle = useRef(null);
  const label = { home: "홈", settings: "설정", mypage: "마이", calendar: "캘린더", learning: "학습", ledger: "가계부", travel: "여행", updates:"업데이트 소식" }[scope] || "홈";
  const [section = "", entityId] = location.pathname
    .replace(new RegExp(`^/${scope}/?`), "")
    .split("/");
  let current = entries.find((e) => e.id === entityId);
  const seen = new Set();
  while (
    current &&
    current.kind !== "ROADMAP" &&
    current.parentId &&
    !seen.has(current.id)
  ) {
    seen.add(current.id);
    current = entries.find((e) => e.id === current.parentId);
  }
  const currentRoadmap = current?.kind === "ROADMAP" ? current.id : null;
  useEffect(() => {
    if (currentRoadmap)
      setOpenRoadmaps((previous) => new Set([...previous, currentRoadmap]));
  }, [currentRoadmap]);
  useEffect(() => {
    const media = window.matchMedia("(max-width:760px)");
    const changed = (e) => {
      setMobile(e.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);
  useLayoutEffect(() => {
    const root = aside.current?.closest(".feature-layout");
    root?.classList.toggle("feature-collapsed", collapsed && !mobile);
    return () => root?.classList.remove("feature-collapsed");
  }, [collapsed, mobile, scope]);
  useEffect(() => {
    if (!mobileOpen) return;
    aside.current?.querySelector("nav a, nav button")?.focus();
    const handle = (e) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        toggle.current?.focus();
      }
      if (e.key === "Tab") {
        const nodes = [
          ...aside.current.querySelectorAll("a,button,select,input"),
        ].filter((n) => !n.disabled && n.getClientRects().length);
        if (!nodes.length) return;
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [mobileOpen]);
  const compact = collapsed && !mobile;
  return (
    <>
      <div className="feature-mobile-bar">
        <Link to="/" aria-label="홈으로">
          ▣
        </Link>
        <strong>{label}</strong>
        <button
          ref={toggle}
          type="button"
          aria-label={`${label} 메뉴 열기`}
          aria-expanded={mobileOpen}
          aria-controls="feature-sidebar"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          ☰ 메뉴
        </button>
      </div>
      {mobileOpen && (
        <button
          type="button"
          className="feature-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => {
            setMobileOpen(false);
            toggle.current?.focus();
          }}
        />
      )}
      <aside
        ref={aside}
        id="feature-sidebar"
        aria-label={`${label} 전용 사이드바`}
        inert={mobile && !mobileOpen}
        className={`feature-sidebar ${compact ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
      >
        <header className="feature-sidebar-header">
          <Link to="/" className="feature-brand" title="DKNote 홈">
            <span>▣</span>
            {!compact && (
              <div>
                <strong>DKNote</strong>
                <small>
                  {label} · MY WORKSPACE
                </small>
              </div>
            )}
          </Link>
          <button
            type="button"
            className="feature-collapse"
            aria-label={
              mobile
                ? "메뉴 닫기"
                : compact
                  ? "사이드바 펼치기"
                  : "사이드바 접기"
            }
            onClick={() =>
              mobile ? setMobileOpen(false) : setCollapsed(!collapsed)
            }
          >
            {compact ? "›" : "‹"}
          </button>
        </header>
        <div className="feature-sidebar-body">
          {!compact && (
            <>
              <Link className="feature-home-link" to="/">
                ← 홈으로 돌아가기
              </Link>
              <label className="feature-space-switch">
                작업 공간
                <select
                  aria-label="작업 공간 이동"
                  value={scope}
                  onChange={(e) =>
                    navigate(
                      {
                        home: "/",
                        settings: "/settings",
                        mypage: "/mypage",
                        calendar: "/calendar",
                        learning: "/learning",
                        ledger: "/ledger",
                        travel: "/planner",
                        updates: "/updates",
                      }[e.target.value],
                    )
                  }
                >
                  <option value="home">홈</option>
                  <option value="calendar">캘린더</option>
                  <option value="learning">학습</option>
                  <option value="ledger">가계부</option>
                  <option value="travel">여행</option>
                  <option value="mypage">마이</option>
                  <option value="settings">설정</option>
                </select>
              </label>
              <p className="feature-menu-label">
                {label} 메뉴
              </p>
            </>
          )}
          <nav className="feature-nav" aria-label={`${label} 메뉴`}>
            {menuItems ? menuItems.map((item) => {
              const content = <><span aria-hidden="true">{item.icon}</span>{!compact && <strong>{item.label}</strong>}</>;
              const close = () => { item.onClick?.(); setMobileOpen(false); };
              return item.path ? <NavLink key={item.key} to={item.path} end={item.end} title={item.label} onClick={close} className={({isActive}) => (item.active ?? isActive) ? "is-active" : ""}>{content}</NavLink> : <button key={item.key} type="button" title={item.label} aria-current={item.active ? "page" : undefined} className={item.active ? "is-active" : ""} disabled={item.disabled} onClick={close}>{content}</button>;
            }) : (MENUS[scope] || []).map(([key, icon, text]) => {
              const active =
                section === key ||
                (key === "roadmaps" &&
                  ["milestones", "tasks"].includes(section));
              return (
                <Link
                  key={key}
                  to={`/${scope}${key ? "/" + key : ""}`}
                  aria-current={active ? "page" : undefined}
                  className={active ? "is-active" : ""}
                  title={text}
                >
                  <span aria-hidden="true">{icon}</span>
                  {!compact && <strong>{text}</strong>}
                </Link>
              );
            })}
          </nav>
          {scope === "learning" && !compact && (
            <section className="feature-roadmap-tree">
              <div className="feature-tree-heading">
                <span>나의 로드맵</span>
                <Link
                  to="/learning/roadmaps/new"
                  aria-label="새 로드맵 만들기"
                >
                  ＋
                </Link>
              </div>
              {entries
                .filter((e) => e.kind === "ROADMAP")
                .map((r) => {
                  const open = openRoadmaps.has(r.id);
                  const children = entries.filter(
                    (e) => e.kind === "MILESTONE" && e.parentId === r.id,
                  );
                  return (
                    <div className="feature-tree-item" key={r.id}>
                      <div>
                        <button
                          type="button"
                          aria-label={`${r.title} ${open ? "접기" : "펼치기"}`}
                          aria-expanded={open}
                          onClick={() =>
                            setOpenRoadmaps((previous) => {
                              const next = new Set(previous);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                        >
                          {open ? "⌄" : "›"}
                        </button>
                        <Link
                          className={
                            currentRoadmap === r.id ? "is-current" : ""
                          }
                          to={`/learning/roadmaps/${r.id}`}
                          title={r.title}
                        >
                          {r.title}
                        </Link>
                      </div>
                      {open && (
                        <div className="feature-tree-children">
                          {children.map((m) => (
                            <Link
                              key={m.id}
                              className={entityId === m.id ? "is-current" : ""}
                              to={`/learning/milestones/${m.id}`}
                              title={m.title}
                            >
                              · {m.title}
                            </Link>
                          ))}
                          {!children.length && (
                            <small>아직 세부 목표가 없습니다.</small>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              {!entries.some((e) => e.kind === "ROADMAP") && (
                <p className="ws-muted">첫 학습 목표를 만들어보세요.</p>
              )}
              <Link
                className="feature-new-roadmap"
                to="/learning/roadmaps/new"
              >
                ＋ 로드맵 만들기
              </Link>
            </section>
          )}
          {!compact && extra && (
            <div className="feature-sidebar-extra">{extra}</div>
          )}
        </div>
        <footer className="feature-sidebar-footer">
          {!compact && (
            <Link className="feature-settings-link" to="/settings">
              ⚙ 전체 설정
            </Link>
          )}
          <SidebarUserCard user={userOverride || user} collapsed={compact} />
        </footer>
      </aside>
    </>
  );
}
