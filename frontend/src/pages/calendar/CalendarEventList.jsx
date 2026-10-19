import { Fragment, useState } from "react";
import CalendarChecklist from '../../components/workspace/CalendarChecklist';
export default function CalendarEventList({
  events,
  start,
  end,
  today,
  onOpen,
  onAdd,
  onPrevious,
  onNext,
  savingChecks,
  checkErrors,
  onToggleCheck,
  onChangeChecks,
  editingId,
  editorPanel,
}) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = events
    .filter((e) => e.startDate <= end && (e.endDate || e.startDate) >= start)
    .filter(
      (e) =>
        (filter === "all" ||
          (filter === "learning" && e.learning) ||
          (filter === "google" && e.google) ||
          (filter === "local" && !e.learning && !e.google)) &&
        `${e.title} ${e.body || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.details.startTime || "").localeCompare(b.details.startTime || "") ||
        a.title.localeCompare(b.title),
    );
  return (
    <div className="calendar-subpage">
      <section className="ws-panel">
        <div className="calendar-subpage-tools">
          <div>
            <h2>{today ? "오늘의 일정" : `${start} — ${end}`}</h2>
            <p className="ws-muted">
              {rows.length}개 일정 · 체크리스트는 아래에서 바로 체크할 수 있습니다.
            </p>
          </div>
          {!today && (
            <div className="ws-actions">
              <button className="ws-button" onClick={onPrevious}>
                ‹ 이전 기간
              </button>
              <button className="ws-button" onClick={onNext}>
                다음 기간 ›
              </button>
            </div>
          )}
        </div>
        <div className="record-filters">
          <input
            aria-label="일정 검색"
            placeholder="일정 제목 또는 메모 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            aria-label="일정 종류"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">모든 일정</option>
            <option value="local">개인 일정</option>
            <option value="google">Google 일정</option>
            <option value="learning">학습 일정</option>
          </select>
        </div>
      </section>
      <div className="calendar-event-list">
        {rows.map((e) => (
          <Fragment key={e.id}><article className="calendar-event-card">
            <i style={{ background: e.details.color || "#6b90c8" }} />
            <div>
              <small>
                {e.startDate}
                {e.endDate && e.endDate !== e.startDate
                  ? ` — ${e.endDate}`
                  : ""}{" "}
                · {e.details.startTime || "종일"} ·{" "}
                {e.learning ? "학습" : e.google ? e.calendarName : "개인 일정"}
              </small>
              <h3>
                <button onClick={() => onOpen(e)}>{e.title}</button>
              </h3>
              {e.body && <p>{e.body}</p>}
              <CalendarChecklist event={e} saving={savingChecks.includes(e.id)} error={checkErrors[e.id]} onToggle={onToggleCheck} onChange={onChangeChecks} />
            </div>
            <button className="ws-button" onClick={() => onOpen(e)}>
              상세 보기
            </button>
          </article>{editingId===e.id && editorPanel}</Fragment>
        ))}
      </div>
      {!rows.length && (
        <div className="ws-panel ws-empty">
          <h3>표시할 일정이 없습니다.</h3>
          <p>새 일정을 등록하거나 검색 조건을 바꿔보세요.</p>
          <button className="ws-button primary" onClick={onAdd}>
            ＋ 일정 만들기
          </button>
        </div>
      )}
    </div>
  );
}
