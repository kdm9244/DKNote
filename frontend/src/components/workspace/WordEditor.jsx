import { useState } from "react";
import InlineEditor from "./InlineEditor";
import SaveStatus from "./SaveStatus";
import { useWorkspace } from "./workspaceContext";
import { messageOf } from "../../api/workspace";
export default function WordEditor({ item, onClose }) {
  const { save } = useWorkspace();
  const [form, setForm] = useState(item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const detail = (key, value) =>
    setForm((f) => ({ ...f, details: { ...f.details, [key]: value } }));
  return (
    <InlineEditor title="단어 편집" busy={busy} onClose={onClose}>
      <form
        className="ws-modal-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await save(form);
            onClose();
          } catch (error) {
            setError(messageOf(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <div className="ws-alert" role="alert">
            {error}
          </div>
        )}
        <label className="ws-field">
          단어
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="ws-field">
          읽는 법
          <input
            value={form.details.reading || ""}
            maxLength={200}
            onChange={(e) => detail("reading", e.target.value)}
          />
        </label>
        <label className="ws-field">
          뜻 / 예문
          <textarea
            aria-label="뜻 / 예문"
            rows={4}
            maxLength={10000}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <div className="ws-form-grid">
          <label className="ws-field">
            언어
            <select
              value={form.details.language || "other"}
              onChange={(e) => detail("language", e.target.value)}
            >
              <option value="ja">일본어</option>
              <option value="en">영어</option>
              <option value="ko">한국어</option>
              <option value="other">기타</option>
            </select>
          </label>
          <label className="ws-field">
            페이지
            <input
              type="number"
              min={1}
              max={100000}
              required
              value={form.details.page || 1}
              onChange={(e) => detail("page", Number(e.target.value))}
            />
          </label>
        </div>
        <footer className="ws-form-footer">
          <SaveStatus label="단어" phase={error?'error':busy?'saving':JSON.stringify(form)!==JSON.stringify(item)?'draft':'idle'} message={error?'저장 실패 · 입력 내용 유지':busy?'저장 중…':JSON.stringify(form)!==JSON.stringify(item)?'수정한 내용을 저장하세요.':'변경 내용 없음'} />
          <button type="button" className="ws-button" onClick={onClose}>
            닫기
          </button>
          <button className="ws-button primary" disabled={busy}>
            저장
          </button>
        </footer>
      </form>
    </InlineEditor>
  );
}
