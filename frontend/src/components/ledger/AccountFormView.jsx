import {BrokerageTaxFields} from './investment/BrokerageTaxSettings';
import React, { useState, useEffect } from 'react';
import { createAccount, updateAccount, deactivateAccount, activateAccount, deleteAccountPermanently } from '../../api/ledger';

const CATEGORY_HIERARCHY = {
  CHECKING: {
    label: '입출금',
    subCategories: [
      { value: 'CASH', label: '현금 / 지갑' },
      { value: 'TRANSIT_CARD', label: '교통카드 / 선불' },
      { value: 'GENERAL_CHECKING', label: '일반 입출금' },
      { value: 'SALARY_CHECKING', label: '급여' },
      { value: 'LIVING_CHECKING', label: '생활비' },
      { value: 'EMERGENCY_CHECKING', label: '비상금' },
      { value: 'ALLOWANCE_CHECKING', label: '용돈' },
    ],
  },
  SAVINGS: {
    label: '저축',
    subCategories: [
      { value: 'INSTALLMENT_SAVINGS', label: '적금' },
      { value: 'TIME_DEPOSIT', label: '정기예금' },
      { value: 'FREE_SAVINGS', label: '자유저축' },
    ],
  },
  INVESTMENT: {
    label: '투자',
    subCategories: [
      { value: 'STOCK_BROKERAGE', label: '증권' },
      { value: 'CMA', label: 'CMA' },
      { value: 'NISA', label: 'NISA' },
      { value: 'PENSION', label: '연금' },
      { value: 'OTHER_INVESTMENT', label: '기타 투자' },
    ],
  },
  FOREIGN_CURRENCY: {
    label: '외화',
    subCategories: [
      { value: 'FOREIGN_SAVINGS', label: '외화예금' },
      { value: 'FOREIGN_LIVING', label: '해외생활비' },
    ],
  },
  DEBT: {
    label: '부채',
    subCategories: [
      { value: 'LOAN', label: '대출' },
      { value: 'CREDIT_LINE', label: '마이너스통장' },
    ],
  },
};

const CURRENCIES = [
  { value: 'JPY', label: '¥ 엔화 (JPY)', icon: '💴' },
  { value: 'USD', label: '$ 달러 (USD)', icon: '💵' },
  { value: 'KRW', label: '₩ 원화 (KRW)', icon: '₩' },
];

