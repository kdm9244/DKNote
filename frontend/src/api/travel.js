const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
export async function travelRequest(path, method = 'GET', data) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken') || sessionStorage.getItem('token') || ''}`, ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
  });
  if (!response.ok) {
    let message; try { const error = await response.json(); message = error.message || error.detail; } catch { /* Use status fallback. */ }
    throw new Error(message || (response.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : `요청에 실패했습니다 (${response.status}). 입력 내용을 유지했습니다.`));
  }
  if (path.endsWith('/download')) return response.blob();
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
