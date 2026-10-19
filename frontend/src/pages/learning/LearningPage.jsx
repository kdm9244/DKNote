import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import WorkspaceShell from "../../components/workspace/WorkspaceShell";
import InlineEditor from "../../components/workspace/InlineEditor";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import {
  dateKey,
  descendants,
  progress,
  parentLabel,
  KIND_LABEL,
  codeFingerprint,
} from "../../components/workspace/learningHelpers";
import LearningMarkdown from "../../components/workspace/LearningMarkdown";
import { messageOf } from "../../api/workspace";
import PdfWorkspace from "./PdfWorkspace";
import WordLibrary from "./WordLibrary";
import "../../styles/learning-compact.css";

export default function LearningPage() {
  const { entries, save, remove, reorder } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [section, id] = location.pathname
    .replace(/^\/learning\/?/, "")
    .split("/");
  const entity = entries.find((e) => e.id === id);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(dateKey());
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState("all");
  const [materialKind,setMaterialKind]=useState('all');
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  useEffect(() => {
    setNotice("");
    setPage(1);
    setQuery("");
  }, [location.pathname]);
  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      setNotice("");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const create = useCallback((kind,parent=null) => {
    const section={ROADMAP:'roadmaps',MILESTONE:'milestones',TASK:'tasks',RECORD:'records'}[kind];
    const search=parent ? `?parent=${encodeURIComponent(parent)}` : '';
    navigate(`/learning/${section}/new${search}`,{state:{returnTo:location.pathname+location.search}});
  },[navigate,location.pathname,location.search]);
  useEffect(() => {
    if(new URLSearchParams(location.search).get('new')==='1'&&section==='roadmaps') {
      navigate('/learning/roadmaps/new',{replace:true,state:{returnTo:'/learning/roadmaps'}});
    }
  },[location.pathname,location.search,section,navigate]);
  const openEditor = item => {
    const section={ROADMAP:'roadmaps',MILESTONE:'milestones',TASK:'tasks',RECORD:'records'}[item.kind];
    navigate(`/learning/${section}/${item.id}/edit`,{state:{returnTo:location.pathname+location.search}});
  };
  const destroy = async (e) => {
    const dependents = descendants(entries, e.id);
    const preserved = dependents.filter((x) =>
      ["RECORD", "PDF"].includes(x.kind),
    ).length;
    if (
      !window.confirm(
        `${e.title}을(를) 삭제할까요?${dependents.length ? `\n하위 항목 ${dependents.length}개 중 학습노트·PDF ${preserved}개는 연결을 해제해 보존합니다.` : ""}`,
      )
    )
      return;
    await act(async () => {
      await remove(e.id);
      if (id === e.id) navigate("/learning/roadmaps");
    });
  };
  const move = async (e, direction) => {
    const peers = entries
      .filter((p) => p.parentId === e.parentId && p.kind === e.kind)
      .sort(
        (a, b) =>
          a.position - b.position || a.createdAt.localeCompare(b.createdAt),
      );
    const i = peers.findIndex((p) => p.id === e.id),
      target = peers[i + direction];
    if (!target) return;
    [peers[i], peers[i + direction]] = [peers[i + direction], peers[i]];
    await act(() => reorder(peers));
  };
  const link = (e) =>
    `/learning/${{ ROADMAP: "roadmaps", MILESTONE: "milestones", TASK: "tasks", RECORD: "records", PDF: "pdf" }[e.kind]}/${e.id}`;
  const records = entries.filter((e) => e.kind === "RECORD");
  const roadmaps = entries.filter((e) => e.kind === "ROADMAP");
  const selectedIds = entity
    ? new Set([entity.id, ...descendants(entries, entity.id).map((e) => e.id)])
    : null;
  const materialDate = e => e.startDate || e.createdAt?.slice(0,10) || '';
  const visibleRecords = entries.filter(e=>['RECORD','PDF'].includes(e.kind))
    .filter(
      (e) =>
        (!selectedIds || selectedIds.has(e.parentId)) &&
        (!query ||
          `${e.title} ${e.body}`.toLowerCase().includes(query.toLowerCase())) &&
        (materialKind==='all'||e.kind===materialKind) &&
        (!from || materialDate(e) >= from) &&
        (!to || materialDate(e) <= to) &&
        (format === "all" || format === e.format),
    )
    .sort((a, b) =>
      materialDate(sort === "newest" ? b : a).localeCompare(
        materialDate(sort === "newest" ? a : b),
      ),
    );
  const paged = visibleRecords.slice((page - 1) * 5, page * 5);
  const recordBrowser = (
    <section className="ws-panel">
      <div className="ws-section-title">
        <h2>학습노트·PDF</h2><Link className="ws-button" to="/learning/pdf">PDF 올리기·관리</Link>
        <button
          className="ws-button primary"
          onClick={() => create("RECORD", entity?.id)}
        >
          ＋ 노트 작성
        </button>
      </div>
      <div className="record-filters">
        <select aria-label="자료 종류" value={materialKind} onChange={e=>{setMaterialKind(e.target.value);setPage(1);}}><option value="all">모든 자료</option><option value="RECORD">학습노트</option><option value="PDF">PDF</option></select>
        <input
          aria-label="노트 검색"
          placeholder="제목 또는 본문 검색"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="공부 날짜 시작"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
        />
        <input
          type="date"
          aria-label="공부 날짜 종료"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="입력 형식"
          value={format}
          onChange={(e) => {
            setFormat(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">모든 형식</option>
          <option value="plain">일반 입력</option>
          <option value="markdown">Markdown</option><option value="richtext">문서 편집</option>
        </select>
        <select
          aria-label="정렬"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="newest">최근 공부 순</option>
          <option value="oldest">오래된 공부 순</option>
        </select>
      </div>
      {paged.map((e) => (
        <article className="record-list-item" key={e.id}>
          <Link to={link(e)}>
            <small>
              {materialDate(e)} ·{" "}
              {e.kind==='PDF'?'PDF':e.format === "richtext" ? "문서 편집" : e.format === "markdown" ? "Markdown" : "일반 입력"}
            </small>
            <h3>{e.title}</h3>
            <p>{e.kind==='PDF' ? e.details.fileName : e.body?.replace(/<[^>]*>/g,' ').slice(0,120) || "본문이 없습니다."}</p>
            <span className="ws-muted">
              {parentLabel(entries, e) || "독립 노트"}
            </span>
          </Link>
          {e.kind==='PDF'?<Link className="ws-button" to={link(e)}>열기</Link>:<button className="ws-button" onClick={() => openEditor(e)}>
            편집
          </button>}
        </article>
      ))}
      {!paged.length && (
        <div className="ws-empty compact">
          조건에 맞는 자료가 없습니다. 노트를 작성하거나 PDF를 올려보세요.
        </div>
      )}
      <div className="ws-pagination">
        <button
          className="ws-button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          이전
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(visibleRecords.length / 5))} ·{" "}
          {visibleRecords.length}개
        </span>
        <button
          className="ws-button"
          disabled={page * 5 >= visibleRecords.length}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </button>
      </div>
    </section>
  );
  const taskRow=e=>(<article key={e.id} className="learning-task-row">
    <label><input type="checkbox" disabled={busy} checked={e.completed} aria-label={e.title+' 완료'} onChange={()=>act(()=>save(e,{completed:!e.completed}))}/><span className={e.completed?'completed':''}>{e.title}</span></label>
    {(e.startDate||e.endDate)&&<small>{[e.startDate,e.endDate].filter(Boolean).join(' ~ ')}</small>}
    <div className="ws-actions"><Link className="ws-button" to={link(e)}>상세</Link><details className="learning-row-menu"><summary aria-label={e.title+' 관리'}>···</summary><div><button disabled={busy} onClick={()=>openEditor(e)}>편집</button><button disabled={busy} onClick={()=>move(e,-1)}>위로 이동</button><button disabled={busy} onClick={()=>move(e,1)}>아래로 이동</button></div></details></div>
  </article>);
  const roadmapCards=roadmaps.map(e=>{
    const p=progress(entries,e.id),next=descendants(entries,e.id).find(t=>t.kind==='TASK'&&!t.completed);
    return <article className="ws-panel roadmap-card roadmap-summary-row" key={e.id}>
      <Link to={link(e)} className="roadmap-summary-title"><span className="ws-tag">{p.total&&p.total===p.done?'완료':'진행 중'}</span><h3>{e.title}</h3>{(e.startDate||e.endDate)&&<small>{[e.startDate,e.endDate].filter(Boolean).join(' ~ ')}</small>}</Link>
      <div className="roadmap-summary-progress"><div className="ws-progress"><i style={{width:p.percent+'%'}}/></div><small>{p.done}/{p.total}개 완료 · {p.percent}%</small></div>
      <div className="roadmap-summary-next"><small>다음 할 일</small>{next?<Link to={link(next)}>{next.title}</Link>:<span>{p.total?'모두 완료했어요':'할 일을 추가해 보세요'}</span>}</div>
      <details className="learning-row-menu"><summary aria-label={e.title+' 관리'}>···</summary><div><button disabled={busy} onClick={()=>openEditor(e)}>편집</button><button disabled={busy} onClick={()=>destroy(e)}>삭제</button></div></details>
    </article>;
  });
  return (
    <WorkspaceShell
      active="learning"
      title={
        {
          "": "학습 홈",
          today: "오늘 할 학습",
          roadmaps: "로드맵",
          milestones: "세부 목표",
          tasks: "학습 할 일",
          records: "학습노트·PDF",
          pdf: "PDF 자료",
          words: "단어장",
        }[section || ""] || "학습"
      }
      subtitle="계획하고, 기록하고, 나의 지식으로 쌓아가세요."
      actions={
        <button className="ws-button primary" onClick={() => create("ROADMAP")}>
          ＋ 학습 목표
        </button>
      }
    >
      {notice && (
        <div className="ws-alert" role="alert">
          {notice}
        </div>
      )}
      {section === "today" && (
        <section className="ws-panel">
          <div className="ws-section-title">
            <div>
              <h2>{dateKey()} · 오늘 할 학습</h2>
              <p className="ws-muted">
                예정한 공부를 완료하고 할 일 상세에서 학습노트를 작성하세요.
              </p>
            </div>
            <Link className="ws-button" to="/calendar/today">
              오늘 일정 →
            </Link>
          </div>
          {entries
            .filter((e) => e.kind === "SCHEDULE" && e.startDate === dateKey())
            .map((s) => entries.find((e) => e.id === s.parentId))
            .filter(Boolean)
            .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
            .map(taskRow)}
          {!entries.some(
            (e) => e.kind === "SCHEDULE" && e.startDate === dateKey(),
          ) && (
            <div className="ws-empty compact">
              오늘 예정한 공부가 없습니다.
              <Link to="/learning/roadmaps" className="ws-button">
                로드맵에서 할 일 계획하기
              </Link>
            </div>
          )}
          <h3>목표일이 지난 미완료 할 일</h3>
          {entries
            .filter(
              (e) =>
                e.kind === "TASK" &&
                !e.completed &&
                e.endDate &&
                e.endDate < dateKey(),
            )
            .map(taskRow)}
          {!entries.some(
            (e) =>
              e.kind === "TASK" &&
              !e.completed &&
              e.endDate &&
              e.endDate < dateKey(),
          ) && (
            <p className="ws-muted">목표일이 지난 미완료 할 일이 없습니다.</p>
          )}
        </section>
      )}
      {!section && (
        <>
          <div className="learning-stats">
            <div>
              <small>진행 중인 목표</small>
              <strong>
                {
                  roadmaps.filter((r) => progress(entries, r.id).percent < 100)
                    .length
                }
              </strong>
            </div>
            <div>
              <small>완료한 할 일</small>
              <strong>
                {entries.filter((e) => e.kind === "TASK" && e.completed).length}
              </strong>
            </div>
            <div>
              <small>쌓인 학습노트</small>
              <strong>{records.length}</strong>
            </div>
            <div>
              <small>공부한 날</small>
              <strong>{new Set(records.map((e) => e.startDate)).size}</strong>
            </div>
          </div>
          <div className="learning-home-columns">
            <section className="ws-panel">
              <div className="ws-section-title">
                <h2>오늘 할 학습</h2>
                <Link to="/calendar" className="ws-button">
                  캘린더 →
                </Link>
              </div>
              {entries
                .filter(
                  (e) => e.kind === "SCHEDULE" && e.startDate === dateKey(),
                )
                .map((s) => entries.find((e) => e.id === s.parentId))
                .filter(Boolean)
                .filter(
                  (e, i, all) => all.findIndex((x) => x.id === e.id) === i,
                )
                .map(taskRow)}
              {!entries.some(
                (e) => e.kind === "SCHEDULE" && e.startDate === dateKey(),
              ) && (
                <div className="ws-empty compact">
                  오늘 예정된 학습이 없습니다.
                  <br />할 일 상세에서 공부 날짜를 지정하세요.
                </div>
              )}
            </section>
            <section className="ws-panel">
              <div className="ws-section-title">
                <h2>최근 학습노트</h2>
                <button className="ws-button" onClick={() => create("RECORD")}>
                  ＋ 기록
                </button>
              </div>
              {[...records]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 4)
                .map((e) => (
                  <Link className="learning-recent" to={link(e)} key={e.id}>
                    <span>{e.title}</span>
                    <small>{e.startDate}</small>
                  </Link>
                ))}
              {!records.length && (
                <div className="ws-empty compact">
                  오늘 배운 내용을 첫 노트로 남겨보세요.
                </div>
              )}
            </section>
          </div>
          <div className="ws-section-title">
            <h2>나의 로드맵</h2>
            <Link className="ws-button" to="/learning/roadmaps">
              전체 보기 →
            </Link>
          </div>
          <div className="roadmap-grid">{roadmapCards}</div>
          {!roadmaps.length && (
            <div className="ws-empty">
              <span>🌱</span>
              <h3>작은 목표부터 시작하세요</h3>
              <p>로드맵을 만들고 세부 목표와 할 일을 연결해보세요.</p>
              <button
                className="ws-button primary"
                onClick={() => create("ROADMAP")}
              >
                첫 학습 목표 만들기
              </button>
            </div>
          )}
        </>
      )}
      {section === "roadmaps" && !id && (
        <>
          <div className="roadmap-grid">{roadmapCards}</div>
          {!roadmaps.length && (
            <div className="ws-empty">
              아직 로드맵이 없습니다.
              <button
                className="ws-button primary"
                onClick={() => create("ROADMAP")}
              >
                로드맵 만들기
              </button>
            </div>
          )}
        </>
      )}
      {["roadmaps", "milestones", "tasks"].includes(section) &&
        id &&
        entity && (
          <>
            <div className="learning-breadcrumb">
              <Link to="/learning/roadmaps">로드맵</Link>
              {entity.parentId && (
                <>
                  <span> / </span>
                  <Link
                    to={link(
                      entries.find((e) => e.id === entity.parentId) || entity,
                    )}
                  >
                    {parentLabel(entries, entity)}
                  </Link>
                </>
              )}
              <span> / {entity.title}</span>
            </div>
            <section className="ws-panel learning-detail-heading">
              <div>
                <span className="ws-tag">{KIND_LABEL[entity.kind]}</span>
                <h2>{entity.title}</h2>
                {entity.body&&<p className="learning-plain">{entity.body}</p>}
                {(entity.startDate||entity.endDate)&&<small>{[entity.startDate,entity.endDate].filter(Boolean).join(' ~ ')}</small>}
              </div>
              <div className="ws-actions">
                <button className="ws-button" onClick={() => openEditor(entity)}>
                  편집
                </button>
                <button
                  className="ws-button danger"
                  disabled={busy}
                  onClick={() => destroy(entity)}
                >
                  삭제
                </button>
              </div>
              {entity.kind !== "TASK" && (
                <div className="detail-progress">
                  <div className="ws-progress">
                    <i
                      style={{
                        width: `${progress(entries, entity.id).percent}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {progress(entries, entity.id).percent}% ·{" "}
                    {progress(entries, entity.id).done}/
                    {progress(entries, entity.id).total}개 완료
                  </strong>
                </div>
              )}
              {entity.kind === "TASK" && (
                <label className="settings-row">
                  <span>할 일 완료</span>
                  <input
                    type="checkbox"
                    checked={entity.completed}
                    disabled={busy}
                    onChange={() =>
                      act(() => save(entity, { completed: !entity.completed }))
                    }
                  />
                </label>
              )}
            </section>
            {entity.kind==='ROADMAP'&&<section className="ws-panel roadmap-outline" aria-label="로드맵 계획">
              <div className="ws-section-title"><h2>세부 목표와 할 일</h2><button className="ws-button primary" onClick={()=>create('MILESTONE',entity.id)}>＋ 세부 목표</button></div>
              {entries.filter(e=>e.kind==='MILESTONE'&&e.parentId===entity.id).map(e=><details className="roadmap-step" key={e.id}>
                <summary><strong>{e.title}</strong><small>{progress(entries,e.id).percent}%</small></summary>
                <div className="roadmap-step-content">
                  <div className="roadmap-step-actions"><Link className="ws-button" to={link(e)}>목표 상세</Link><button className="ws-button" onClick={()=>create('TASK',e.id)}>＋ 할 일</button><details className="learning-row-menu"><summary aria-label={e.title+' 관리'}>···</summary><div><button disabled={busy} onClick={()=>openEditor(e)}>편집</button><button disabled={busy} onClick={()=>move(e,-1)}>위로 이동</button><button disabled={busy} onClick={()=>move(e,1)}>아래로 이동</button><button disabled={busy} onClick={()=>destroy(e)}>삭제</button></div></details></div>
                  {e.body&&<p className="learning-plain">{e.body}</p>}
                  {entries.filter(t=>t.kind==='TASK'&&t.parentId===e.id).map(taskRow)}
                  {!entries.some(t=>t.kind==='TASK'&&t.parentId===e.id)&&<p className="ws-muted">아직 할 일이 없습니다.</p>}
                </div>
              </details>)}
              {!entries.some(e=>e.kind==='MILESTONE'&&e.parentId===entity.id)&&<p className="ws-muted">세부 목표를 추가해 계획을 나눠보세요.</p>}
            </section>}
            {entity.kind === "MILESTONE" && (
              <section className="ws-panel">
                <div className="ws-section-title">
                  <h2>할 일</h2>
                  <button
                    className="ws-button primary"
                    onClick={() => create("TASK", entity.id)}
                  >
                    ＋ 할 일
                  </button>
                </div>
                {entries
                  .filter((e) => e.kind === "TASK" && e.parentId === entity.id)
                  .map(taskRow)}
                {!entries.some(
                  (e) => e.kind === "TASK" && e.parentId === entity.id,
                ) && (
                  <div className="ws-empty compact">
                    목표를 작은 할 일로 나눠보세요.
                  </div>
                )}
              </section>
            )}
            <details className="ws-panel learning-related" key={entity.id+'-schedule'} open={schedule?.id===entity.id||undefined}><summary>학습 예정일 <span>{entries.filter(e=>e.kind==='SCHEDULE'&&(e.parentId===entity.id||selectedIds.has(e.parentId))).length}개</span></summary>
              <div className="ws-section-title">

                {entity.kind === "TASK" && (
                  <button
                    className="ws-button"
                    onClick={() => {
                      setSchedule(entity);
                      setScheduleDate(
                        entity.startDate > dateKey()
                          ? entity.startDate
                          : entity.endDate < dateKey()
                            ? entity.endDate
                            : dateKey(),
                      );
                    }}
                  >
                    ＋ 공부 날짜
                  </button>
                )}
              </div>
              {schedule?.id===entity.id && (
                <InlineEditor title="학습 예정일" busy={busy} onClose={() => setSchedule(null)}>
                  <form
                    className="ws-modal-body"
                    onSubmit={(e) => {
                      e.preventDefault();
                      act(async () => {
                        await save({
                          kind: "SCHEDULE",
                          title: schedule.title,
                          parentId: schedule.id,
                          startDate: scheduleDate,
                          details: {},
                        });
                        setSchedule(null);
                      });
                    }}
                  >
                    <p>{schedule.title}</p>
                    <label className="ws-field">
                      공부할 날짜
                      <input
                        type="date"
                        required
                        min={schedule.startDate}
                        max={schedule.endDate}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </label>
                    <button className="ws-button primary" disabled={busy}>
                      예정일 저장
                    </button>
                  </form>
                </InlineEditor>
              )}
              {entries
                .filter(
                  (e) =>
                    e.kind === "SCHEDULE" &&
                    (e.parentId === entity.id || selectedIds.has(e.parentId)),
                )
                .map((e) => (
                  <div className="ws-list-row" key={e.id}>
                    <Link to={`/calendar?date=${e.startDate}`}>
                      {e.startDate} ·{" "}
                      {entries.find((t) => t.id === e.parentId)?.title ||
                        e.title}
                    </Link>
                    <button
                      className="ws-button danger"
                      disabled={busy}
                      onClick={() => act(() => remove(e.id))}
                    >
                      삭제
                    </button>
                  </div>
                ))}
              <p className="ws-muted">
                할 일 상세에서 공부할 날짜를 여러 개 지정할 수 있습니다.
              </p>
            </details>
            <details className="learning-related learning-materials" key={entity.id+'-materials'}><summary>학습노트·PDF <span>{visibleRecords.length}개</span></summary>{recordBrowser}</details>

          </>
        )}
      {section === "records" && !id && recordBrowser}
      {section === "records" && id && entity?.kind === "RECORD" && (
        <RecordDetail
          entry={entity}
          onEdit={() => openEditor(entity)}
          onDelete={() => destroy(entity)}
        />
      )}
      {section === "pdf" && <PdfWorkspace id={id} />}
      {section === "words" && <WordLibrary />}
      {id && !entity && (
        <div className="ws-empty">
          항목이 없거나 접근할 수 없습니다.
          <Link className="ws-button" to="/learning">
            학습 홈으로
          </Link>
        </div>
      )}
      {section &&
        ![
          "roadmaps",
          "milestones",
          "tasks",
          "records",
          "pdf",
          "words",
          "today",
        ].includes(section) && (
          <div className="ws-empty">
            페이지를 찾을 수 없습니다.<Link to="/learning">학습 홈으로</Link>
          </div>
        )}

    </WorkspaceShell>
  );
}

function RecordDetail({ entry, onEdit, onDelete }) {
  const { entries, save, remove } = useWorkspace();
  const [selection, setSelection] = useState(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const comments = entries.filter(
    (e) => e.kind === "COMMENT" && e.parentId === entry.id,
  );
  const fingerprints = useMemo(
    () =>
      new Set(
        [...entry.body.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) =>
          codeFingerprint(m[1].replace(/\n$/, "")),
        ),
      ),
    [entry.body],
  );
  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save(
        editing
          ? { ...editing, body: comment }
          : {
              kind: "COMMENT",
              title: selection
                ? `${selection.lineStart}~${selection.lineEnd}줄 설명`
                : "노트 댓글",
              body: comment,
              parentId: entry.id,
              details: selection || {},
            },
      );
      setComment("");
      setEditing(null);
      setSelection(null);
      setNotice("");
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="learning-breadcrumb">
        <Link to="/learning/records">학습노트</Link>
        <span> / {entry.title}</span>
      </div>
      <div className="record-detail-columns">
        <article className="ws-panel">
          <div className="ws-section-title">
            <div>
              <small>
                {entry.startDate} · {parentLabel(entries, entry) || "독립 노트"}
              </small>
              <h2>{entry.title}</h2>
            </div>
            <div className="ws-actions">
              <button className="ws-button" onClick={onEdit}>
                편집
              </button>
              <button className="ws-button danger" onClick={onDelete}>
                삭제
              </button>
            </div>
          </div>
          <LearningMarkdown
            body={entry.body}
            format={entry.format}
            onSelect={
              ["markdown","richtext"].includes(entry.format)
                ? (s) => {
                    setSelection(s);
                    setEditing(null);
                  }
                : undefined
            }
          />
        </article>
        <aside className="ws-panel record-comments">
          <h3>설명과 댓글</h3>
          <p className="ws-muted">
            코드 줄 번호를 누르고 Shift로 범위를 선택하면 해당 코드에 설명을
            남길 수 있습니다.
          </p>
          {notice && (
            <div className="ws-alert" role="alert">
              {notice}
            </div>
          )}
          {selection && (
            <div className="comment-quote">
              <small>
                {selection.lineStart}~{selection.lineEnd}줄 선택
              </small>
              <pre>{selection.quote}</pre>
              <button className="ws-button" onClick={() => setSelection(null)}>
                선택 해제
              </button>
            </div>
          )}
          <form onSubmit={post}>
            <label className="ws-field">
              {editing ? "댓글 수정" : "설명 작성"}
              <textarea
                required
                aria-label={editing ? "댓글 수정" : "설명 작성"}
                maxLength={10000}
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </label>
            <button className="ws-button primary" disabled={busy}>
              {editing ? "수정 저장" : "댓글 저장"}
            </button>
            {editing && (
              <button
                type="button"
                className="ws-button"
                onClick={() => {
                  setEditing(null);
                  setComment("");
                }}
              >
                취소
              </button>
            )}
          </form>
          {comments.map((c) => (
            <article className="record-comment" key={c.id}>
              <small>{c.title}</small>
              {c.details.codeFingerprint &&
                !fingerprints.has(c.details.codeFingerprint) && (
                  <span className="ws-tag">원본 코드 변경됨</span>
                )}
              {c.details.quote && <pre>{c.details.quote}</pre>}
              <p>{c.body}</p>
              <div className="ws-actions">
                <button
                  className="ws-button"
                  onClick={() => {
                    setEditing(c);
                    setComment(c.body);
                    setSelection(c.details);
                  }}
                >
                  수정
                </button>
                <button
                  className="ws-button danger"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm("댓글을 삭제할까요?")) return;
                    try {
                      await remove(c.id);
                    } catch (e) {
                      setNotice(messageOf(e));
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            </article>
          ))}
        </aside>
      </div>
    </>
  );
}

