import SaveStatus from '../../components/workspace/SaveStatus';
import WordInlineTable from '../../components/workspace/WordInlineTable';
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import { workspaceApi, messageOf } from "../../api/workspace";
import {
  parentLabel,
  KIND_LABEL,
} from "../../components/workspace/learningHelpers";
import PdfPageNotes from "../../components/workspace/PdfPageNotes";
import WordBatchEditor from "../../components/workspace/WordBatchEditor";
import WordEditor from "../../components/workspace/WordEditor";
import '../../styles/pdf-reader.css';
const PdfReader = lazy(() => import('../../components/workspace/PdfReader'));

export default function PdfWorkspace({ id }) {
  const { entries, upload, save, remove, settings, preferences, uid } = useWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pdfs = entries.filter((e) => e.kind === "PDF");
  const pdf = pdfs.find((e) => e.id === id);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [parent, setParent] = useState(params.get("parent") || "");
  const parentParam = params.get("parent") || "";
  useEffect(() => { if (!id) setParent(parentParam); }, [id, parentParam]);
  const [url, setUrl] = useState("");
  const [page, setPage] = useState(
    Math.max(1, Number(params.get("page")) || 1),
  );
  const [tab, setTab] = useState("notes");
  const [viewMode,setViewMode]=useState('split');
  const [readerMode,setReaderMode]=useState(()=>{try{return localStorage.getItem(`dknote_pdf_view_${uid}`)==='study'?'study':'original';}catch{return 'original';}});
  const chooseReader=mode=>{setReaderMode(mode);try{localStorage.setItem(`dknote_pdf_view_${uid}`,mode);}catch{/* Viewing also works without local storage. */}};
  const [ratio,setRatio]=useState(settings.pdfNoteRatio ?? 55);
  const [wordRatio,setWordRatio]=useState(settings.pdfWordRatio ?? 40);
  const [ratioPhase,setRatioPhase]=useState('idle');
  const preferencesRef=useRef(preferences);preferencesRef.current=preferences;
  const ratioSaved=useRef({ratio,wordRatio}),ratioLatest=useRef({ratio,wordRatio});ratioLatest.current={ratio,wordRatio};
  const ratioQueue=useRef(Promise.resolve()),ratioMounted=useRef(true),ratioPending=useRef(0);
  useEffect(()=>{ratioMounted.current=true;return()=>{ratioMounted.current=false;};},[]);
  useEffect(()=>{
    if(ratio===ratioSaved.current.ratio&&wordRatio===ratioSaved.current.wordRatio&&ratioPending.current===0)return;
    setRatioPhase('draft');
    const timer=setTimeout(()=>{
      const snapshot={ratio,wordRatio};setRatioPhase('saving');
      ratioPending.current+=1;
      ratioQueue.current=ratioQueue.current.catch(()=>{}).then(()=>preferencesRef.current({pdfNoteRatio:ratio,pdfWordRatio:wordRatio}));
      ratioQueue.current.then(()=>{ratioSaved.current=snapshot;if(ratioMounted.current&&ratioLatest.current.ratio===ratio&&ratioLatest.current.wordRatio===wordRatio)setRatioPhase('saved');}).catch(()=>{if(ratioMounted.current)setRatioPhase('error');}).finally(()=>{ratioPending.current-=1;});
    },500);
    return()=>clearTimeout(timer);
  },[ratio,wordRatio,uid]);
  const [infoOpen,setInfoOpen]=useState(false);
  const [metaPhase,setMetaPhase]=useState("idle");
  const [title, setTitle] = useState("");
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [reading, setReading] = useState("");
  const [language, setLanguage] = useState("ja");
  const [editingWord, setEditingWord] = useState(null);
  const pageParam = params.get("page");
  useEffect(() => {
    setPage(Math.max(1, Math.min(100000, Math.trunc(Number(pageParam) || 1))));
  }, [id, pageParam]);
  useEffect(() => {
    if (!pdf) return;
    setTitle(pdf.title);
    setParent(pdf.parentId || "");
    setInfoOpen(false);setMetaPhase("idle");
  }, [pdf?.id]);
  useEffect(() => {
    if (!id) return;
    let active = true,
      objectUrl = "";
    setUrl("");
    setNotice("");
    workspaceApi
      .pdf(id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((e) => {
        if (active) setNotice(messageOf(e));
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  const uploadFiles = async (files) => {
    setBusy(true);
    setNotice("");
    try {
      for (const file of files) {
        if (
          file.type !== "application/pdf" &&
          !file.name.toLowerCase().endsWith(".pdf")
        )
          throw new Error("PDF 파일만 선택하세요.");
        if (file.size > 20 * 1024 * 1024)
          throw new Error("PDF는 20MB 이하로 업로드하세요.");
        const result = await upload(file, parent);
        if (files.length === 1) navigate(`/learning/pdf/${result.id}`);
      }
    } catch (e) {
      setNotice(e.response ? messageOf(e) : e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveNote = async () => {
    setBusy(true);setMetaPhase("saving");
    try {
      await save(pdf, {
        title: title.trim(),
        parentId: parent || null,
      });
      setNotice("");setMetaPhase("saved");
    } catch (e) {
      setNotice(messageOf(e));setMetaPhase("error");
    } finally {
      setBusy(false);
    }
  };
  const addWord = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await save({
        kind: "WORD",
        parentId: pdf.id,
        title: word.trim(),
        body: meaning.trim(),
        details: { reading, language, page },
      });
      setWord("");
      setMeaning("");
      setReading("");
      setNotice("단어를 저장했습니다.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setBusy(false);
    }
  };
  const parentOptions = entries.filter((e) =>
    ["ROADMAP", "MILESTONE", "TASK"].includes(e.kind),
  );
  if (!id)
    return (
      <>
        <section className="ws-panel">
          <div className="ws-section-title">
            <h2>PDF 학습 자료</h2>
            <Link to="/learning/words" className="ws-button">
              전체 단어장 →
            </Link>
          </div>
          <p className="ws-muted">
            PDF를 읽으며 페이지별 필기와 단어를 정리하세요. 파일당 최대
            20MB입니다.
          </p>
          <div className="ws-form-grid">
            <label className="ws-field">
              연결할 학습 목표
              <select
                aria-label="연결할 학습 목표"
                value={parent}
                onChange={(e) => setParent(e.target.value)}
              >
                <option value="">독립 자료</option>
                {parentOptions.map((e) => (
                  <option value={e.id} key={e.id}>
                    {KIND_LABEL[e.kind]} · {e.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="ws-field">
              자료 검색
              <input
                value={query}
                placeholder="제목 또는 연결된 목표"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <label
            className={`pdf-dropzone ${busy ? "busy" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) uploadFiles([...e.dataTransfer.files]);
            }}
          >
            <span>📄</span>
            <strong>
              {busy ? "업로드 중…" : "PDF 파일을 놓거나 선택하세요"}
            </strong>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={busy}
              onChange={(e) => {
                uploadFiles([...e.target.files]);
                e.target.value = "";
              }}
            />
          </label>
        </section>
        {notice && (
          <div className="ws-alert" role="status">
            {notice}
          </div>
        )}
        <div className="roadmap-grid">
          {pdfs
            .filter((e) =>
              `${e.title} ${parentLabel(entries, e)}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            )
            .map((e) => (
              <Link
                className="ws-panel pdf-card"
                to={`/learning/pdf/${e.id}`}
                key={e.id}
              >
                <span>📄</span>
                <h3>{e.title}</h3>
                <p>{parentLabel(entries, e) || "독립 자료"}</p>
                <small>
                  {Object.keys(e.details.pages || {}).length}개 페이지 필기 ·{" "}
                  {
                    entries.filter(
                      (w) => w.kind === "WORD" && w.parentId === e.id,
                    ).length
                  }
                  개 단어
                </small>
              </Link>
            ))}
        </div>
        {!pdfs.length && (
          <div className="ws-empty">첫 PDF 자료를 추가해보세요.</div>
        )}
      </>
    );
  if (!pdf) return null;
  const words = entries.filter(
    (e) =>
      e.kind === "WORD" &&
      e.parentId === pdf.id &&
      Number(e.details.page) === page,
  );
  const activeRatio=tab === "words" ? wordRatio : ratio;
  const resize=(value)=>tab === "words" ? setWordRatio(value) : setRatio(value);
  const metadataDirty=title.trim()!==pdf.title || (parent || null)!==(pdf.parentId || null);
  const readerModes=<div className="pdf-reader-modes" role="group" aria-label="PDF 보기 방식">
    <button type="button" aria-pressed={readerMode==='original'} onClick={()=>chooseReader('original')}>원본 보기</button>
    <button type="button" aria-pressed={readerMode==='study'} onClick={()=>chooseReader('study')}>학습 보기</button>
  </div>;
  return (
    <div className="pdf-reading-layout">
      {notice && (
        <div className="ws-alert" role="status">
          {notice}
        </div>
      )}
      <div className="pdf-reading-topbar">
      <div className="learning-breadcrumb">
        <Link to="/learning/pdf">PDF 노트</Link>
        <span> / {pdf.title}</span>
      </div>
      <div className="pdf-view-tools"><div className="ws-actions" role="group" aria-label="PDF 화면 보기">
        <button type="button" className="ws-button" aria-pressed={viewMode==='pdf'} onClick={()=>setViewMode(current=>current==='pdf'?'split':'pdf')}>{viewMode==='pdf'?'분할 화면으로':'PDF 넓게 보기'}</button>
        <button type="button" className="ws-button" aria-pressed={viewMode==='notes'} onClick={()=>setViewMode(current=>current==='notes'?'split':'notes')}>{viewMode==='notes'?'PDF와 함께 보기':`${tab==='words'?'단어':'필기'} 넓게 보기`}</button>
      </div></div>
      </div>
      <div className={`pdf-workspace improved ${viewMode==='notes'?'notes-wide':viewMode==='pdf'?'pdf-wide':''}`} style={{'--pdf-ratio':`${activeRatio}%`}}>
        <section className="ws-panel pdf-document">
          {url ? readerMode==='original'? <div className="pdf-original-reader">
            <div className="pdf-reader-toolbar pdf-original-toolbar" aria-label="PDF 원본 도구">{readerModes}<label className="pdf-original-page" title="원본 페이지에 맞춰 필기 페이지를 선택하세요.">필기 <input aria-label="원본 보기 필기 페이지" type="number" min="1" max="100000" value={page} onChange={e=>setPage(Math.max(1,Math.min(100000,Math.trunc(Number(e.target.value))||1)))}/></label><a href={`${url}#page=${page}`} target="_blank" rel="noopener noreferrer" aria-label="원본 새 창" title="원본 새 창">새 창 ↗</a></div>
            <iframe key={`${id}:${page}`} src={`${url}#page=${page}`} title={`${pdf.title} 원본 PDF`}/>
          </div> : (
            <Suspense fallback={<div className="ws-empty">PDF 도구를 불러오는 중…</div>}>
              <PdfReader key={id} url={url} title={pdf.title} page={page} onPageChange={setPage} modeControls={readerModes}/>
            </Suspense>
          ) : (
            <div className="ws-empty">PDF를 불러오는 중…</div>
          )}
        </section>
        <div className="pdf-resizer" role="separator" aria-label="PDF와 필기 너비 조절" aria-orientation="vertical" aria-valuenow={activeRatio} aria-valuemin={30} aria-valuemax={70} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();resize(Math.max(30,Math.min(70,activeRatio+(e.key==='ArrowLeft'?-2:2))));}}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const box=e.currentTarget.parentElement.getBoundingClientRect();resize(Math.max(30,Math.min(70,(e.clientX-box.left)/box.width*100)));}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)} />
        <aside className="ws-panel pdf-notes-pane">
      {editingWord && (
        <WordEditor key={editingWord.id} item={editingWord} onClose={() => setEditingWord(null)} />
      )}
          <div className="ws-tabs">
            <button
              className={tab === "notes" ? "active" : ""}
              onClick={() => setTab("notes")}
            >
              페이지 필기
            </button>
            <button
              className={tab === "words" ? "active" : ""}
              onClick={() => setTab("words")}
            >
              단어 ({words.length})
            </button>
          </div>
          {tab === "notes" ? (
            <>
              <PdfPageNotes key={`${id}:${page}`} pdf={pdf} page={page} />
              <details className="pdf-note-pages"><summary>필기가 있는 페이지</summary>
              <div className="ws-actions">
                {Object.entries(pdf.details.pages || {})
                  .filter(([, v]) => v.body)
                  .map(([n]) => (
                    <button
                      className="ws-button"
                      key={n}
                      onClick={() => setPage(Number(n))}
                    >
                      {n}p
                    </button>
                  ))}
              </div>
              </details>
            </>
          ) : (
            <>
              <WordBatchEditor key={`${id}:${page}`} parentId={id} page={page} />
              <details><summary>한 단어씩 추가</summary><form onSubmit={addWord}>
                <h3>{page}페이지 단어 추가</h3>
                <label className="ws-field">
                  단어
                  <input
                    required
                    maxLength={200}
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                  />
                </label>
                <label className="ws-field">
                  읽는 법
                  <input
                    maxLength={200}
                    value={reading}
                    onChange={(e) => setReading(e.target.value)}
                  />
                </label>
                <label className="ws-field">
                  뜻 / 예문
                  <textarea
                    aria-label="뜻 / 예문"
                    rows={3}
                    maxLength={10000}
                    value={meaning}
                    onChange={(e) => setMeaning(e.target.value)}
                  />
                </label>
                <label className="ws-field">
                  언어
                  <select
                    value={language}
                    aria-label="언어"
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="ja">일본어</option>
                    <option value="en">영어</option>
                    <option value="ko">한국어</option>
                    <option value="other">기타</option>
                  </select>
                </label>
                <button className="ws-button primary" disabled={busy}>
                  단어 저장
                </button>
              </form></details>
              <div className="word-table-heading"><h3>이 페이지의 단어</h3><SaveStatus phase="idle" message="행을 수정한 뒤 저장하세요."/></div><WordInlineTable words={words} onAdvanced={setEditingWord} />
            </>
          )}
        </aside>
      </div>
      <section className="pdf-resource-footer">
        <div className="pdf-resource-summary">
          <div className="pdf-footer-caption">{viewMode==='split'&&ratioPhase!=='idle'&&<SaveStatus mode="auto" label="화면 비율" phase={ratioPhase} message={ratioPhase==='saved'?'저장됨':ratioPhase==='draft'?'저장 대기':ratioPhase==='saving'?'저장 중…':'저장 실패'} />}</div>
          <div className="pdf-resource-actions"><button type="button" className="ws-button" aria-expanded={infoOpen} aria-controls="pdf-info-fields" onClick={()=>setInfoOpen(!infoOpen)}>{infoOpen?'자료 정보 접기':'자료 정보'}</button><a className="ws-button" href={url} download={pdf.details.fileName} aria-disabled={!url} onClick={e=>{if(!url)e.preventDefault();}}>다운로드</a></div>
        </div>
        {infoOpen && <div id="pdf-info-fields" className="pdf-info-fields">
          <label className="ws-field">자료 제목<input aria-label="PDF 제목" maxLength={200} value={title} disabled={busy} onChange={e=>{setTitle(e.target.value);setMetaPhase('draft');}}/></label>
          <label className="ws-field">연결할 목표<select aria-label="학습 목표 연결" value={parent} disabled={busy} onChange={e=>{setParent(e.target.value);setMetaPhase('draft');}}><option value="">독립 자료</option>{parentOptions.map(e=><option value={e.id} key={e.id}>{KIND_LABEL[e.kind]} · {e.title}</option>)}</select></label>
          <button type="button" className="ws-button primary" disabled={busy || !title.trim() || !metadataDirty} onClick={saveNote}>자료 정보 저장</button>
          <button type="button" className="ws-button" disabled={busy || !metadataDirty} onClick={()=>{setTitle(pdf.title);setParent(pdf.parentId || '');setMetaPhase('idle');}}>변경 취소</button>
          <button type="button" className="ws-button danger" disabled={busy} onClick={async()=>{if(!window.confirm('PDF와 페이지 필기·소속 단어를 삭제할까요?'))return;try{await remove(pdf.id);navigate('/learning/pdf');}catch(e){setNotice(messageOf(e));}}}>자료 삭제</button>
          <SaveStatus label="자료 정보" phase={metaPhase==='saving'||metaPhase==='error'?metaPhase:metadataDirty?'draft':metaPhase==='saved'?'saved':'idle'} message={metaPhase==='saved'&&!metadataDirty?'자료 정보를 저장했습니다.':undefined} />
        </div>}
        {!infoOpen && metadataDirty && <SaveStatus label="자료 정보" phase="draft" message="수정한 자료 정보가 있습니다. 펼쳐서 저장하세요."/>}
        {!infoOpen && !metadataDirty && metaPhase==='saved' && <SaveStatus label="자료 정보" phase="saved" message="자료 정보를 저장했습니다."/>}
      </section>

    </div>
  );
}

