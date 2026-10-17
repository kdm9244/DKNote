import { laptopStatus, requireLaptop, resolveLocalModel } from './laptopAi.js';
const authenticatedFetch = (url,options={}) => fetch(url,{...options,headers:{...options.headers,Authorization:`Bearer ${sessionStorage.getItem('accessToken') || ''}`}});
/**
 * 🌸 미카 AI 통합 챗봇 통신 서비스 (Gemini / Ollama 4대 정예 모델 스트리밍 & 상태 감지)
 */

import { memoryService } from './memory';
import { toolRegistry } from './toolRegistry';

export const ELITE_MODELS = [
  { id: 'qwen35-9b-uncensored:latest', name: 'Qwen 3.5 9B (Local AI)', provider: 'ollama', desc: '로컬 AI (기본)' },
  { id: 'qwen3:8b', name: 'Qwen 3 8B (Local AI)', provider: 'ollama', desc: '로컬 경량 모델' },
];

/**
 * 현재 로그인한 계정의 고유 ID(userId 또는 email) 추출 (미로그인 시 anonymous)
 */
export function getCurrentUserId() {
  try {
    const token = sessionStorage.getItem('accessToken');
    if (!token) return 'anonymous';
    const base64Url = token.split('.')[1];
    if (!base64Url) return 'anonymous';
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.sub || payload.email || 'anonymous';
  } catch {
    return 'anonymous';
  }
}

/**
 * <think>...</think> 내부 생각/추론 태그 제거 유틸리티
 */
export function cleanOutput(text) {
  if (!text) return '';
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (cleaned.includes('<think>')) {
    cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
  }
  return cleaned.trim();
}

/**
 * 대화 히스토리 로컬 스토리지 관리 (사용자 계정별 100% 완전 격리)
 */
export const chatHistoryStorage = {
  getStorageKey(userId) {
    const effectiveId = userId || getCurrentUserId();
    return `dknote_mika_chat_${effectiveId}`;
  },

  getHistory(userId) {
    try {
      const key = this.getStorageKey(userId);
      const data = localStorage.getItem(key);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error('대화 히스토리 로드 실패:', e);
      return [];
    }
  },

  saveHistory(messages, userId) {
    try {
      const key = this.getStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(messages));
    } catch (e) {
      console.error('대화 히스토리 저장 실패:', e);
    }
  },

  clearHistory(userId) {
    const key = this.getStorageKey(userId);
    localStorage.removeItem(key);
  },
};



export async function checkEngineStatus(modelId, signal) {
  const model = modelId || memoryService.getSettings().selectedModel;
  return laptopStatus(model, signal);
}

/**
 * Ollama 로컬 스트리밍 호출
 */
async function streamOllamaChat(messagesToSend, modelId, enableThinking, onChunk, abortSignal) {
  const lastUserMsg = [...messagesToSend].reverse().find((m) => m.role === 'user')?.content || '';
  const isFin = toolRegistry.isFinancialQuery(lastUserMsg);

  const response = await authenticatedFetch('/api/ai/ollama/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abortSignal,
    body: JSON.stringify({ model: modelId, messages: messagesToSend, think: enableThinking,
      keep_alive: '5m', options: { num_ctx: 8192, temperature: isFin ? 0.35 : 0.7, top_p: 0.9, repeat_penalty: 1.15 }, stream: true }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = await response.json();
      detail = errJson.error || '';
    } catch {
      detail = response.statusText;
    }
    throw new Error(`Ollama 서버 응답 오류 (${response.status}): ${detail || 'Ollama 실행 상태를 확인해주세요.'}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        if (buffer.trim()) {
          const last = JSON.parse(buffer);
          if (last.error) throw new Error(last.error);
          accumulated += last.message?.content || '';
          onChunk(cleanOutput(accumulated));
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const chunk = json.message?.content || '';
          if (chunk) {
            accumulated += chunk;
            onChunk(cleanOutput(accumulated));
          }
        } catch {
          // ignore
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return cleanOutput(accumulated);
}

/**
 * 통합 실시간 챗봇 스트리밍 호출 함수
 */
export async function sendChatMessageStream({
  messages,
  modelId,
  enableThinking,
  userNickname,
  onChunk,
  abortSignal,
}) {
  const settings = memoryService.getSettings();
  const activeModel = resolveLocalModel(modelId || settings.selectedModel);
  await requireLaptop(activeModel, abortSignal);
  const isThinkOn = enableThinking !== undefined ? enableThinking : (settings.enableThinking || false);

  // 1. 미카 기본 시스템 프롬프트 준비 (사용자 닉네임 기본 호칭 연동)
  let fullSystemPrompt = memoryService.getFormattedMemoriesForPrompt(userNickname);

  // 2. 가계부 거래/자산 관리는 assetSecretary가 전담하여 정확한 통화/계좌로 처리합니다.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  // 3. 실시간 팩트 데이터(Grounding Context) 자동 추출 & 주입
  if (lastUserMsg) {
    const groundingContext = await toolRegistry.resolveGroundingContext(lastUserMsg);
    if (groundingContext) {
      fullSystemPrompt += `\n\n[최우선 지침]: 아래에 제공된 [실시간 주가/자산 확인 정보]가 있다면 해당 가격/수치 정보를 최우선으로 정확하게 인용하여 답변하세요. 임의의 다른 가짜 가격이나 수치를 지어내서는 절대로 안 됩니다.\n\n${groundingContext}`;
    } else {
      fullSystemPrompt += `\n\n[주가/시세 관련 절대 주의 지침]: 실시간 주가 데이터가 [실시간 주가/자산 확인 정보]로 직접 주어지지 않았거나, 비상장 기업(예: 라이엇 게임즈 등)인 경우 절대로 가짜 티커(심볼)나 임의의 가짜 주가를 지어내지 마세요. 확인되지 않는 주가는 솔직하게 "비상장 회사이거나 현재 실시간 시세를 확인할 수 없어"라고 정직하게 답변해야 합니다.`;
    }
  }

  // 4. 반드시 시스템 메시지는 0번째 1개만 구성 (Qwen Jinja template: "System message must be at the beginning")
  const messagesToSend = [{ role: 'system', content: fullSystemPrompt }];

  // 5. 대화 기록 주입 (User / Assistant 역할만 순서대로 전달)
  const historySlice = messages.slice(-14);
  for (const item of historySlice) {
    if (item.role === 'user' || item.role === 'assistant') {
      messagesToSend.push({ role: item.role, content: item.content });
    }
  }

  return streamOllamaChat(messagesToSend, activeModel, isThinkOn, onChunk, abortSignal);
}
