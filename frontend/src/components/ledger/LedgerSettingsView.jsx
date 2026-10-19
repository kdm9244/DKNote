import TaxResidenceSettings from './investment/TaxResidenceSettings';
import React, { useState, useEffect, useMemo } from 'react';
import {
  getLedgerSettings,
  saveLedgerSettings,
  resetLedgerSettings,
} from '../../services/ledgerSettings';

export default function LedgerSettingsView({ accounts = [], onBackToDashboard }) {
  const [settings, setSettings] = useState(() => getLedgerSettings());
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setSettings(getLedgerSettings());
  }, []);

  const krwAccounts = useMemo(() => accounts.filter((a) => a.currency === 'KRW'), [accounts]);
  const jpyAccounts = useMemo(() => accounts.filter((a) => a.currency === 'JPY'), [accounts]);
  const usdAccounts = useMemo(() => accounts.filter((a) => a.currency === 'USD'), [accounts]);

  const handleSave = () => {
    saveLedgerSettings(settings);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('설정을 기본값으로 초기화하시겠습니까?')) {
      const reset = resetLedgerSettings();
      setSettings(reset);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    }
  };

  const updateDefaultAccount = (currency, accountId) => {
    setSettings((prev) => ({
      ...prev,
      defaultAccounts: {
        ...prev.defaultAccounts,
        [currency]: accountId,
      },
    }));
  };

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-[#008080]' : 'bg-stone-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <TaxResidenceSettings />
      {/* 헤더 */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-xl font-bold text-stone-900">가계부 설정</h1>
          <p className="text-xs text-stone-500 mt-0.5">기본 통장 및 거래 환경을 관리합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          {onBackToDashboard && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              대시보드
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#008080] hover:bg-[#006666] rounded-lg transition-colors shadow-xs"
          >
            저장
          </button>
        </div>
      </div>

      {/* 저장 알림 토스트 */}
      {savedToast && (
        <div className="py-2.5 px-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>✓</span>
            <span>설정이 저장되었습니다.</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-normal">즉시 반영 완료</span>
        </div>
      )}

      <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-2">
        <label className="text-sm font-semibold flex flex-wrap items-center justify-between gap-3">자금 계획 기본 통화
          <select aria-label="자금 계획 기본 통화" value={settings.planningCurrency} onChange={e=>setSettings(p=>({...p,planningCurrency:e.target.value}))} className="border border-stone-300 rounded-lg px-3 py-2 bg-white">
            <option value="KRW">원화 · KRW</option><option value="JPY">엔화 · JPY</option><option value="USD">달러 · USD</option>
          </select>
        </label>
        <p className="text-xs text-stone-500">월간 계획과 소비 예산은 통화별로 따로 보관합니다. 통화를 바꿔도 기존 금액을 환산하거나 변경하지 않습니다.</p>
      </section>

      {/* 1. 기본 통장 설정 */}
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 shadow-xs overflow-hidden">
        <div className="px-5 py-3 bg-stone-50/80 border-b border-stone-100">
          <h2 className="text-xs font-bold text-stone-600 uppercase tracking-wider">기본 통장 설정</h2>
        </div>

        {/* 원화 (KRW) */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">원화 (KRW) 기본 통장</span>
          <select
            value={settings.defaultAccounts?.KRW || ''}
            onChange={(e) => updateDefaultAccount('KRW', e.target.value)}
            className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white min-w-[220px] focus:outline-none focus:border-[#527a8c]"
          >
            <option value="">자동 선택 (대표 입출금)</option>
            {krwAccounts.map((acc) => (
              <option key={acc.accountId} value={acc.accountId}>
                {acc.accountName}
              </option>
            ))}
          </select>
        </div>

        {/* 엔화 (JPY) */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">엔화 (JPY) 기본 통장</span>
          <select
            value={settings.defaultAccounts?.JPY || ''}
            onChange={(e) => updateDefaultAccount('JPY', e.target.value)}
            className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white min-w-[220px] focus:outline-none focus:border-[#527a8c]"
          >
            <option value="">자동 선택 (현금 우선)</option>
            {jpyAccounts.map((acc) => (
              <option key={acc.accountId} value={acc.accountId}>
                {acc.accountName}
              </option>
            ))}
          </select>
        </div>

        {/* 달러 (USD) */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">달러 (USD) 기본 통장</span>
          <select
            value={settings.defaultAccounts?.USD || ''}
            onChange={(e) => updateDefaultAccount('USD', e.target.value)}
            className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white min-w-[220px] focus:outline-none focus:border-[#527a8c]"
          >
            <option value="">자동 선택 (대표 입출금)</option>
            {usdAccounts.map((acc) => (
              <option key={acc.accountId} value={acc.accountId}>
                {acc.accountName}
              </option>
            ))}
          </select>
        </div>

        {/* 대표 주거래 계좌 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">대표 주거래 계좌</span>
          <select
            value={settings.primaryAccountId || ''}
            onChange={(e) => setSettings((p) => ({ ...p, primaryAccountId: e.target.value }))}
            className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white min-w-[220px] focus:outline-none focus:border-[#527a8c]"
          >
            <option value="">기본 첫 번째 계좌</option>
            {accounts.map((acc) => (
              <option key={acc.accountId} value={acc.accountId}>
                [{acc.currency}] {acc.accountName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. 거래 및 결산 옵션 */}
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 shadow-xs overflow-hidden">
        <div className="px-5 py-3 bg-stone-50/80 border-b border-stone-100">
          <h2 className="text-xs font-bold text-stone-600 uppercase tracking-wider">거래 및 결산</h2>
        </div>

        {/* 거래 입력 기본 모드 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">수기 등록 기본 탭</span>
          <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
            {[
              { id: 'EXPENSE', label: '지출' },
              { id: 'INCOME', label: '수입' },
              { id: 'MATCH', label: '잔액 맞춤' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSettings((p) => ({ ...p, defaultTxMode: id }))}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                  settings.defaultTxMode === id
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 월간 결산 시작일 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">월간 결산 기준일</span>
          <select
            value={settings.monthStartDay || 1}
            onChange={(e) => setSettings((p) => ({ ...p, monthStartDay: Number(e.target.value) }))}
            className="text-xs border border-stone-300 rounded-lg px-3 py-1.5 bg-white min-w-[220px] focus:outline-none focus:border-[#527a8c]"
          >
            <option value="1">매월 1일</option>
            <option value="5">매월 5일</option>
            <option value="10">매월 10일</option>
            <option value="15">매월 15일</option>
            <option value="20">매월 20일</option>
            <option value="25">매월 25일</option>
          </select>
        </div>
      </div>

      {/* 3. AI 비서 및 프라이버시 */}
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100 shadow-xs overflow-hidden">
        <div className="px-5 py-3 bg-stone-50/80 border-b border-stone-100">
          <h2 className="text-xs font-bold text-stone-600 uppercase tracking-wider">AI 비서 및 프라이버시</h2>
        </div>

        {/* 자연어 거래 즉시 자동 등록 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">자연어 거래 즉시 자동 등록</span>
          <ToggleSwitch
            checked={settings.autoRecordEnabled}
            onChange={(val) => setSettings((p) => ({ ...p, autoRecordEnabled: val }))}
          />
        </div>

        {/* 취소 가이드 문구 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">등록 완료 시 취소 가이드 표시</span>
          <ToggleSwitch
            checked={settings.showCancelGuide}
            onChange={(val) => setSettings((p) => ({ ...p, showCancelGuide: val }))}
          />
        </div>

        {/* 금액 숨김 모드 */}
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-stone-800">금액 숨김 모드 (마스킹)</span>
          <ToggleSwitch
            checked={settings.currencyMasking}
            onChange={(val) => setSettings((p) => ({ ...p, currencyMasking: val }))}
          />
        </div>
      </div>
    </div>
  );
}
