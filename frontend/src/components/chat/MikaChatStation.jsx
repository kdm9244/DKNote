import React, { useState, useEffect, useRef } from 'react';
import MarkdownMessage from './MarkdownMessage';
import {
  ELITE_MODELS,
  chatHistoryStorage,
  checkEngineStatus,
  sendChatMessageStream,
} from '../../services/aiChatService';
import { resolveLocalModel } from '../../services/laptopAi';
import { memoryService } from '../../services/memory';
import { assetSecretary } from '../../services/assetSecretary';
import '../../styles/mika-chat-station.css';

// 최근 유지할 최대 대화 개수
const MAX_MESSAGES_LIMIT = 30;

function getCurrentTime() {
  const d = new Date();
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function MikaChatStation({
  user,
  collapsed = false,
  enabled = true,
  onExpand,
  onCollapse,
}) {
  const currentUid = user?.userId || user?.email;
  const [messages, setMessages] = useState(() => {
    const saved = chatHistoryStorage.getHistory(currentUid);
    return saved.slice(-MAX_MESSAGES_LIMIT);
  });
  const [input, setInput] = useState(() => localStorage.getItem(`mika_draft_${currentUid}`) || '');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => {
    const saved = memoryService.getSettings().selectedModel;
    if (!saved || saved.startsWith('gemini')) {
      return 'qwen35-9b-uncensored:latest';
    }
    return resolveLocalModel(saved);
  });
  const [enableThinking, setEnableThinking] = useState(() => memoryService.getSettings().enableThinking || false);
  const [engineStatus, setEngineStatus] = useState({ status: 'offline', label: '노트북 AI 연결 확인 중' });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showActionDrawer, setShowActionDrawer] = useState(false);
  const [showEngineModal, setShowEngineModal] = useState(false);

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const modalScrollRef = useRef(null);
  useEffect(() => { if (currentUid) localStorage.setItem(`mika_draft_${currentUid}`, input); }, [input, currentUid]);
  useEffect(() => () => abortControllerRef.current?.abort(), []);
  useEffect(() => { if (!enabled) abortControllerRef.current?.abort(); }, [enabled]);

  // 1. 계정 변경 시(로그아웃 또는 다른 계정 로그인) 해당 계정 대화 내역으로 즉시 재로딩
  useEffect(() => {
    const uid = user?.userId || user?.email;
    const saved = chatHistoryStorage.getHistory(uid);
    setMessages(saved.slice(-MAX_MESSAGES_LIMIT));
  }, [user?.userId, user?.email]);

  // 2. 엔진 연결 상태 주기적 감지
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const check = async () => {
      const res = await checkEngineStatus(selectedModel);
      if (active) { setEngineStatus(res); if (res.status !== 'online') abortControllerRef.current?.abort(); }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedModel, enabled]);

  // 3. 대화 기록 변경 시 현재 계정 ID로 자동 저장
  useEffect(() => {
    const uid = user?.userId || user?.email;
    chatHistoryStorage.saveHistory(messages, uid);
  }, [messages, user?.userId, user?.email]);

  // 3. 메시지 변경 또는 스트리밍 시 대화창 최하단으로 부드럽게 자동 스크롤
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isLoading]);

  // 4. 모델 변경 시 설정 저장
  const handleModelChange = (modelId) => {
    setSelectedModel(modelId);
    memoryService.saveSettings({ selectedModel: modelId });
  };

  // 5. Think 토글 시 설정 저장
  const handleToggleThinking = () => {
    const nextVal = !enableThinking;
    setEnableThinking(nextVal);
    memoryService.saveSettings({ enableThinking: nextVal });
  };

  // 6. 메시지 전송 로직
  const handleSendMessage = async (textToSend) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isLoading || !enabled || engineStatus.status !== 'online') return;
    onExpand?.();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);
    const connection = await checkEngineStatus(selectedModel, controller.signal);
    setEngineStatus(connection);
    if (controller.signal.aborted || connection.status !== 'online') { setIsLoading(false); abortControllerRef.current = null; return; }
    setInput('');
    setShowActionDrawer(false);

    const userMessage = {
      role: 'user',
      content: prompt,
      time: getCurrentTime(),
    };

    const appendedMessages = [...messages, userMessage];
    const trimmedUserList = appendedMessages.slice(-MAX_MESSAGES_LIMIT);
    setMessages(trimmedUserList);
    setIsLoading(true);
    setStreamingText('');

    // 🌟 1. 가계부/자산/주식 자연어 처리 전담 비서 우선 감지 및 실행
    try {
      const assetCheck = await assetSecretary.processNaturalLanguage(prompt);
      if (assetCheck.isAssetCommand && assetCheck.assistantResponse) {
        const updatedMessages = [
          ...trimmedUserList,
          {
            role: 'assistant',
            content: assetCheck.assistantResponse,
            time: getCurrentTime(),
          },
        ];
        setMessages(updatedMessages.slice(-MAX_MESSAGES_LIMIT));
        setIsLoading(false);
        abortControllerRef.current = null;
        inputRef.current?.focus();
        return;
      }
    } catch (assetErr) {
      console.warn('자산 비서 처리 중 예외 (LLM으로 폴백):', assetErr);
    }

    if (controller.signal.aborted) { setIsLoading(false); abortControllerRef.current = null; return; }

    try {
      let currentAccumulated = '';
      const finalReply = await sendChatMessageStream({
        messages: trimmedUserList,
        modelId: selectedModel,
        enableThinking,
        userNickname: user?.nickname?.trim(),
        onChunk: (chunk) => {
          currentAccumulated = chunk;
          setStreamingText(chunk);
        },
        abortSignal: controller.signal,
      });

      const replyToSave = finalReply || currentAccumulated || '응! 편하게 무엇이든 말해줘~ 🌸';
      const updatedMessages = [
        ...trimmedUserList,
        {
          role: 'assistant',
          content: replyToSave,
          time: getCurrentTime(),
        },
      ];
      setMessages(updatedMessages.slice(-MAX_MESSAGES_LIMIT));
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('미카 챗봇 에러:', err);
        const updatedMessages = [
          ...trimmedUserList,
          {
            role: 'assistant',
            content: `미카가 일시적인 문제를 겪고 있어요: ${err.message || '네트워크 상태를 확인해주세요.'} 🌸`,
            time: getCurrentTime(),
          },
        ];
        setMessages(updatedMessages.slice(-MAX_MESSAGES_LIMIT));
      }
    } finally {
      setIsLoading(false);
      setStreamingText('');
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  // 7. 대화 생성 중단
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (streamingText.trim()) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: streamingText.trim(), time: getCurrentTime() },
      ].slice(-MAX_MESSAGES_LIMIT));
    }
    setIsLoading(false);
    setStreamingText('');
  };

  // 8. 대화 초기화
  const handleClearHistory = () => {
    if (window.confirm('미카와의 이전 대화 기록을 모두 비울까요?')) {
      const uid = user?.userId || user?.email;
      chatHistoryStorage.clearHistory(uid);
      setMessages([]);
      setShowHistoryModal(false);
      setShowActionDrawer(false);
    }
  };

  const activeModelMeta = ELITE_MODELS.find((m) => m.id === selectedModel) || ELITE_MODELS[0];

  if (collapsed && engineStatus.status !== 'online') {
    return <section className="mika-offline-dock" hidden={!enabled} aria-label="노트북 AI 연결 상태">
      <div className="mika-offline-status"><span className="mika-status-dot" aria-hidden="true"/><div><strong>노트북 AI 대기 중</strong><p>Ollama가 연결되면 대화할 수 있어요.</p></div></div>
      <button type="button" onClick={onExpand}>대화 기록 보기 <span aria-hidden="true">→</span></button>
    </section>;
  }

  return (
    <section className={`mika-unified-station ${collapsed ? 'is-home-collapsed' : ''}`} hidden={!enabled}>
      {/* 🌟 1. 토스형 극미니멀 상단 앱 바 (화면을 가리지 않음) */}
      <header className="mika-station-topbar">
        <div className="mika-top-profile">
          <div className="mika-avatar-badge">
            <span className="mika-avatar-emoji">🌸</span>
            <span className={engineStatus.status === 'online' ? 'mika-beacon-dot is-online' : 'mika-beacon-dot'} />
          </div>
          <div className="mika-profile-info">
            <h2 className="mika-name">미카</h2>
            <span className="mika-sub-desc">{engineStatus.label}</span>
          </div>
        </div>

        <div className="mika-top-icons">
          {onCollapse && <button type="button" className="mika-quick-pill" onClick={onCollapse}>⌄ 대화 접기</button>}
          <button
            type="button"
            className="mika-top-icon-btn"
            onClick={handleClearHistory}
            title="대화 비우기 (새 대화)"
          >
            🧹
          </button>
        </div>
      </header>

      {engineStatus.status !== 'online' && <p role="status" className="mika-connection-notice">{engineStatus.label} 일반 기능은 계속 사용할 수 있습니다.</p>}
      {/* 🌟 2. 100% 꽉 찬 메신저 대화 스트림 영역 */}
      <div className="mika-dialogue-stream" ref={chatScrollRef}>
        {messages.length === 0 && !isLoading ? (
          <div className="mika-toss-welcome-box">
            <div className="mika-welcome-hero">
              <span className="welcome-avatar-big">🌸</span>
              <h3>{user?.nickname?.trim() ? `${user.nickname.trim()}, 반가워!` : '안녕, 반가워!'} 오늘 뭐 도와줄까?</h3>
              <p>식비 지출, 엔화 환율, 일본 여행 준비까지 다정하게 챙겨줄게!</p>
            </div>

            <div className="mika-welcome-chips">
              <button
                type="button"
                className="toss-chip-card"
                onClick={() => handleSendMessage('오늘 편의점에서 5000원 썻어')}
              >
                <span className="chip-ico">🍙</span>
                <div className="chip-txt">
                  <strong>편의점 지출 등록</strong>
                  <small>"오늘 편의점에서 5000원 썻어"</small>
                </div>
              </button>

              <button
                type="button"
                className="toss-chip-card"
                onClick={() => handleSendMessage('현재 엔화 환율과 1000엔 원화 가치 알려줘')}
              >
                <span className="chip-ico">💴</span>
                <div className="chip-txt">
                  <strong>실시간 엔화 환율</strong>
                  <small>"1000엔 원화로 얼마야?"</small>
                </div>
              </button>

              <button
                type="button"
                className="toss-chip-card"
                onClick={() => handleSendMessage('루닛 현재가 얼마야?')}
              >
                <span className="chip-ico">📈</span>
                <div className="chip-txt">
                  <strong>실시간 주식 시세</strong>
                  <small>"루닛 현재가 얼마야?"</small>
                </div>
              </button>

              <button
                type="button"
                className="toss-chip-card"
                onClick={() => handleSendMessage('현재 통장 잔액과 이번 달 가계부 지출 알려줘')}
              >
                <span className="chip-ico">💼</span>
                <div className="chip-txt">
                  <strong>가계부 잔액 점검</strong>
                  <small>"통장 잔액 얼마야?"</small>
                </div>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mika-toss-bubble-row ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}
            >
              {msg.role === 'assistant' && (
                <div className="bubble-avatar">🌸</div>
              )}

              <div className="bubble-content-wrap">
                <div className="bubble-body">
                  {msg.role === 'user' ? (
                    <p className="user-plain-text">{msg.content}</p>
                  ) : (
                    <MarkdownMessage content={msg.content} />
                  )}
                </div>
                <span className="bubble-time">{msg.time || getCurrentTime()}</span>
              </div>
            </div>
          ))
        )}

        {/* 실시간 답변 스트리밍 또는 생각 중 로더 */}
        {isLoading && (
          <div className="mika-toss-bubble-row is-assistant is-loading-row">
            <div className="bubble-avatar">🌸</div>
            <div className="bubble-content-wrap">
              <div className="bubble-body">
                {streamingText ? (
                  <MarkdownMessage content={streamingText} />
                ) : (
                  <div className="mika-toss-thinking-pulse">
                    <span className="pulse-dot" />
                    <span className="pulse-dot" />
                    <span className="pulse-dot" />
                    <span className="pulse-label">미카가 생각하는 중... 🌸</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 3. 하단 퀵 액션 버튼 바 & 입력 도크 (버튼들이 전처럼 하단으로 바로 내려옴) */}
      <footer className="mika-bottom-dock-wrapper">
        <div className="mika-quick-action-deck">
          {collapsed && <button type="button" className="mika-quick-pill" onClick={onExpand}>대화 열기 ↑</button>}
          <button
            type="button"
            className="mika-quick-pill"
            onClick={() => handleSendMessage('현재 통장에 있는 잔고 정리해서 보여줘')}
          >
            <span>💼</span>
            <span>통장 잔고 점검</span>
          </button>
          <button
            type="button"
            className="mika-quick-pill text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            onClick={() => handleSendMessage('방금 거 취소해줘')}
            title="마지막에 등록된 가계부 거래/이체를 취소합니다"
          >
            <span>↩️</span>
            <span>방금 거래 취소</span>
          </button>
          <button
            type="button"
            className="mika-quick-pill is-setting"
            onClick={() => setShowEngineModal(true)}
          >
            <span>⚙️</span>
            <span>{activeModelMeta.name.split(' ')[0]}</span>
          </button>
        </div>

        <div className="mika-bottom-input-dock">
          <form
            className="mika-dock-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="mika-dock-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={engineStatus.status !== 'online' ? engineStatus.label : isLoading ? '미카가 답변을 작성하고 있어요...' : '미카에게 편하게 말해보세요... 🌸'}
              disabled={isLoading || engineStatus.status !== 'online'}
            />

            {isLoading ? (
              <button type="button" className="mika-dock-send-btn is-stop" onClick={handleStop} title="답변 중단">
                <span className="stop-square" />
              </button>
            ) : (
              <button
                type="submit"
                className="mika-dock-send-btn"
                disabled={!input.trim() || engineStatus.status !== 'online'}
                title="메시지 전송"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </form>
        </div>
      </footer>

      {/* 🌟 4. 슬라이드업 퀵 액션 서랍 (Bottom Action Sheet) */}
      {showActionDrawer && (
        <div className="mika-drawer-backdrop" onClick={() => setShowActionDrawer(false)}>
          <div className="mika-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-notch" />
            <div className="drawer-header">
              <h4>빠른 실행 및 도구</h4>
              <button type="button" className="drawer-close-btn" onClick={() => setShowActionDrawer(false)}>✕</button>
            </div>

            <div className="drawer-grid">
              <button
                type="button"
                className="drawer-tile is-danger"
                onClick={() => {
                  setShowActionDrawer(false);
                  handleSendMessage('방금 거 취소해줘');
                }}
              >
                <span className="tile-icon">↩️</span>
                <span className="tile-title">방금 거래 취소</span>
              </button>

              <button
                type="button"
                className="drawer-tile"
                onClick={() => {
                  setShowActionDrawer(false);
                  handleSendMessage('현재 통장에 있는 잔고 정리해서 보여줘');
                }}
              >
                <span className="tile-icon">💼</span>
                <span className="tile-title">통장 잔고 점검</span>
              </button>

              <button
                type="button"
                className="drawer-tile is-setting"
                onClick={() => {
                  setShowActionDrawer(false);
                  setShowEngineModal(true);
                }}
              >
                <span className="tile-icon">⚙️</span>
                <span className="tile-title">AI 엔진 설정</span>
              </button>

              <button
                type="button"
                className="drawer-tile"
                onClick={() => {
                  setShowActionDrawer(false);
                  handleClearHistory();
                }}
              >
                <span className="tile-icon">🧹</span>
                <span className="tile-title">대화 새로 시작</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 5. AI 엔진 설정 모달 */}
      {showEngineModal && (
        <div className="mika-modal-backdrop" onClick={() => setShowEngineModal(false)}>
          <div className="mika-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>⚙️ AI 두뇌 엔진 설정</h3>
              <button type="button" onClick={() => setShowEngineModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="setting-label">사용할 AI 모델</label>
              <div className="model-radio-list">
                {ELITE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`model-option-btn ${selectedModel === m.id ? 'is-selected' : ''}`}
                    onClick={() => handleModelChange(m.id)}
                  >
                    <strong>{m.name}</strong>
                    <small>{m.desc}</small>
                  </button>
                ))}
              </div>

              <div className="setting-row">
                <div>
                  <strong>Deep Think 추론 모드</strong>
                  <p>더 깊은 생각과 정밀한 분석을 거쳐 답변합니다.</p>
                </div>
                <button
                  type="button"
                  className={`toggle-pill-btn ${enableThinking ? 'is-active' : ''}`}
                  onClick={handleToggleThinking}
                >
                  {enableThinking ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 6. 📜 이전 대화 전체 기록 모달 */}
      {showHistoryModal && (
        <div className="mika-modal-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="mika-modal-card is-history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-left">
                <span>📜</span>
                <h3>미카와의 대화 기록</h3>
                <small>({messages.length}개)</small>
              </div>
              <button type="button" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            <div className="modal-history-scroll" ref={modalScrollRef}>
              {messages.length === 0 ? (
                <div className="empty-history">아직 대화 기록이 없습니다 🌸</div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`history-row ${m.role === 'user' ? 'is-user' : 'is-ai'}`}>
                    <span className="history-author">{m.role === 'user' ? '나' : '🌸 미카'}</span>
                    <div className="history-bubble">{m.content}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
