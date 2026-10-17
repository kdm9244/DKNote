import { Link } from "react-router-dom";
import { startGoogleLogin } from "../../api/client";
export default function CalendarSourcesPanel({
  sources,
  settings,
  showLocal,
  showLearning,
  onLocal,
  onLearning,
  onVisibility,
  remoteLoading,
  googleNotice,
  onRefresh,
  user,
}) {
  return (
    <section
      className="ws-panel calendar-sources"
      aria-label="캘린더 표시 설정"
    >
      <h3>내 캘린더</h3>
      <label className="settings-row">
        <span>
          <i style={{ background: "#6b90c8" }} />
          개인 일정
        </span>
        <input
          type="checkbox"
          checked={showLocal}
          onChange={(e) => onLocal(e.target.checked)}
        />
      </label>
      <label className="settings-row">
        <span>
          <i style={{ background: "#9a83c3" }} />
          학습 일정
        </span>
        <input
          type="checkbox"
          checked={showLearning}
          onChange={(e) => onLearning(e.target.checked)}
        />
      </label>
      <h3>Google 캘린더</h3>
      {sources.map((c) => (
        <label className="settings-row" key={c.id} title={c.summary}>
          <span>
            <i style={{ background: c.backgroundColor || "#6b90c8" }} />
            {c.summary}
          </span>
          <input
            type="checkbox"
            checked={!settings.hiddenCalendarIds.includes(c.id)}
            onChange={(e) => onVisibility(c.id, e.target.checked)}
          />
        </label>
      ))}
      {!sources.length && !googleNotice && (
        <p className="ws-muted">
          Google 로그인에서 캘린더 권한에 동의하면 일정이 자동 표시됩니다.
        </p>
      )}
      <div className="ws-actions">
        {!sources.length && user?.provider === "GOOGLE" && (
          <button
            type="button"
            className="ws-button"
            onClick={startGoogleLogin}
          >
            Google로 다시 로그인
          </button>
        )}
        <button type="button" className="ws-button" onClick={onRefresh}>
          ↻ 새로고침
        </button>
      </div>
      {remoteLoading && <small role="status">Google 일정 조회 중…</small>}
      {googleNotice && (
        <p className="ws-muted" role="status">
          {googleNotice}
        </p>
      )}
      {!sources.length && user?.provider !== "GOOGLE" && (
        <Link className="ws-button" to="/settings">
          Google 연결 관리
        </Link>
      )}
    </section>
  );
}
