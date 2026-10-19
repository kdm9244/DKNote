import WordBatchEditor from '../../components/workspace/WordBatchEditor';
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import { parentLabel } from "../../components/workspace/learningHelpers";
import { messageOf } from "../../api/workspace";
import WordEditor from "../../components/workspace/WordEditor";

export default function WordLibrary() {
  const { entries, mastery: saveMastery } = useWorkspace();
  const [query, setQuery] = useState("");
  const [mastery, setMastery] = useState("all");
  const [source, setSource] = useState("all");
  const [language, setLanguage] = useState("all");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filtersOpen,setFiltersOpen]=useState(false);
  useEffect(() => {
    setPage(1);
  }, [query, mastery, source, language]);
  const [editingWord, setEditingWord] = useState(null);
  const groups = useMemo(() => {
    const map = new Map();
    entries
      .filter((e) => e.kind === "WORD")
      .sort((a,b)=>(a.position??0)-(b.position??0)||(a.createdAt||'').localeCompare(b.createdAt||'')||a.id.localeCompare(b.id))
      .forEach((w) => {
        const key = `${w.details.language || "other"}:${w.title.normalize("NFKC").trim().toLowerCase()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(w);
      });
    return [...map.entries()].map(([key, words]) => ({
      key,
      words,
      word: words[0],
      mastered: words.every((w) => w.completed),
    }));
  }, [entries]);
  const filtered = groups.filter(
    (g) =>
      (mastery === "all" || (mastery === "done") === g.mastered) &&
      (language === "all" || g.word.details.language === language) &&
      (source === "all" || g.words.some((w) => w.parentId === source)) &&
      (!query ||
        g.words.some((w) =>
          `${w.title} ${w.body} ${w.details.reading || ""} ${parentLabel(entries, w)}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )),
  );
  const toggle = async (group, done) => {
    setBusy(true);
    try {
      await saveMastery(
        group.words.map((w) => w.id),
        done,
      );
      setNotice("");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    if (
      !window.confirm(
        `현재 검색·필터 조건의 단어 ${filtered.length}개를 모든 페이지에서 암기 해제할까요? 다른 PDF의 같은 단어에도 적용됩니다.`,
      )
    )
      return;
    setBusy(true);
    try {
      await saveMastery(
        filtered.flatMap((g) => g.words.map((w) => w.id)),
        false,
      );
      setNotice("현재 조건의 단어를 암기 해제했습니다.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="ws-panel word-library">
      <div className="ws-section-title">
        <div>
          <h2>전체 단어장</h2>
          <p className="ws-muted">
            표기 · 읽는 법 · 뜻을 한눈에 확인하세요.
          </p>
        </div>
        <button
          className="ws-button"
          disabled={busy || !filtered.length}
          onClick={reset}
        >
          필터 결과 암기 해제
        </button>
      </div>
      {notice && (
        <div className="ws-alert" role="status">
          {notice}
        </div>
      )}
      <details className="word-batch-library"><summary>＋ 단어 표 입력 · 일괄 붙여넣기</summary><WordBatchEditor /></details>
      <div className="record-filters">
        <input
          placeholder="단어·뜻·읽는 법·학습 목표 검색"
          aria-label="단어 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="button" className="ws-button word-filter-toggle" aria-expanded={filtersOpen} aria-controls="word-filters" onClick={()=>setFiltersOpen(v=>!v)}>필터</button>
        <div id="word-filters" className={`word-filter-controls${filtersOpen?' is-open':''}`}>
        <select
          aria-label="암기 상태"
          value={mastery}
          onChange={(e) => setMastery(e.target.value)}
        >
          <option value="all">모든 암기 상태</option>
          <option value="todo">미암기</option>
          <option value="done">암기 완료</option>
        </select>
        <select
          aria-label="언어"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="all">모든 언어</option>
          <option value="ja">일본어</option>
          <option value="en">영어</option>
          <option value="ko">한국어</option>
          <option value="other">기타</option>
        </select>
        <select
          aria-label="PDF 출처"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="all">모든 PDF</option>
          {entries
            .filter((e) => e.kind === "PDF")
            .map((e) => (
              <option value={e.id} key={e.id}>
                {e.title}
              </option>
            ))}
        </select>
        </div>
      </div>
      <div className="word-stats">
        <span>전체 {groups.length}개</span>
        <span>암기 {groups.filter((g) => g.mastered).length}개</span>
        <span>검색 결과 {filtered.length}개</span>
      </div>
      {!!filtered.length&&<div className="word-library-columns" aria-hidden="true"><span>암기</span><span>한자·단어</span><span>읽는 법</span><span>뜻</span><span>관리</span></div>}
      {filtered.slice((page - 1) * 10, page * 10).map((g) => (
        <Fragment key={g.key}><article
          className={`word-library-row ${g.mastered ? "mastered" : ""}`}
        >
          <label className="word-entry-check">
            <input
              type="checkbox"
              aria-label={`${g.word.title} 암기 완료`}
              disabled={busy}
              checked={g.mastered}
              onChange={(e) => toggle(g, e.target.checked)}
            />
          </label>
          <strong className="word-entry-title">{g.word.title}</strong>
          <span className="word-entry-reading">{g.word.details.reading||'—'}</span>
          <div className="word-entry-meaning">
            <p>{g.word.body}</p>
            <details>
              <summary>출처 {g.words.length}개 보기</summary>
              {g.words.map((w) => w.parentId ? (
                <Link
                  key={w.id}
                  to={`/learning/pdf/${w.parentId}?page=${w.details.page || 1}`}
                >
                  {entries.find((e) => e.id === w.parentId)?.title || "PDF"} ·{" "}
                  {w.details.page || 1}p
                  <span className="ws-muted"> {parentLabel(entries, w)}</span>
                </Link>
              ) : <span key={w.id}>직접 등록한 단어</span>)}
            </details>
          </div>
          <button type="button" className="ws-button" onClick={()=>setEditingWord(g.word)}>편집</button>
        </article>{editingWord && g.words.some(w=>w.id===editingWord.id) && <WordEditor key={editingWord.id} item={editingWord} onClose={()=>setEditingWord(null)} />}</Fragment>
      ))}
      {!filtered.length && (
        <div className="ws-empty">
          표시할 단어가 없습니다.
          <Link to="/learning/pdf" className="ws-button">
            PDF에서 단어 추가하기
          </Link>
        </div>
      )}
      {filtered.length>10&&<div className="ws-pagination">
        <button
          className="ws-button"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          이전
        </button>
        <span>
          {page} / {Math.max(1, Math.ceil(filtered.length / 10))}
        </span>
        <button
          className="ws-button"
          disabled={page * 10 >= filtered.length}
          onClick={() => setPage((p) => p + 1)}
        >
          다음
        </button>
      </div>}
    </section>
  );
}