export default function AccountFormView({ initialData = null, onSuccess, onCancel }) {
  const isEditMode = !!initialData;

  const [majorCategory, setMajorCategory] = useState(initialData?.accountType || 'CHECKING');
  const [subCategory, setSubCategory] = useState(
    initialData?.accountPurpose || CATEGORY_HIERARCHY['CHECKING'].subCategories[0].value,
  );
  const [currency, setCurrency] = useState(initialData?.currency || 'KRW');
  const [accountName, setAccountName] = useState(initialData?.accountName || '');
  const [brokerageCountry,setBrokerageCountry]=useState(initialData?.brokerageCountry||'');
  const [brokerageTaxType,setBrokerageTaxType]=useState(initialData?.brokerageTaxType||'GENERAL');
  const [bankName, setBankName] = useState(initialData?.bankName || '');
  const [accountNumberMasked, setAccountNumberMasked] = useState(initialData?.accountNumberMasked || '');
  const [initialBalance, setInitialBalance] = useState(
    initialData ? String(initialData.initialBalance || 0) : '0',
  );
  const [initialExchangeRate, setInitialExchangeRate] = useState(
    initialData?.initialExchangeRate ? String(initialData.initialExchangeRate) : '',
  );

  // 저축 계좌 전용 필드
  const [interestRate, setInterestRate] = useState(initialData?.interestRate !== null && initialData?.interestRate !== undefined ? String(initialData.interestRate) : '');
  const [maturityDate, setMaturityDate] = useState(initialData?.maturityDate || '');
  const [interestType, setInterestType] = useState(initialData?.interestType || 'SIMPLE');
  const [monthlyPayment, setMonthlyPayment] = useState(initialData?.monthlyPayment !== null && initialData?.monthlyPayment !== undefined ? String(initialData.monthlyPayment) : '');
  const [targetBalance, setTargetBalance] = useState(initialData?.targetBalance !== null && initialData?.targetBalance !== undefined ? String(initialData.targetBalance) : '');

  // initialData 변경 시 폼 필드 100% 동기화
  useEffect(() => {
    if (initialData) {
      const type = initialData.accountType || 'CHECKING';
      const subList = CATEGORY_HIERARCHY[type]?.subCategories || [];
      const defaultSub = subList[0]?.value || '';

      setMajorCategory(type);
      setSubCategory(initialData.accountPurpose || defaultSub);
      setCurrency(initialData.currency || 'KRW');
      setAccountName(initialData.accountName || '');
      setBankName(initialData.bankName || '');
      setBrokerageCountry(initialData.brokerageCountry||'');setBrokerageTaxType(initialData.brokerageTaxType||'GENERAL');
      setAccountNumberMasked(initialData.accountNumberMasked || '');
      setInitialBalance(String(initialData.initialBalance ?? 0));
      setInitialExchangeRate(initialData.initialExchangeRate ? String(initialData.initialExchangeRate) : '');

      setInterestRate(initialData.interestRate !== null && initialData.interestRate !== undefined ? String(initialData.interestRate) : '');
      setMaturityDate(initialData.maturityDate || '');
      setInterestType(initialData.interestType || 'SIMPLE');
      setMonthlyPayment(initialData.monthlyPayment !== null && initialData.monthlyPayment !== undefined ? String(initialData.monthlyPayment) : '');
      setTargetBalance(initialData.targetBalance !== null && initialData.targetBalance !== undefined ? String(initialData.targetBalance) : '');
    }
  }, [initialData]);

  const isSavingsAccount = majorCategory === 'SAVINGS';
  const isDebtAccount = majorCategory === 'DEBT';
  const isForeignAccount = majorCategory === 'FOREIGN_CURRENCY';

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // When Major Category changes, auto-select the first Sub-Category
  const handleMajorCategoryChange = (key) => {
    setMajorCategory(key);
    const subList = CATEGORY_HIERARCHY[key].subCategories;
    if (subList && subList.length > 0) {
      setSubCategory(subList[0].value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!accountName.trim()) {
      setErrorMsg('계좌명을 입력해 주세요.');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        ...(majorCategory==='INVESTMENT'?{brokerageCountry,brokerageTaxType}:{}),
        accountName: accountName.trim(),
        bankName: bankName.trim() || null,
        accountType: majorCategory,
        accountPurpose: subCategory,
        currency,
        initialBalance: Number(initialBalance || 0),
        initialExchangeRate: isForeignAccount && currency !== 'KRW' && initialExchangeRate ? Number(initialExchangeRate) : null,
        accountNumberMasked: accountNumberMasked.trim() || null,
        displayOrder: initialData?.displayOrder || 1,
        targetBalance: targetBalance ? Number(targetBalance) : null,
        // 저축·부채 계좌 금리 및 납입/상환 설정
        ...((isSavingsAccount || isDebtAccount) && {
          interestRate: interestRate ? Number(interestRate) : null,
          maturityDate: maturityDate || null,
          interestType: interestType || 'SIMPLE',
          monthlyPayment: monthlyPayment ? Number(monthlyPayment) : null,
        }),
      };

      let result = null;
      if (isEditMode) {
        result = await updateAccount(initialData.accountId, payload);
      } else {
        result = await createAccount(payload);
      }

      onSuccess(result);
    } catch (err) {
      console.error(err);
      const serverMsg = err.response?.data?.message || err.message;
      if (err.response?.status === 401) {
        setErrorMsg('로그인 세션이 만료되었습니다. 다시 로그인 후 시도해 주세요.');
      } else {
        setErrorMsg(serverMsg || (isEditMode ? '계좌 수정 실패' : '계좌 등록 실패'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!initialData?.accountId) return;
    const currentIsActive = initialData.isActive !== false;
    const actionName = currentIsActive ? '비활성화' : '다시 활성화';
    if (!window.confirm(`정말로 이 계좌를 ${actionName}하시겠습니까?\n${currentIsActive ? '비활성화 시 일반 계좌 목록에서 숨겨집니다.' : '다시 목록에 표시됩니다.'}`)) {
      return;
    }
    try {
      setLoading(true);
      if (currentIsActive) {
        await deactivateAccount(initialData.accountId);
      } else {
        await activateAccount(initialData.accountId);
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || `계좌 ${actionName} 처리 실패`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePermanently = async () => {
    if (!initialData?.accountId) return;
    if (!window.confirm(`⚠️ 경고: "${initialData.accountName}" 계좌를 완전히 삭제하시겠습니까?\n계좌 및 관련된 모든 거래 내역과 대조 이력이 영구 삭제되며 복구할 수 없습니다.`)) {
      return;
    }
    try {
      setLoading(true);
      await deleteAccountPermanently(initialData.accountId);
      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.message || '계좌 영구 삭제 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ledger-right-view animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b-2 border-[#bd674f]/30">
        <div className="flex items-center gap-2">
          <span className="text-xl">{isEditMode ? '✏️' : '➕'}</span>
          <h2 className="font-serif font-bold text-xl text-[#2c2217]">
            {isEditMode ? '계좌 정보 수정' : '신규 통장 / 계좌 등록'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-bold text-[#7a6e60] bg-[#f4ebe0] hover:bg-[#e8dbca] px-3 py-1.5 rounded-lg border border-[#a08c6e]/30 transition-all"
        >
          취소 / 대시보드로
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold text-center">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Step 1: 계좌 대분류 선택 */}
        <div>
          <label className="block text-xs font-bold text-[#4a3c2c] mb-1.5">
            1. 계좌 대분류 선택 <span className="text-red-500">*</span>
          </label>
          <div className="ledger-account-category-grid grid grid-cols-5 gap-2">
            {Object.entries(CATEGORY_HIERARCHY).map(([key, item]) => {
              const isSelected = majorCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleMajorCategoryChange(key)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-[#bd674f] text-white border-[#bd674f] shadow-sm scale-105'
                      : 'bg-white text-[#7a6e60] border-[#a08c6e]/30 hover:bg-[#fdf9f2]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: 계좌 중분류 선택 */}
        {majorCategory==='INVESTMENT'?<section className="investment-card"><h3>증권계좌 과세 설정</h3><BrokerageTaxFields country={brokerageCountry} type={brokerageTaxType} disabled={loading} onChange={(c,t)=>{if(!isEditMode&&c!==brokerageCountry)setCurrency(c==='JP'?'JPY':'KRW');setBrokerageCountry(c);setBrokerageTaxType(t);setSubCategory(t==='NISA'?'NISA':'STOCK_BROKERAGE');}}/><p className="text-xs mt-2">세법상 거주지는 가계부 설정에서 적용 시작일과 함께 설정합니다.</p></section>:<>
        <div>
          <label className="block text-xs font-bold text-[#4a3c2c] mb-1.5">
            2. {CATEGORY_HIERARCHY[majorCategory].label} 세부 중분류 선택 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_HIERARCHY[majorCategory].subCategories.map((sub) => {
              const isSelected = subCategory === sub.value;
              return (
                <button
                  key={sub.value}
                  type="button"
                  onClick={() => setSubCategory(sub.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    isSelected
                      ? 'bg-[#8c7849] text-white border-[#8c7849] shadow-xs'
                      : 'bg-[#fffefb] text-[#4a3c2c] border-[#a08c6e]/30 hover:bg-[#f7f4ea]'
                  }`}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        </div>

        </>}
        {/* Step 3: initial balance currency */}
        <div>
          <label className="block text-xs font-bold text-[#4a3c2c] mb-1.5">
            3. {isForeignAccount ? '초기 잔액 통화' : '기준 통화 선택'} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            {CURRENCIES.map((curr) => {
              const isSelected = currency === curr.value;
              return (
                <button
                  key={curr.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setCurrency(curr.value)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-[#43697a] text-white border-[#43697a] shadow-sm'
                      : 'bg-white text-[#7a6e60] border-[#a08c6e]/30 hover:bg-[#eaf1f4]'
                  }`}
                >
                  <span>{curr.icon}</span>
                  <span>{curr.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-stone-600">이 통장의 잔액과 입출금은 {currency} 기준으로 기록합니다. 계좌 유형을 바꿔도 선택한 통화를 유지합니다.</p>
        </div>

        {/* Step 4: 상세 입력 (계좌명, 은행, 계좌번호, 초기잔액) */}
        <div className="bg-white/80 border border-[#a08c6e]/30 rounded-xl p-4 space-y-3 shadow-xs">
          <div>
            <label className="block text-xs font-bold text-[#4a3c2c] mb-1">
              계좌명 (통장 이름) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="예: 신한 급여 주통장, 카카오 생활비통장"
              required
              className="w-full px-3 py-2 text-sm bg-[#fffefb] border border-[#a08c6e]/40 rounded-lg focus:outline-none focus:border-[#bd674f]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4a3c2c] mb-1">금융기관 / 은행명 <span className="text-stone-400 font-normal">(선택)</span></label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="예: 신한은행, 토스뱅크"
                className="w-full px-3 py-2 text-sm bg-[#fffefb] border border-[#a08c6e]/40 rounded-lg focus:outline-none focus:border-[#bd674f]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4a3c2c] mb-1">마스킹 계좌번호 <span className="text-stone-400 font-normal">(선택)</span></label>
              <input
                type="text"
                value={accountNumberMasked}
                onChange={(e) => setAccountNumberMasked(e.target.value)}
                placeholder="예: 110-***-5678"
                className="w-full px-3 py-2 text-sm bg-[#fffefb] border border-[#a08c6e]/40 rounded-lg focus:outline-none focus:border-[#bd674f]"
              />
            </div>
          </div>

          {!isEditMode && (
            <div>
              <label className="block text-xs font-bold text-[#4a3c2c] mb-1">{isDebtAccount ? `현재 남은 부채 (${currency})` : `초기 잔액 (${currency})`}</label>
              <input
                type="number"
                min={isDebtAccount ? '0' : undefined}
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm bg-[#fffefb] border border-[#a08c6e]/40 rounded-lg focus:outline-none focus:border-[#bd674f]"
              />
            </div>
          )}

          {isForeignAccount && currency !== 'KRW' && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
              <label className="block text-xs font-bold text-sky-950 mb-1">
                초기 외화 취득환율 (원 / 1 {currency})
              </label>
              <input
                type="number"
                min="0"
                step="0.0001"
                value={initialExchangeRate}
                onChange={(e) => setInitialExchangeRate(e.target.value)}
                placeholder={currency === 'JPY' ? '예: 9.2500' : '예: 1380.0000'}
                required={Number(initialBalance || 0) > 0}
                className="w-full px-3 py-2 text-sm bg-white border border-sky-300 rounded-lg focus:outline-none focus:border-sky-600"
              />
              <p className="mt-1.5 text-[11px] text-sky-800">
                초기 잔액의 환차익 원가를 계산할 때 사용합니다. 일본 엔은 1엔 기준으로 입력합니다.
              </p>
            </div>
          )}
        </div>

        {/* 저축·부채 계좌 전용 입력 섹션 */}
        {(isSavingsAccount || isDebtAccount) && (
          <div className={`bg-gradient-to-br from-emerald-50/80 to-teal-50/60 border border-emerald-200/60 rounded-2xl p-4 space-y-3 ${isDebtAccount ? 'ledger-debt-settings' : ''}`}>
            <div className="flex items-center gap-2 mb-1 pb-2 border-b border-emerald-200/50">
              <span className="text-base">{isDebtAccount ? '🧾' : '💰'}</span>
              <h4 className="font-bold text-sm text-emerald-900">{isDebtAccount ? '대출·부채 상환 설정' : '저축·예금 전용 설정'}</h4>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">{isDebtAccount ? 'DEBT' : 'SAVINGS'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">연 금리 (%) <span className="text-emerald-600">예: 3.5</span></label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="3.50"
                    className="w-full px-3 py-2 pr-8 text-sm bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500 font-bold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-bold">%</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">만기일</label>
                <input
                  type="date"
                  value={maturityDate}
                  onChange={(e) => setMaturityDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {!isDebtAccount && <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">이자 유형</label>
                <div className="flex gap-2">
                  {[{ v: 'SIMPLE', l: '단리' }, { v: 'COMPOUND', l: '복리' }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setInterestType(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        interestType === v
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                      }`}>{l}</button>
                  ))}
                </div>
              </div>}
              <div className={isDebtAccount ? 'col-span-2' : ''}>
                <label className="block text-xs font-bold text-emerald-900 mb-1">{isDebtAccount ? '월 상환 계획' : '월 납입액 (적금 전용)'}</label>
                <input
                  type="number"
                  value={monthlyPayment}
                  onChange={(e) => setMonthlyPayment(e.target.value)}
                  placeholder="예: 300000"
                  className="w-full px-3 py-2 text-sm bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {!isDebtAccount && <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">목표 저축 금액</label>
              <input
                type="number"
                value={targetBalance}
                onChange={(e) => setTargetBalance(e.target.value)}
                placeholder="예: 10000000 (1,000만원)"
                className="w-full px-3 py-2 text-sm bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-500"
              />
            </div>}

            <p className="text-[11px] text-emerald-700 bg-emerald-100/70 p-2 rounded-lg">
              {isDebtAccount
                ? '남은 부채는 화면에서 양수로 표시되지만 내부에서는 자산과 구분하기 위해 음수 잔액으로 관리합니다.'
                : '💡 금리를 입력하면 저축 계좌 상세 페이지에서 예상 만기 수령액 및 월별 이자를 자동 계산해 보여드립니다.'}
            </p>
          </div>
        )}

        {/* 계좌 수정 시 비활성화 / 삭제 영구 관리 카드 */}
        {isEditMode && (
          <div className="bg-rose-50/60 border border-rose-200/70 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 border-b border-rose-200/60 pb-2">
              <span className="text-base">⚠️</span>
              <h4 className="font-bold text-xs text-rose-900">계좌 상태 및 삭제 관리</h4>
            </div>

            {/* 비활성화 토글 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-stone-800">
                  계좌 비활성화 {initialData?.isActive === false ? '(현재 비활성화됨)' : '(목록에서 숨기기)'}
                </div>
                <div className="text-[11px] text-stone-500 mt-0.5">
                  {initialData?.isActive === false
                    ? '계좌가 비활성화 상태입니다. 다시 활성화하면 목록에 나타납니다.'
                    : '더 이상 사용하지 않는 계좌를 목록에서 숨깁니다. 거래 내역은 안전하게 보존됩니다.'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={loading}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all whitespace-nowrap ${
                  initialData?.isActive === false
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                }`}
              >
                {initialData?.isActive === false ? '🔓 다시 활성화' : '🔒 계좌 비활성화'}
              </button>
            </div>

            {/* 영구 삭제 */}
            <div className="flex items-center justify-between gap-4 border-t border-rose-200/50 pt-3">
              <div>
                <div className="text-xs font-bold text-rose-900">계좌 영구 삭제</div>
                <div className="text-[11px] text-rose-700/80 mt-0.5">
                  계좌 및 연관된 모든 거래 내역이 완전히 삭제됩니다. (복구 불가)
                </div>
              </div>
              <button
                type="button"
                onClick={handleDeletePermanently}
                disabled={loading}
                className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border border-rose-600 rounded-xl transition-all whitespace-nowrap shadow-xs"
              >
                🗑️ 계좌 영구 삭제
              </button>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-[#f4ebe0] hover:bg-[#e8dbca] text-[#7a6e60] text-xs font-bold rounded-xl transition-all"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[#bd674f] hover:bg-[#99503d] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            {loading ? '저장 중...' : isEditMode ? '💾 계좌 정보 저장' : '✨ 신규 계좌 등록 완료'}
          </button>
        </div>

      </form>
    </div>
  );
}
