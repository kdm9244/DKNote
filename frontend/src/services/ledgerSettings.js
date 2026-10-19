/**
 * ⚙️ 가계부 전역 설정 관리 서비스 (localStorage 기반 영구 저장)
 */

const SETTINGS_KEY = 'dknote_ledger_settings';

export const DEFAULT_LEDGER_SETTINGS = {
  // 1. 통화별 기본 출금/결제 계좌 ID
  defaultAccounts: {
    KRW: '', // 원화 기본 통장
    JPY: '', // 엔화 기본 통장 (현금 또는 트래블 하나 등)
    USD: '', // 달러 기본 통장
  },

  // 2. 가계부 대표 메인 계좌 ID (대시보드 우선 표시)
  primaryAccountId: '',

  planningCurrency: 'KRW', // 자금 계획 기본 통화

  // 3. 빠른 거래 등록 기본 탭 ('EXPENSE' | 'INCOME' | 'MATCH')
  defaultTxMode: 'EXPENSE',

  // 4. 미카 AI 자산비서 동작 설정
  autoRecordEnabled: true, // 즉시 자동 등록 여부
  showCancelGuide: true,   // 등록 후 "방금 거 취소" 가이드 표시 여부

  // 5. 보안 및 디스플레이
  currencyMasking: false,  // 잔액 숨김/마스킹 모드 (***,***)

  // 6. 월간 결산 기준일 (1 ~ 28)
  monthStartDay: 1,
};

/**
 * 저장된 가계부 설정을 조회합니다.
 */
export function getLedgerSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_LEDGER_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_LEDGER_SETTINGS,
      ...parsed,
      planningCurrency: ['KRW', 'JPY', 'USD'].includes(parsed.planningCurrency) ? parsed.planningCurrency : 'KRW',
      defaultAccounts: {
        ...DEFAULT_LEDGER_SETTINGS.defaultAccounts,
        ...(parsed.defaultAccounts || {}),
      },
    };
  } catch (err) {
    console.warn('Failed to load ledger settings, returning defaults', err);
    return { ...DEFAULT_LEDGER_SETTINGS };
  }
}

/**
 * 가계부 설정을 저장하고 변경 이벤트를 발생시킵니다.
 */
export function saveLedgerSettings(settings) {
  try {
    const current = getLedgerSettings();
    const updated = {
      ...current,
      ...settings,
      defaultAccounts: {
        ...current.defaultAccounts,
        ...(settings.defaultAccounts || {}),
      },
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('ledger-settings-changed', { detail: updated }));
    return updated;
  } catch (err) {
    console.error('Failed to save ledger settings', err);
    return null;
  }
}

/**
 * 설정을 기본값으로 초기화합니다.
 */
export function resetLedgerSettings() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
    window.dispatchEvent(new CustomEvent('ledger-settings-changed', { detail: DEFAULT_LEDGER_SETTINGS }));
    return { ...DEFAULT_LEDGER_SETTINGS };
  } catch (err) {
    console.error('Failed to reset ledger settings', err);
    return { ...DEFAULT_LEDGER_SETTINGS };
  }
}

/**
 * 설정 변경 이벤트를 구독합니다.
 */
export function subscribeLedgerSettings(callback) {
  const handler = (e) => callback(e.detail);
  window.addEventListener('ledger-settings-changed', handler);
  return () => window.removeEventListener('ledger-settings-changed', handler);
}
