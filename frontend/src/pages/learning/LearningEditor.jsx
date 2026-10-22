import { useEffect, useRef, useState } from 'react';
import SaveStatus from '../../components/workspace/SaveStatus';
import RichEditor from '../../components/workspace/RichEditor';
import LearningGoalPicker from '../../components/workspace/LearningGoalPicker';
import { useWorkspace } from '../../components/workspace/workspaceContext';
import { KIND_LABEL, parentLabel } from '../../components/workspace/learningHelpers';
import LearningMarkdown from '../../components/workspace/LearningMarkdown';
import { editorHtml } from '../../services/richText';
import { messageOf } from '../../api/workspace';
import '../../styles/learning-note.css';

export default function LearningEditor({ item, onClose, onSaved }) {
  const { entries, save, uid } = useWorkspace();
  const formRef=useRef(null);
  const draftKey = `dknote_draft_${uid}_${item.id || `${item.kind}_${item.parentId || "independent"}`}`;
  const [form, setForm] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      return draft
        ? { ...item, ...draft, id: item.id, version: item.version }
        : item;
    } catch {
      return item;
    }
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {
      setError("브라우저 저장 공간이 부족해 임시 저장을 사용할 수 없습니다.");
    }
  }, [draftKey, form]);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const parentOptions = entries.filter((e) =>
    form.kind === "MILESTONE"
      ? e.kind === "ROADMAP"
      : form.kind === "TASK"
        ? e.kind === "MILESTONE" &&
          (!item.id ||
            e.parentId ===
              entries.find((p) => p.id === item.parentId)?.parentId)
        : ["ROADMAP", "MILESTONE", "TASK"].includes(e.kind),
  );
  const saveForm = async (e) => {
    e.preventDefault();
    if(busy)return;
    setBusy(true);
    setError("");
    try {
      const result = await save(form);
      localStorage.removeItem(draftKey);
      onSaved(result);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  const template = () => {
    if (form.body && !window.confirm("현재 본문을 학습 템플릿으로 바꿀까요?"))
      return;
    set(
      "body",
      "# 오늘 배운 내용\n\n## 핵심 개념\n\n## 코드와 실행 결과\n\n```java\n// 예제 코드를 작성하세요\n```\n\n## 어려웠던 점\n\n## 다음에 할 일\n",
    );
    set("format", "markdown");
  };
  const title=`${KIND_LABEL[form.kind]} ${item.id ? '편집' : '만들기'}`;
  const status=<SaveStatus label={KIND_LABEL[form.kind]} phase={error?'error':busy?'saving':!item.id||JSON.stringify(form)!==JSON.stringify(item)?'draft':'idle'} message={error?'저장 실패 · 초안은 보관됩니다.':busy?'저장 중…':!item.id||JSON.stringify(form)!==JSON.stringify(item)?'초안만 보관됨 · 저장 버튼으로 반영하세요.':'변경 내용 없음'} />;
  return (
    <section className={`learning-entry-composer${form.kind==='RECORD'?' learning-note-composer':''} ws-panel`} role="region" aria-label={title}>
      <header className="learning-note-toolbar"><button type="button" className="ws-button" disabled={busy} onClick={onClose} aria-label="편집 닫기">← 돌아가기</button>{status}<button type="submit" form="learning-entry-form" className="ws-button primary" disabled={busy}>{busy?'저장 중…':'저장'}</button></header>
      <form ref={formRef} id="learning-entry-form" className="ws-modal-body" onSubmit={saveForm}>
        {error && (
          <div className="ws-alert" role="alert">
            {error}
          </div>
        )}
        <div className={`learning-note-meta${form.kind==='RECORD'?'':' is-goal'}`}>
        <label className="ws-field">
          제목
          <input
            required
            maxLength={200}
            autoFocus
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </label>
        {form.kind === 'RECORD' && <details className="learning-note-goal-details">
          <summary><span>연결할 목표</span><strong>{parentLabel(entries, {parentId:form.parentId}) || '독립 노트'}</strong><small>변경</small></summary>
          <LearningGoalPicker entries={entries} value={form.parentId} onChange={value => set('parentId', value)} disabled={busy} />
        </details>}
        {!["ROADMAP", "RECORD"].includes(form.kind) && (
          <label className="ws-field">
            연결할 목표
            <select
              value={form.parentId || ""}
              required={["MILESTONE", "TASK"].includes(form.kind)}
              onChange={(e) => set("parentId", e.target.value || null)}
            >
              <option value="">
                {["MILESTONE", "TASK"].includes(form.kind)
                  ? "상위 목표 선택"
                  : "독립 노트"}
              </option>
              {parentOptions.map((e) => (
                <option value={e.id} key={e.id}>
                  {KIND_LABEL[e.kind]} ·{" "}
                  {parentLabel(entries, e)
                    ? `${parentLabel(entries, e)} / `
                    : ""}
                  {e.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="ws-form-grid">
          <label className="ws-field">
            {form.kind === "RECORD" ? "공부 날짜" : "시작일"}
            <input
              required
              type="date"
              value={form.startDate || ""}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </label>
          {form.kind !== "RECORD" && (
            <label className="ws-field">
              목표 완료일
              <input
                required
                type="date"
                min={form.startDate}
                value={form.endDate || ""}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </label>
          )}
        </div>
        </div>
        {form.kind === "RECORD" && (
          <div className="ws-actions">
            <div className="ws-tabs">
              <button
                type="button"
                className={form.format !== "markdown" ? "active" : ""}
                onClick={()=>{setPreview(false);setForm(f=>({...f,body:editorHtml(f.body,f.format),format:"richtext"}));}}
              >
                문서 편집
              </button>
              <button
                type="button"
                disabled={form.format === "richtext" && Boolean(form.body?.replace(/<[^>]*>/g, "").trim())}
                className={form.format === "markdown" ? "active" : ""}
                onClick={() => set("format", "markdown")}
              >
                Markdown
              </button>
            </div>
            <button
              type="button"
              className="ws-button"
              onClick={() => setPreview(!preview)}
            >
              {preview ? "편집" : "미리보기"}
            </button>
            <button type="button" className="ws-button" onClick={template}>
              학습 템플릿
            </button>
          </div>
        )}
        {preview ? (
          <div className="record-preview">
            <LearningMarkdown body={form.body} format={form.format} />
          </div>
        ) : form.kind === "RECORD" && form.format !== "markdown" ? (
          <RichEditor body={form.body} format={form.format} label="학습 내용" onChange={(body,format)=>setForm(f=>({...f,body,format}))} onSave={()=>formRef.current?.requestSubmit()} disabled={busy} />
        ) : (
          <label className="ws-field">
            {form.kind === "RECORD" ? "학습 내용" : "설명 / 완료 기준"}
            <textarea
              aria-label={
                form.kind === "RECORD" ? "학습 내용" : "설명 / 완료 기준"
              }
              className={form.kind === "RECORD" ? "record-editor" : ""}
              rows={form.kind === "RECORD" ? 18 : 5}
              maxLength={500000}
              value={form.body || ""}
              onChange={(e) => set("body", e.target.value)}
            />
          </label>
        )}

      </form>
    </section>
  );
}

