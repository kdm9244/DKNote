export const DEFAULT_LOCAL_MODEL = 'qwen35-9b-uncensored:latest';
export const LAPTOP_OFFLINE = '노트북 AI가 연결되지 않았습니다. 노트북에서 Ollama를 실행해 주세요.';

export function resolveLocalModel(model) {
  return !model || model.startsWith('gemini') ? DEFAULT_LOCAL_MODEL : model;
}

export async function laptopStatus(model, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 4000);
  try {
    const response = await fetch('/api/ai/ollama/status', {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken') || ''}` },
    });
    if (!response.ok) throw new Error('status');
    const data = await response.json();
    const selected = resolveLocalModel(model);
    const installed = data.models?.some(item => (item.name || item.model) === selected || (item.name || item.model) === `${selected}:latest`);
    const available = data.available === true && installed === true;
    return { hasGeminiKey: false, hasOllama: data.available === true, status: available ? 'online' : 'offline',
      label: available ? '노트북 AI 연결됨' : data.available ? '선택한 모델을 노트북에 설치해 주세요.' : LAPTOP_OFFLINE };
  } catch {
    return { hasGeminiKey: false, hasOllama: false, status: 'offline', label: LAPTOP_OFFLINE };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function requireLaptop(model, signal) {
  const status = await laptopStatus(model, signal);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (status.status !== 'online') throw new Error(status.label);
  return status;
}
