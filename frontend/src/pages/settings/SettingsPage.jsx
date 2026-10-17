import { resolveLocalModel } from '../../services/laptopAi';
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import WorkspaceShell from "../../components/workspace/WorkspaceShell";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import { googleApi, messageOf } from "../../api/workspace";
import { startGoogleLogin } from "../../api/client";
import {
  memoryService,
  DEFAULT_MIKA_SYSTEM_PROMPT,
} from "../../services/memory";
import { chatHistoryStorage, ELITE_MODELS } from "../../services/aiChatService";

const LABELS = {
  calendar: "캘린더",
  learning: "학습",
  ledger: "가계부",
  travel: "여행",
};
export default function SettingsPage() {
  const { settings, preferences, user } = useWorkspace();
  const [form, setForm] = useState(settings);
  const [profile, setProfile] = useState(() => memoryService.getProfile());
  const [model, setModel] = useState(
    () => resolveLocalModel(memoryService.getSettings().selectedModel),
  );
  const [thinking, setThinking] = useState(
    () => memoryService.getSettings().enableThinking,
  );
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [memories, setMemories] = useState(() => memoryService.getMemories());
  const [newMemory, setNewMemory] = useState("");
  const [params] = useSearchParams();
  useEffect(() => {
    setForm(settings);
    if (settings.mikaProfile) setProfile(settings.mikaProfile);
    if (settings.mikaMemories) setMemories(settings.mikaMemories);
    if (settings.mikaSettings) {
      setModel(
        resolveLocalModel(settings.mikaSettings.selectedModel || memoryService.getSettings().selectedModel),
      );
      setThinking(Boolean(settings.mikaSettings.enableThinking));
    }
  }, [settings]);
  useEffect(() => {
    googleApi
      .status()
      .then(setStatus)
      .catch((e) => setNotice(messageOf(e)));
  }, []);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const mikaSettings = { selectedModel: model, enableThinking: thinking };
      await preferences({
        ...form,
        mikaProfile: profile,
        mikaSettings,
        mikaMemories: memories,
      });
      memoryService.saveProfile(profile);
      memoryService.saveSettings(mikaSettings);
      memoryService.saveMemories(memories);
      setNotice("설정을 저장했습니다.");
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSaving(false);
    }
  };
  const connect = async () => {
    if (user?.provider === "GOOGLE") {
      startGoogleLogin();
      return;
    }
    setSaving(true);
    try {
      const data = await googleApi.connect();
      window.location.assign(data.url);
    } catch (e) {
      setNotice(messageOf(e));
      setSaving(false);
    }
  };
  const disconnect = async () => {
    if (
      !window.confirm(
        "DKNote의 Google 연결 정보를 지울까요? Google 일정은 삭제되지 않습니다.",
      )
    )
      return;
    try {
      await googleApi.disconnect();
      setStatus({ tokenAvailable: false });
      setNotice("연결 정보를 삭제했습니다.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  };
  const move = (key, direction) => {
    const next = [...form.cards];
    const i = next.indexOf(key);
    const j = i + direction;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    set("cards", next);
  };
  const callbackMessages = {
    connected: "Google 캘린더를 연결했습니다.",
    cancelled: "Google 연결을 취소했습니다.",
    permission: "캘린더 조회·수정 권한에 동의해야 연결할 수 있습니다.",
    failed:
      "Google 연결에 실패했습니다. 콘솔의 콜백 주소와 API 활성화를 확인하세요.",
  };
  return (
    <WorkspaceShell
      active="settings"
      title="설정"
      subtitle="나에게 맞는 홈 화면과 작업 환경을 만들어보세요."
      actions={
        <Link className="ws-button" to="/mypage">
          계정 관리 ↗
        </Link>
      }
    >
      {(notice || callbackMessages[params.get("google")]) && (
        <div role="status" className="ws-alert">
          {notice || callbackMessages[params.get("google")]}
        </div>
      )}
      <form onSubmit={save} className="settings-grid">
        <section className="ws-panel">
          <div className="ws-section-title">
            <span>01</span>
            <h2>홈 화면</h2>
          </div>
          <p className="ws-muted">표시할 카드를 선택하고 순서를 바꿔보세요.</p>
          {Object.entries(LABELS).map(([key, label]) => (
            <label className="settings-row" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={form.cards.includes(key)}
                onChange={(e) =>
                  set(
                    "cards",
                    e.target.checked
                      ? [...form.cards, key]
                      : form.cards.filter((c) => c !== key),
                  )
                }
              />
            </label>
          ))}
          <div className="settings-card-order">
            {form.cards.map((key, i) => (
              <div key={key}>
                <span>
                  {i + 1}. {LABELS[key]}
                </span>
                <button
                  type="button"
                  disabled={!i}
                  onClick={() => move(key, -1)}
                  aria-label={`${LABELS[key]} 위로`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === form.cards.length - 1}
                  onClick={() => move(key, 1)}
                  aria-label={`${LABELS[key]} 아래로`}
                >
                  ↓
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="ws-panel">
          <div className="ws-section-title">
            <span>02</span>
            <h2>화면과 캘린더</h2>
          </div>
          <label className="ws-field">
            화면 테마
            <select
              value={form.theme}
              onChange={(e) => set("theme", e.target.value)}
            >
              <option value="sky">맑은 하늘</option>
              <option value="cream">따뜻한 크림</option>
            </select>
          </label>
          <label className="ws-field">
            기본 달력 보기
            <select
              value={form.calendarView}
              onChange={(e) => set("calendarView", e.target.value)}
            >
              <option value="month">월간</option>
              <option value="week">주간</option>
              <option value="day">일간</option>
            </select>
          </label>
          <label className="ws-field">
            주 시작 요일
            <select
              value={form.weekStart}
              onChange={(e) => set("weekStart", Number(e.target.value))}
            >
              <option value={0}>일요일</option>
              <option value={1}>월요일</option>
            </select>
          </label>
        </section>
        <section className="ws-panel">
          <div className="ws-section-title">
            <span>03</span>
            <h2>미카 AI</h2>
          </div>
          <label className="settings-row">
            <span>노트북 연결 시 AI 채팅 사용</span>
            <input
              type="checkbox"
              checked={form.aiEnabled}
              onChange={(e) => set("aiEnabled", e.target.checked)}
            />
          </label>
          <label className="ws-field">
            사용 모델
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {ELITE_MODELS.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>추론 기능 사용</span>
            <input
              type="checkbox"
              checked={Boolean(thinking)}
              onChange={(e) => setThinking(e.target.checked)}
            />
          </label>
          <label className="ws-field">
            캐릭터 이름
            <input
              maxLength={50}
              value={profile.characterName}
              onChange={(e) =>
                setProfile({ ...profile, characterName: e.target.value })
              }
            />
          </label>
          <label className="ws-field">
            나를 부르는 이름
            <input
              maxLength={50}
              value={profile.userName}
              onChange={(e) =>
                setProfile({ ...profile, userName: e.target.value })
              }
            />
          </label>
          <label className="ws-field">
            성격과 응답 지침
            <textarea
              rows={7}
              maxLength={15000}
              value={profile.systemPrompt}
              onChange={(e) =>
                setProfile({ ...profile, systemPrompt: e.target.value })
              }
            />
          </label>
          <div className="ws-form-grid">
            <label className="ws-field">
              직업 / 공부 분야
              <input
                maxLength={200}
                value={profile.userJob || ""}
                onChange={(e) =>
                  setProfile({ ...profile, userJob: e.target.value })
                }
              />
            </label>
            <label className="ws-field">
              관심사
              <input
                maxLength={500}
                value={profile.userLikes || ""}
                onChange={(e) =>
                  setProfile({ ...profile, userLikes: e.target.value })
                }
              />
            </label>
          </div>
          <h3>미카가 기억할 내용</h3>
          <p className="ws-muted">
            취향이나 목표처럼 다음 대화에서도 참고할 내용을 저장하세요.
          </p>
          {memories.map((m) => (
            <div className="ws-list-row" key={m.id}>
              <span>{m.text}</span>
              <button
                type="button"
                className="ws-button danger"
                onClick={() =>
                  setMemories(memories.filter((v) => v.id !== m.id))
                }
              >
                삭제
              </button>
            </div>
          ))}
          <label className="ws-field">
            새 기억
            <input
              maxLength={2000}
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="ws-button"
            disabled={!newMemory.trim()}
            onClick={() => {
              setMemories([
                ...memories,
                {
                  id: crypto.randomUUID(),
                  text: newMemory.trim(),
                  category: "memo",
                  createdAt: Date.now(),
                },
              ]);
              setNewMemory("");
            }}
          >
            기억 추가
          </button>
          <div className="ws-actions">
            <button
              type="button"
              className="ws-button"
              onClick={() =>
                setProfile({
                  ...profile,
                  systemPrompt: DEFAULT_MIKA_SYSTEM_PROMPT,
                })
              }
            >
              기본 지침
            </button>
            <button
              type="button"
              className="ws-button danger"
              onClick={() => {
                if (window.confirm("이 브라우저에 저장된 대화를 비울까요?")) {
                  chatHistoryStorage.clearHistory(user?.userId);
                  localStorage.removeItem(`mika_draft_${user?.userId}`);
                  setNotice("대화 기록을 비웠습니다.");
                }
              }}
            >
              대화 초기화
            </button>
          </div>
        </section>
        <section className="ws-panel">
          <div className="ws-section-title">
            <span>04</span>
            <h2>Google 캘린더 연결</h2>
          </div>
          <p className="ws-muted">
            Google 로그인 시 캘린더 조회·수정 권한도 함께 요청합니다. 이전
            로그인은 다시 로그인해 권한을 갱신하세요.
          </p>
          <div className="ws-connection">
            <span
              className={
                status?.calendarReady
                  ? "ws-status-dot connected"
                  : "ws-status-dot"
              }
            />
            {status?.calendarReady
              ? "Google 로그인과 캘린더가 연결되어 있습니다."
              : status?.tokenAvailable
                ? "프로필 로그인만 연결됨 · 캘린더 권한 동의가 필요합니다."
                : "Google 캘린더가 연결되지 않았습니다."}
          </div>
          <div className="ws-actions">
            <button
              type="button"
              className="ws-button primary"
              disabled={saving}
              onClick={connect}
            >
              {user?.provider === "GOOGLE"
                ? "Google로 다시 로그인"
                : status?.tokenAvailable
                  ? "권한 갱신 / 다시 연결"
                  : "Google 캘린더 연결"}
            </button>
            {status?.tokenAvailable && (
              <button type="button" className="ws-button" onClick={disconnect}>
                연결 해제
              </button>
            )}
          </div>
          <p className="ws-muted">
            Google Cloud에서 Google Calendar API가 활성화되어 있어야 합니다.
            Google 로그인 계정은 기존 로그인 콜백 주소를 그대로 사용합니다.
          </p>
          {user?.provider !== "GOOGLE" && (
            <p className="ws-muted">
              이메일 계정의 별도 연결에는 승인된 리디렉션 URI에 서버 주소 +
              /api/calendar/google/callback을 등록하세요.
            </p>
          )}
        </section>
        <footer className="settings-save">
          <span className="ws-muted">
            설정은 계정별로 저장됩니다. 대화 기록과 초안은 이 브라우저에
            보관됩니다.
          </span>
          <button className="ws-button primary" disabled={saving}>
            {saving ? "저장 중…" : "설정 저장"}
          </button>
        </footer>
      </form>
    </WorkspaceShell>
  );
}
