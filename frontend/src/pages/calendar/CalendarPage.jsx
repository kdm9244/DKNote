import CalendarGrid from '../../components/workspace/CalendarGrid';
import CalendarChecklist from '../../components/workspace/CalendarChecklist';
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import WorkspaceShell from "../../components/workspace/WorkspaceShell";
import InlineEditor from "../../components/workspace/InlineEditor";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import { dateKey, addDays } from "../../components/workspace/learningHelpers";
import { googleApi, messageOf } from "../../api/workspace";
import CalendarSourcesPanel from "./CalendarSourcesPanel";
import CalendarEventList from "./CalendarEventList";
import '../../styles/calendar-mobile.css';

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function rangeFor(date, view, weekStart) {
  const d = new Date(`${date}T12:00:00`);
  if (view === "day") return [date];
  if (view === "month") d.setDate(1);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  const start = dateKey(d);
  return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) =>
    addDays(start, i),
  );
}
function googleView(e, calendar) {
  const allDay = Boolean(e.start?.date);
  const start =
    e.start?.date ||
    (e.start?.dateTime ? dateKey(new Date(e.start.dateTime)) : "");
  const end = allDay
    ? addDays(e.end?.date || start, -1)
    : e.end?.dateTime
      ? dateKey(new Date(e.end.dateTime))
      : start;
  const time = (value) =>
    value
      ? new Date(value).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Seoul",
        })
      : "";
  return {
    id: `google:${calendar.id}:${e.id}`,
    kind: "EVENT",
    title: e.summary || "(제목 없음)",
    body: e.description || "",
    startDate: start,
    endDate: end,
    google: true,
    details: {
      googleEventId: e.id,
      googleCalendarId: calendar.id,
      color: calendar.backgroundColor || "#6b90c8",
      startTime: time(e.start?.dateTime),
      endTime: time(e.end?.dateTime),
      allDay,
      location: e.location || "",
      etag: e.etag,
      recurring: e.recurringEventId,
    },
    calendarName: calendar.summary,
    readOnly: !["owner", "writer"].includes(calendar.accessRole),
  };
}
export default function CalendarPage() {
  const { entries, settings, save, remove, preferences, user, loading } =
    useWorkspace();
  const [params] = useSearchParams();
  const location = useLocation();
  const subpage = location.pathname.replace(/^\/calendar\/?/, "").split("/")[0];
  const [selected, setSelected] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") &&
    Number.isFinite(new Date(`${params.get("date")}T12:00:00`).getTime())
      ? params.get("date")
      : dateKey(),
  );
  const [focus, setFocus] = useState(selected);
  const [view, setView] = useState(settings.calendarView);
  const [editor, setEditor] = useState(null);
  const editorDrafts=useRef(new Map());
  const editorKey=editor?.id || `${editor?.kind}-${editor?.startDate || ''}`;
  const [projectList,setProjectList]=useState(null);
  const [notice, setNotice] = useState("");
  const [savingChecks, setSavingChecks] = useState([]);
  const [checkErrors, setCheckErrors] = useState({});
  const checkLocks = useRef(new Set());
  const [sources, setSources] = useState([]);
  const [remote, setRemote] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [googleNotice, setGoogleNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const [showLocal, setShowLocal] = useState(true);
  const [showLearning, setShowLearning] = useState(true);
  const gridRef = useRef(null),
    detailRef = useRef(null);
  const [eventLimit, setEventLimit] = useState(2);
  useEffect(() => {
    if (loading || view !== "month" || !gridRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setEventLimit(
        Math.max(
          1,
          Math.min(3, Math.floor((entry.contentRect.height / 6 - 42) / 18)),
        ),
      ),
    );
    observer.observe(gridRef.current);
    return () => observer.disconnect();
  }, [view, loading, subpage]);
  useEffect(() => {
    setView(settings.calendarView);
  }, [settings.calendarView]);
  const days = useMemo(
    () =>
      rangeFor(
        subpage === "today" ? dateKey() : focus,
        subpage === "today" ? "day" : view,
        settings.weekStart,
      ),
    [focus, view, settings.weekStart, subpage],
  );
  const start = days[0],
    end = days.at(-1);
  useEffect(() => {
    let active = true;
    setRemoteLoading(true);
    setGoogleNotice("");
    googleApi
      .status()
      .then(async (status) => {
        if (!status.tokenAvailable || status.calendarReady === false) {
          if (active) {
            setRemote([]);
            setSources([]);
            setGoogleNotice(
              "Google로 다시 로그인하고 캘린더 권한에 동의하면 일정이 자동으로 표시됩니다.",
            );
          }
          return;
        }
        const calendars = await googleApi.calendars();
        if (active) setSources(calendars);
        const visible = calendars.filter(
          (c) => !settings.hiddenCalendarIds.includes(c.id),
        );
        const results = await Promise.allSettled(
          visible.map((c) => googleApi.events(c.id, start, end)),
        );
        if (!active) return;
        setRemote(
          results.flatMap((r, i) =>
            r.status === "fulfilled"
              ? r.value
                  .filter((e) => e.status !== "cancelled")
                  .map((e) => googleView(e, visible[i]))
              : [],
          ),
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length)
          setGoogleNotice(
            `${failed.length}개 Google 캘린더의 일정을 불러오지 못했습니다. ${messageOf(failed[0].reason)}`,
          );
      })
      .catch((e) => {
        if (active) {
          setRemote([]);
          setGoogleNotice(messageOf(e));
        }
      })
      .finally(() => {
        if (active) setRemoteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [start, end, revision, settings.hiddenCalendarIds]);
  const events = useMemo(
    () =>
      [
        ...(showLocal
          ? entries.filter(
              (e) => e.kind === "EVENT" && !e.details.googleEventId,
            )
          : []),
        ...remote.map(event => {
          const companion = entries.find(entry =>
            entry.details.googleEventId === event.details.googleEventId &&
            entry.details.googleCalendarId === event.details.googleCalendarId);
          return { ...event, details: { ...event.details, checks: companion?.details.checks || [] }, sidecar: companion };
        }),
        ...(showLearning
          ? entries
              .filter((e) =>
                ["SCHEDULE", "ROADMAP", "MILESTONE"].includes(e.kind),
              )
              .map((e) => ({
                ...e,
                startDate: e.startDate,
                endDate: e.kind === "SCHEDULE" ? e.startDate : e.endDate,
                title:
                  e.kind === "SCHEDULE"
                    ? entries.find((t) => t.id === e.parentId)?.title || e.title
                    : e.title,
                details: {
                  ...e.details,
                  color: e.kind === "ROADMAP" ? "#9a83c3" : "#5b9e8e",
                  allDay: true,
                },
                learning: true,
                completed:
                  e.kind === "SCHEDULE"
                    ? Boolean(
                        entries.find((t) => t.id === e.parentId)?.completed,
                      )
                    : e.completed,
              }))
          : []),
      ].sort(
        (a, b) =>
          (a.details.startTime || "").localeCompare(
            b.details.startTime || "",
          ) || a.title.localeCompare(b.title),
      ),
    [entries, remote, showLocal, showLearning],
  );
  const onDay = (key) =>
    events.filter(
      (e) => e.startDate <= key && (e.endDate || e.startDate) >= key,
    );
  const open = (e) => {
    if (e.learning) {
      setEditor({ learning: e });
      return;
    }
    const sidecar = e.google
      ? entries.find(
          (s) =>
            s.details.googleEventId === e.details.googleEventId &&
            s.details.googleCalendarId === e.details.googleCalendarId,
        )
      : null;
    setEditor({
      ...e,
      details: {
        ...e.details,
        checks: sidecar?.details.checks || e.details.checks || [],
      },
      sidecar,
    });
  };
  const newEvent = () =>
    setEditor({
      kind: "EVENT",
      title: "",
      body: "",
      startDate: selected,
      endDate: selected,
      details: { allDay: true, color: "#6b90c8", checks: [] },
    });
  const shift = (direction) => {
    const d = new Date(`${focus}T12:00:00`);
    if (view === "month") {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    } else d.setDate(d.getDate() + direction * (view === "week" ? 7 : 1));
    setFocus(dateKey(d));
    setSelected(dateKey(d));
  };
  const drop = async (e, key) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const entry = entries.find((item) => item.id === id);
    if (
      !entry ||
      !["EVENT", "SCHEDULE"].includes(entry.kind) ||
      entry.details.googleEventId
    )
      return;
    const duration = entry.endDate
      ? Math.round(
          (new Date(`${entry.endDate}T12:00:00`) -
            new Date(`${entry.startDate}T12:00:00`)) /
            86400000,
        )
      : 0;
    try {
      await save(entry, {
        startDate: key,
        endDate: entry.kind === "SCHEDULE" ? null : addDays(key, duration),
      });
      setNotice("일정을 이동했습니다.");
    } catch (error) {
      setNotice(messageOf(error));
    }
  };
  const toggleTask = async (event) => {
    const task = entries.find((e) => e.id === event.parentId);
    if (!task) return;
    try {
      await save(task, { completed: !task.completed });
    } catch (e) {
      setNotice(messageOf(e));
    }
  };
  const changeChecks = async (event, checks) => {
    const entry = event.google ? event.sidecar : entries.find(item => item.id === event.id);
    if (!entry || checkLocks.current.has(entry.id)) return false;
    checkLocks.current.add(entry.id);
    setSavingChecks(current => [...current, event.id]);
    setCheckErrors(current => ({ ...current, [event.id]: '' }));
    try {
      await save(entry, { details: { ...entry.details, checks } });
      return true;
    } catch (error) {
      setCheckErrors(current => ({ ...current, [event.id]: messageOf(error) }));
      return false;
    } finally {
      checkLocks.current.delete(entry.id);
      setSavingChecks(current => current.filter(id => id !== event.id));
    }
  };
  const toggleCheck = (event,index) => changeChecks(event,(event.details.checks || []).map((check,i)=>i===index?{...check,done:!check.done}:check));
  const title = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    ...(view === "day" ? { day: "numeric" } : {}),
  }).format(new Date(`${focus}T12:00:00`));
  const filters = (
    <CalendarSourcesPanel
      sources={sources}
      settings={settings}
      showLocal={showLocal}
      showLearning={showLearning}
      onLocal={setShowLocal}
      onLearning={setShowLearning}
      remoteLoading={remoteLoading}
      googleNotice={googleNotice}
      user={user}
      onRefresh={() => setRevision((n) => n + 1)}
      onVisibility={async (id, visible) => {
        try {
          await preferences({
            hiddenCalendarIds: visible
              ? settings.hiddenCalendarIds.filter((c) => c !== id)
              : [...settings.hiddenCalendarIds, id],
          });
        } catch (e) {
          setNotice(messageOf(e));
        }
      }}
    />
  );
  const newTemplate = () =>
    setEditor({
      kind: "TEMPLATE",
      title: "",
      body: "",
      details: { checks: [] },
    });
  const pageTitles = {
    "": "캘린더",
    today: "오늘 일정",
    events: "일정 목록",
    templates: "체크리스트 템플릿",
    sources: "캘린더·연결 설정",
  };
  const editorPanel = <>
{editor?.learning && (
        <InlineEditor title={editor.learning.title} onClose={() => setEditor(null)}>
          <div className="ws-modal-body">
            <p>
              학습{" "}
              {editor.learning.kind === "SCHEDULE" ? "예정일" : "목표 기간"}
              입니다.
            </p>
            <p className="ws-muted">
              {editor.learning.startDate} ~{" "}
              {editor.learning.endDate || editor.learning.startDate}
            </p>
            <Link
              className="ws-button primary"
              to={`/learning/${editor.learning.kind === "SCHEDULE" ? "tasks" : editor.learning.kind === "ROADMAP" ? "roadmaps" : "milestones"}/${editor.learning.kind === "SCHEDULE" ? editor.learning.parentId : editor.learning.id}`}
            >
              학습 상세 열기 →
            </Link>
            {editor.learning.kind === "SCHEDULE" && (
              <button
                className="ws-button danger"
                onClick={async () => {
                  try {
                    await remove(editor.learning.id);
                    setEditor(null);
                  } catch (e) {
                    setNotice(messageOf(e));
                  }
                }}
              >
                예정일 삭제
              </button>
            )}
          </div>
        </InlineEditor>
      )}
      {editor && !editor.learning && (
        <EventEditor
          key={editorKey}
          item={editor}
          draft={editorDrafts.current.get(editorKey)}
          onDraftChange={draft=>editorDrafts.current.set(editorKey,draft)}
          sources={sources}
          onClose={() => setEditor(null)}
          onSaved={() => {
            editorDrafts.current.delete(editorKey);
            setEditor(null);
            setRevision((n) => n + 1);
          }}
        />
      )}
  </>;
  return (
    <WorkspaceShell
      active="calendar"
      title={pageTitles[subpage] || "캘린더"}
      subtitle="일상과 학습의 시간을 한곳에서 계획하세요."
      sidebarContent={
        ["", "today", "events"].includes(subpage) ? filters : null
      }
      actions={
        <>
          <Link className="ws-button" to="/calendar/sources">
            연결 관리
          </Link>
          {subpage === "templates" ? (
            <button className="ws-button primary" onClick={newTemplate}>
              ＋ 템플릿 만들기
            </button>
          ) : (
            subpage !== "sources" && (
              <button className="ws-button primary" onClick={newEvent}>
                ＋ 일정 추가
              </button>
            )
          )}
        </>
      }
    >
      {notice && (
        <div className="ws-alert" role="status">
          {notice}
        </div>
      )}
      {subpage && (!['today','events'].includes(subpage) || !editor?.id && !editor?.learning) && editorPanel}
      {!subpage && (
        <div className={`calendar-workspace${editor ? " is-editing" : ""}`}>
          <section className="ws-panel calendar-board">
            <div className="calendar-toolbar">
              <div className="ws-actions">
                <button
                  className="ws-icon"
                  onClick={() => shift(-1)}
                  aria-label="이전 기간"
                >
                  ‹
                </button>
                <h2>{title}</h2>
                <button
                  className="ws-icon"
                  onClick={() => shift(1)}
                  aria-label="다음 기간"
                >
                  ›
                </button>
                <button
                  className="ws-button"
                  onClick={() => {
                    setFocus(dateKey());
                    setSelected(dateKey());
                  }}
                >
                  오늘
                </button>
              </div>
              <div className="ws-tabs">
                {[
                  ["month", "월"],
                  ["week", "주"],
                  ["day", "일"],
                ].map(([key, label]) => (
                  <button
                    className={view === key ? "active" : ""}
                    onClick={() => setView(key)}
                    key={key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="calendar-density-key"><span><i/>기간 프로젝트</span><span><i/>당일 일정·할 일</span><span>＋ 숫자를 누르면 전체 목록</span></div>
            {view !== "day" && (
              <div className="calendar-weekdays">
                {Array.from(
                  { length: 7 },
                  (_, i) => WEEKDAYS[(i + settings.weekStart) % 7],
                ).map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
            )}
            <CalendarGrid gridRef={gridRef} days={days} view={view} events={events} eventLimit={eventLimit} selected={selected} focus={focus} onSelect={date=>{setSelected(date);setProjectList(null);setEditor(null);if(window.matchMedia('(max-width:760px)').matches)requestAnimationFrame(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));}} onOpen={open} onDrop={drop} onProjects={list=>{setEditor(null);setProjectList(list);requestAnimationFrame(()=>detailRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"}));}} onMore={()=>requestAnimationFrame(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}))} />
            <button type="button" className="calendar-selected-jump" onClick={()=>{setEditor(null);setProjectList(null);requestAnimationFrame(()=>detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));}}>
              {Number(selected.slice(5,7))}월 {Number(selected.slice(-2))}일 일정·체크리스트 {onDay(selected).length}개 보기 ↓
            </button>
          </section>
          <aside ref={detailRef} className="ws-panel calendar-day-detail">
            {editor ? editorPanel : projectList ? <InlineEditor title="기간 프로젝트" onClose={()=>setProjectList(null)}><div className="ws-modal-body"><p className="ws-muted">{projectList.week[0]} ~ {projectList.week.at(-1)}</p>{projectList.events.map(event=><button type="button" key={event.id} className="calendar-project-row" onClick={()=>{setProjectList(null);setSelected(event.startDate<projectList.week[0]?projectList.week[0]:event.startDate);open(event);}}><i style={{background:event.details.color || '#9a83c3'}}/><span><strong>{event.title}</strong><small>{event.startDate} ~ {event.endDate}</small></span></button>)}</div></InlineEditor> : <>
            <small>SELECTED DAY</small>
            <h2>{selected.slice(5).replace("-", "월 ")}일</h2>
            <button type="button" className="calendar-back-to-grid" onClick={()=>gridRef.current?.scrollIntoView({behavior:'smooth',block:'start'})}>↑ 달력으로 돌아가기</button>
            <button className="ws-button" onClick={newEvent}>
              ＋ 이 날짜에 일정 추가
            </button>
            {onDay(selected).map((e) => (
              <article className="calendar-detail-item" key={e.id}>
                <div>
                  <i style={{ background: e.details.color || "#6b90c8" }} />
                  <small>
                    {e.learning
                      ? "학습"
                      : e.google
                        ? e.calendarName
                        : "개인 일정"}{" "}
                    · {e.details.startTime || "종일"}
                  </small>
                </div>
                <button onClick={() => open(e)}>{e.title}</button>
                {e.kind === "SCHEDULE" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={e.completed}
                      onChange={() => toggleTask(e)}
                    />
                    할 일 완료
                  </label>
                )}
                <CalendarChecklist event={e} saving={savingChecks.includes(e.id)} error={checkErrors[e.id]} onToggle={toggleCheck} onChange={changeChecks} />
              </article>
            ))}
            {!onDay(selected).length && (
              <div className="ws-empty compact">
                아직 일정이 없습니다.
                <br />
                나만의 시간을 계획해보세요.
              </div>
            )}
            </>}
          </aside>
        </div>
      )}
      {["today", "events"].includes(subpage) && (
        <CalendarEventList
          events={events}
          savingChecks={savingChecks}
          checkErrors={checkErrors}
          onToggleCheck={toggleCheck}
          onChangeChecks={changeChecks}
          editingId={editor?.id || editor?.learning?.id}
          editorPanel={editorPanel}
          start={start}
          end={end}
          today={subpage === "today"}
          onOpen={open}
          onAdd={newEvent}
          onPrevious={() => shift(-1)}
          onNext={() => shift(1)}
        />
      )}
      {subpage === "sources" && (
        <div className="calendar-subpage calendar-source-settings">
          {filters}
          <section className="ws-panel">
            <h2>달력 기본 설정</h2>
            <p className="ws-muted">
              보기와 주 시작 요일은 계정별로 저장합니다.
            </p>
            <label className="ws-field">
              기본 보기
              <select
                value={settings.calendarView}
                onChange={async (e) => {
                  try {
                    await preferences({ calendarView: e.target.value });
                  } catch (error) {
                    setNotice(messageOf(error));
                  }
                }}
              >
                <option value="month">월간</option>
                <option value="week">주간</option>
                <option value="day">일간</option>
              </select>
            </label>
            <label className="ws-field">
              주 시작 요일
              <select
                value={settings.weekStart}
                onChange={async (e) => {
                  try {
                    await preferences({ weekStart: Number(e.target.value) });
                  } catch (error) {
                    setNotice(messageOf(error));
                  }
                }}
              >
                <option value={0}>일요일</option>
                <option value={1}>월요일</option>
              </select>
            </label>
            <Link className="ws-button" to="/settings">
              Google 계정·전체 설정 →
            </Link>
          </section>
        </div>
      )}
      {subpage === "templates" && (
        <div className="calendar-subpage">
          <p className="ws-muted">
            일정을 작성할 때 저장한 준비 목록을 선택해 적용할 수 있습니다.
          </p>
          <div className="calendar-template-grid">
            {entries
              .filter((e) => e.kind === "TEMPLATE")
              .map((e) => (
                <article className="ws-panel calendar-template-card" key={e.id}>
                  <h2>{e.title}</h2>
                  <p className="ws-muted">{e.body}</p>
                  <ul>
                    {(e.details.checks || []).slice(0, 6).map((c, i) => (
                      <li key={c.id || i}>{c.title}</li>
                    ))}
                  </ul>
                  <small className="ws-muted">
                    {e.details.checks?.length || 0}개 체크 항목
                  </small>
                  <div className="ws-actions">
                    <button className="ws-button" onClick={() => setEditor(e)}>
                      템플릿 편집
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!entries.some((e) => e.kind === "TEMPLATE") && (
            <div className="ws-panel ws-empty">
              <h3>자주 쓰는 체크리스트를 만들어보세요.</h3>
              <button className="ws-button primary" onClick={newTemplate}>
                첫 템플릿 만들기
              </button>
            </div>
          )}
        </div>
      )}
      {subpage && !pageTitles[subpage] && (
        <div className="ws-empty">
          페이지를 찾을 수 없습니다.
          <Link to="/calendar">달력으로 돌아가기</Link>
        </div>
      )}

    </WorkspaceShell>
  );
}

function EventEditor({ item, draft, sources, onClose, onSaved, onDraftChange }) {
  const { entries, save, remove } = useWorkspace();
  const [form, setForm] = useState(() => draft?.form || ({
    ...item,
    details: {
      ...item.details,
      googleRequestId:
        item.details.googleRequestId || crypto.randomUUID().replaceAll("-", ""),
    },
  }));
  const [destination, setDestination] = useState(
    draft?.destination || (item.google ? item.details.googleCalendarId : "local"),
  );
  useEffect(()=>{onDraftChange?.({form,destination});},[form,destination,onDraftChange]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const detail = (key, value) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: value } }));
  const checks = form.details.checks || [];
  const persist = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (destination === "local" || form.kind === "TEMPLATE") await save(form);
      else {
        const allDay = form.details.allDay;
        const start = allDay
          ? { date: form.startDate }
          : {
              dateTime: `${form.startDate}T${form.details.startTime || "09:00"}:00+09:00`,
              timeZone: "Asia/Seoul",
            };
        const end = allDay
          ? { date: addDays(form.endDate, 1) }
          : {
              dateTime: `${form.endDate}T${form.details.endTime || "10:00"}:00+09:00`,
              timeZone: "Asia/Seoul",
            };
        if (
          new Date(allDay ? form.endDate : end.dateTime) <
          new Date(allDay ? form.startDate : start.dateTime)
        )
          throw new Error("종료 시간은 시작 시간 이후여야 합니다.");
        const remote = await googleApi.save(
          destination,
          {
            summary: form.title,
            description: form.body,
            location: form.details.location || "",
            start,
            end,
            etag: form.details.etag,
            requestId: form.details.googleRequestId,
          },
          item.google ? item.details.googleEventId : undefined,
        );
        // Store only companion checklist data locally; Google remains the event source.
        await save({
          ...form,
          ...(item.sidecar
            ? { id: item.sidecar.id, version: item.sidecar.version }
            : { id: undefined }),
          details: {
            ...form.details,
            googleEventId: remote.id,
            googleCalendarId: destination,
          },
        });
      }
      onSaved();
    } catch (e) {
      setError(e.response ? messageOf(e) : e.message || "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };
  const destroy = async () => {
    if (
      !window.confirm(
        item.google
          ? "Google 캘린더에서도 삭제됩니다. 반복 일정은 이번 1회만 삭제합니다. 계속할까요?"
          : "이 항목을 삭제할까요?",
      )
    )
      return;
    setBusy(true);
    try {
      if (item.google) {
        await googleApi.remove(
          item.details.googleCalendarId,
          item.details.googleEventId,
          item.details.etag,
        );
        if (item.sidecar) await remove(item.sidecar.id);
      } else await remove(item.id);
      onSaved();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <InlineEditor
      title={
        form.kind === "TEMPLATE"
          ? "체크리스트 템플릿"
          : item.id
            ? "일정 상세"
            : "새 일정"
      }
      busy={busy}
      onClose={onClose}
    >
      <form className="ws-modal-body" onSubmit={persist}>
        {error && (
          <div className="ws-alert" role="alert">
            {error}
          </div>
        )}
        {item.readOnly && <p className="ws-muted">읽기 전용 캘린더입니다.</p>}
        <label className="ws-field">
          제목
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            disabled={item.readOnly}
          />
        </label>
        {form.kind !== "TEMPLATE" && (
          <>
            <label className="ws-field">
              저장할 캘린더
              <select
                value={destination}
                disabled={Boolean(item.id)}
                onChange={(e) => setDestination(e.target.value)}
              >
                <option value="local">DKNote 개인 일정</option>
                {sources
                  .filter(
                    (c) =>
                      ["owner", "writer"].includes(c.accessRole) ||
                      c.id === destination,
                  )
                  .map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.summary}
                    </option>
                  ))}
              </select>
            </label>
            <div className="ws-form-grid">
              <label className="ws-field">
                시작일
                <input
                  type="date"
                  required
                  value={form.startDate || ""}
                  onChange={(e) => {
                    set("startDate", e.target.value);
                    if (e.target.value > form.endDate)
                      set("endDate", e.target.value);
                  }}
                />
              </label>
              <label className="ws-field">
                종료일
                <input
                  type="date"
                  required
                  min={form.startDate}
                  value={form.endDate || ""}
                  onChange={(e) => set("endDate", e.target.value)}
                />
              </label>
            </div>
            <label className="settings-row">
              <span>종일 일정</span>
              <input
                type="checkbox"
                checked={form.details.allDay !== false}
                onChange={(e) => detail("allDay", e.target.checked)}
              />
            </label>
            {form.details.allDay === false && (
              <div className="ws-form-grid">
                <label className="ws-field">
                  시작 시간
                  <input
                    type="time"
                    required
                    value={form.details.startTime || "09:00"}
                    onChange={(e) => detail("startTime", e.target.value)}
                  />
                </label>
                <label className="ws-field">
                  종료 시간
                  <input
                    type="time"
                    required
                    value={form.details.endTime || "10:00"}
                    onChange={(e) => detail("endTime", e.target.value)}
                  />
                </label>
              </div>
            )}
            <div className="ws-form-grid">
              <label className="ws-field">
                장소
                <input
                  maxLength={500}
                  value={form.details.location || ""}
                  onChange={(e) => detail("location", e.target.value)}
                />
              </label>
              <label className="ws-field">
                색상
                <input
                  type="color"
                  value={form.details.color || "#6b90c8"}
                  onChange={(e) => detail("color", e.target.value)}
                />
              </label>
            </div>
          </>
        )}
        <label className="ws-field">
          메모
          <textarea
            rows={4}
            value={form.body || ""}
            onChange={(e) => set("body", e.target.value)}
          />
        </label>
        <div className="ws-section-title">
          <h3>체크리스트</h3>
          {form.kind !== "TEMPLATE" && (
            <select
              aria-label="템플릿 적용"
              value=""
              onChange={(e) => {
                const t = entries.find((t) => t.id === e.target.value);
                if (t)
                  detail("checks", [
                    ...checks,
                    ...(t.details.checks || []).map((c) => ({
                      ...c,
                      id: crypto.randomUUID(),
                      done: false,
                    })),
                  ]);
              }}
            >
              <option value="">템플릿 적용</option>
              {entries
                .filter((e) => e.kind === "TEMPLATE")
                .map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          )}
        </div>
        {checks.map((c, i) => (
          <div className="check-edit-row" key={c.id || i}>
            <input
              type="checkbox"
              checked={Boolean(c.done)}
              onChange={(e) =>
                detail(
                  "checks",
                  checks.map((v, n) =>
                    n === i ? { ...v, done: e.target.checked } : v,
                  ),
                )
              }
            />
            <input
              aria-label={`체크 항목 ${i + 1}`}
              required
              maxLength={200}
              value={c.title}
              onChange={(e) =>
                detail(
                  "checks",
                  checks.map((v, n) =>
                    n === i ? { ...v, title: e.target.value } : v,
                  ),
                )
              }
            />
            <button
              type="button"
              className="ws-icon"
              aria-label="체크 항목 삭제"
              onClick={() =>
                detail(
                  "checks",
                  checks.filter((_, n) => n !== i),
                )
              }
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="ws-button"
          onClick={() =>
            detail("checks", [
              ...checks,
              { id: crypto.randomUUID(), title: "", done: false },
            ])
          }
        >
          ＋ 체크 항목
        </button>
        <footer className="ws-form-footer">
          {item.id && !item.readOnly && (
            <button
              type="button"
              className="ws-button danger"
              disabled={busy}
              onClick={destroy}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            className="ws-button"
            disabled={busy}
            onClick={onClose}
          >
            닫기
          </button>
          {!item.readOnly && (
            <button className="ws-button primary" disabled={busy}>
              {busy ? "저장 중…" : "저장"}
            </button>
          )}
        </footer>
      </form>
    </InlineEditor>
  );
}
