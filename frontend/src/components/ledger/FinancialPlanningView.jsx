import InlineEditor from "../workspace/InlineEditor";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addGoalContribution,
  archiveFinancialGoal,
  createFinancialGoal,
  getFinancialPlanning,
  saveCategoryBudgets,
  saveMonthlyFinancialPlan,
  updateFinancialGoal,
} from '../../api/ledger';
import '../../styles/financial-planning.css';
import InvestmentPlanningPanel from './InvestmentPlanningPanel';

const money = (value) => new Intl.NumberFormat('ko-KR', {
  style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
}).format(Number(value || 0));

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const dateTimeLocal = () => {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
};

const emptyGoal = {
  title: '', description: '', goalType: 'WISH', targetAmount: '', initialAmount: 0,
  monthlyTargetAmount: '', targetDate: '', priority: 1, linkedAccountId: '', iconColor: 'GREEN',
};

const goalTypeLabel = {
  SAVINGS: '장기 저축', EMERGENCY: '비상금', WISH: '위시리스트', TRAVEL: '여행', OTHER: '기타',
};

const errorText = (error) => {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || error?.message || '요청을 처리하지 못했습니다.';
};

export default function FinancialPlanningView({ accounts = [], initialTab = 'monthly', onOpenInvestmentTrade }) {
  const [month, setMonth] = useState(currentMonth());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState({
    expectedIncome: 0, savingsTarget: 0, investmentTarget: 0, debtRepaymentTarget: 0, memo: '',
  });
  const [budgets, setBudgets] = useState([]);
  const [goalModal, setGoalModal] = useState(null);
  const [goalForm, setGoalForm] = useState(emptyGoal);
  const [contributionGoal, setContributionGoal] = useState(null);
  const [contribution, setContribution] = useState({ amount: '', sourceAccountId: '', contributedAt: dateTimeLocal(), memo: '' });

  const eligibleAccounts = useMemo(() => accounts.filter((account) => (
    account.isActive !== false && account.currency === 'KRW' && !['DEBT', 'FOREIGN_CURRENCY'].includes(account.accountType)
  )), [accounts]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getFinancialPlanning(month);
      setData(response);
      setPlan({
        expectedIncome: response.expectedIncome || 0,
        savingsTarget: response.savingsTarget || 0,
        investmentTarget: response.investmentTarget || 0,
        debtRepaymentTarget: response.debtRepaymentTarget || 0,
        memo: response.memo || '',
      });
      setBudgets((response.categoryBudgets || []).map((item) => ({ ...item })));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const saveMonthly = async () => {
    setSaving(true);
    setError('');
    try {
      await Promise.all([
        saveMonthlyFinancialPlan({ targetMonth: month, ...plan }),
        saveCategoryBudgets({
          targetMonth: month,
          budgets: budgets.filter((item) => item.categoryName.trim()).map((item) => ({
            categoryName: item.categoryName.trim(), budgetAmount: Number(item.budgetAmount || 0),
          })),
        }),
      ]);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const base = '새 카테고리';
    let name = base;
    let index = 2;
    while (budgets.some((item) => item.categoryName === name)) name = `${base} ${index++}`;
    setBudgets([...budgets, { categoryName: name, budgetAmount: 0, actualAmount: 0, remainingAmount: 0, usageRate: 0 }]);
  };

  const openGoal = (goal = null) => {
    setGoalModal(goal || 'new');
    setGoalForm(goal ? {
      title: goal.title, description: goal.description || '', goalType: goal.goalType,
      targetAmount: goal.targetAmount, initialAmount: 0, monthlyTargetAmount: goal.monthlyTargetAmount || '',
      targetDate: goal.targetDate || '', priority: goal.priority || 1,
      linkedAccountId: goal.linkedAccountId || '', iconColor: goal.iconColor || 'GREEN',
    } : { ...emptyGoal });
  };

  const saveGoal = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...goalForm,
        targetAmount: Number(goalForm.targetAmount),
        initialAmount: Number(goalForm.initialAmount || 0),
        monthlyTargetAmount: Number(goalForm.monthlyTargetAmount || 0),
        priority: Number(goalForm.priority || 1),
        targetDate: goalForm.targetDate || null,
        linkedAccountId: goalForm.linkedAccountId || null,
      };
      if (goalModal === 'new') await createFinancialGoal(payload);
      else await updateFinancialGoal(goalModal.goalId, payload);
      setGoalModal(null);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const removeGoal = async (goal) => {
    if (!window.confirm(`'${goal.title}' 목표를 보관 처리할까요? 적립 이력은 유지됩니다.`)) return;
    try {
      await archiveFinancialGoal(goal.goalId);
      await load();
    } catch (err) { setError(errorText(err)); }
  };

  const openContribution = (goal) => {
    setContributionGoal(goal);
    setContribution({ amount: goal.monthlyTargetAmount || '', sourceAccountId: '', contributedAt: dateTimeLocal(), memo: '' });
  };

  const saveContribution = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await addGoalContribution(contributionGoal.goalId, {
        amount: Number(contribution.amount),
        sourceAccountId: contribution.sourceAccountId || null,
        contributedAt: contribution.contributedAt,
        memo: contribution.memo,
      });
      setContributionGoal(null);
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally { setSaving(false); }
  };

  if (loading && !data) return <div className="planning-state-card">자금 계획을 불러오는 중입니다.</div>;

  const availableTone = Number(data?.availableAmount || 0) >= 0 ? 'positive' : 'negative';

  return (
    <section className="financial-planning-page">
      <header className="planning-page-header">
        <div>
          <span className="planning-eyebrow">FINANCIAL PLAN</span>
          <h1>자금 계획</h1>
          <p>이번 달에 쓸 돈과 모을 돈을 먼저 나누고, 원하는 목표까지 함께 관리합니다.</p>
        </div>
        <label className="planning-month-picker">
          <span>계획 월</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>

      {error && <div className="planning-error">{error}</div>}

      <div className="planning-summary-grid">
        <article className="planning-summary-card is-primary">
          <span>계획 후 사용 가능액</span>
          <strong className={availableTone}>{money(data?.availableAmount)}</strong>
          <small>하루 사용 가능 {money(data?.dailyAvailableAmount)}</small>
        </article>
        <article className="planning-summary-card">
          <span>예상 수입</span><strong>{money(data?.expectedIncome)}</strong>
          <small>실제 수입 {money(data?.actualIncome)}</small>
        </article>
        <article className="planning-summary-card">
          <span>생활비 예산</span><strong>{money(data?.categoryBudgetTotal)}</strong>
          <small>실제 지출 {money(data?.actualExpense)}</small>
        </article>
        <article className="planning-summary-card">
          <span>저축·투자·상환</span><strong>{money(Number(data?.savingsTarget || 0) + Number(data?.investmentTarget || 0) + Number(data?.debtRepaymentTarget || 0))}</strong>
          <small>고정지출 예정 {money(data?.fixedExpenseAmount)}</small>
        </article>
      </div>

      <div className="planning-tabs" role="tablist">
        <button className={activeTab === 'monthly' ? 'is-active' : ''} onClick={() => setActiveTab('monthly')}>월간 자금 계획</button>
        <button className={activeTab === 'goals' ? 'is-active' : ''} onClick={() => setActiveTab('goals')}>
          목표·위시리스트 <span>{data?.goals?.length || 0}</span>
        </button>
        <button className={activeTab === 'investment' ? 'is-active' : ''} onClick={() => setActiveTab('investment')}>투자 계획</button>
      </div>

      {goalModal && <InlineEditor title={goalModal === 'new' ? '새 목표 만들기' : '목표 수정'} busy={saving} onClose={()=>setGoalModal(null)}>
        <form className="planning-modal" onSubmit={saveGoal}>
            <div className="goal-form-grid">
            <label className="is-wide"><span>목표 이름 *</span><input required maxLength="100" value={goalForm.title} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} placeholder="예: 일본 여행 경비" /></label>
            <label><span>목표 유형</span><select value={goalForm.goalType} onChange={(event) => setGoalForm({ ...goalForm, goalType: event.target.value })}>{Object.entries(goalTypeLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label><span>목표 금액 *</span><input required type="number" min="1" value={goalForm.targetAmount} onChange={(event) => setGoalForm({ ...goalForm, targetAmount: event.target.value })} /></label>
            {goalModal === 'new' && <label><span>이미 모은 금액</span><input type="number" min="0" value={goalForm.initialAmount} onChange={(event) => setGoalForm({ ...goalForm, initialAmount: event.target.value })} /></label>}
            <label><span>월 적립 목표</span><input type="number" min="0" value={goalForm.monthlyTargetAmount} onChange={(event) => setGoalForm({ ...goalForm, monthlyTargetAmount: event.target.value })} /></label>
            <label><span>목표일</span><input type="date" value={goalForm.targetDate} onChange={(event) => setGoalForm({ ...goalForm, targetDate: event.target.value })} /></label>
            <label><span>연결 적립 계좌</span><select value={goalForm.linkedAccountId} onChange={(event) => setGoalForm({ ...goalForm, linkedAccountId: event.target.value })}><option value="">연결하지 않고 기록만</option>{eligibleAccounts.map((account) => <option value={account.accountId} key={account.accountId}>{account.accountName} · {money(account.cachedBookBalance)}</option>)}</select></label>
            <label><span>우선순위</span><select value={goalForm.priority} onChange={(event) => setGoalForm({ ...goalForm, priority: event.target.value })}><option value="1">1 · 가장 중요</option><option value="2">2 · 중요</option><option value="3">3 · 보통</option><option value="4">4 · 여유</option><option value="5">5 · 나중에</option></select></label>
            <label className="is-wide"><span>설명</span><textarea value={goalForm.description} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} placeholder="왜 모으는지, 어떤 조건으로 구매할지 기록하세요." /></label>
          </div>
          <div className="planning-modal-actions"><button type="button" onClick={() => setGoalModal(null)}>취소</button><button className="is-primary" disabled={saving}>{saving ? '저장 중' : '목표 저장'}</button></div>
        </form>
      </InlineEditor>}

      {contributionGoal && <InlineEditor title={`${contributionGoal.title} 적립`} busy={saving} onClose={()=>setContributionGoal(null)}>
        <form className="planning-modal is-small" onSubmit={saveContribution}>
            <div className="contribution-summary"><span>현재 달성률</span><strong>{contributionGoal.progressRate}%</strong><div><i style={{ width: `${contributionGoal.progressRate}%` }} /></div><small>{money(contributionGoal.currentAmount)} / {money(contributionGoal.targetAmount)}</small></div>
          <div className="goal-form-grid is-single">
            <label><span>적립 금액 *</span><input required type="number" min="1" value={contribution.amount} onChange={(event) => setContribution({ ...contribution, amount: event.target.value })} /></label>
            <label><span>출금 계좌</span><select disabled={!contributionGoal.linkedAccountId} value={contribution.sourceAccountId} onChange={(event) => setContribution({ ...contribution, sourceAccountId: event.target.value })}><option value="">계좌 변동 없이 적립 이력만 기록</option>{eligibleAccounts.filter((account) => account.accountId !== contributionGoal.linkedAccountId).map((account) => <option value={account.accountId} key={account.accountId}>{account.accountName} · {money(account.cachedBookBalance)}</option>)}</select><small>{contributionGoal.linkedAccountId ? '선택하면 연결 적립 계좌로 실제 이체 내역도 남습니다.' : '목표 수정에서 적립 계좌를 연결하면 실제 이체가 가능합니다.'}</small></label>
            <label><span>적립 일시</span><input type="datetime-local" value={contribution.contributedAt} onChange={(event) => setContribution({ ...contribution, contributedAt: event.target.value })} /></label>
            <label><span>메모</span><input value={contribution.memo} onChange={(event) => setContribution({ ...contribution, memo: event.target.value })} placeholder="예: 8월 급여 적립" /></label>
          </div>
          <div className="planning-modal-actions"><button type="button" onClick={() => setContributionGoal(null)}>취소</button><button className="is-primary" disabled={saving}>{saving ? '반영 중' : '적립 반영'}</button></div>
        </form>
      </InlineEditor>}
      {activeTab === 'monthly' && (
        <div className="planning-monthly-layout">
          <div className="planning-panel">
            <div className="planning-panel-title">
              <div><h2>한 달 자금 배분</h2><p>수입에서 생활비, 저축, 투자, 부채 상환 순서로 미리 나눕니다.</p></div>
              <button className="planning-primary-button" onClick={saveMonthly} disabled={saving}>{saving ? '저장 중' : '계획 저장'}</button>
            </div>
            <div className="planning-form-grid">
              {[
                ['expectedIncome', '예상 수입', '급여·부수입 등'],
                ['savingsTarget', '저축 목표', '적금·비상금'],
                ['investmentTarget', '투자 목표', '주식·ETF 매수 자금'],
                ['debtRepaymentTarget', '부채 상환 목표', '원금 상환 계획'],
              ].map(([key, label, hint]) => (
                <label key={key}><span>{label}<small>{hint}</small></span><div className="planning-money-input"><b>₩</b><input type="number" min="0" value={plan[key]} onChange={(event) => setPlan({ ...plan, [key]: Number(event.target.value) })} /></div></label>
              ))}
            </div>
            <label className="planning-memo-field"><span>이번 달 메모</span><textarea value={plan.memo} onChange={(event) => setPlan({ ...plan, memo: event.target.value })} placeholder="이번 달에 꼭 지키고 싶은 원칙이나 예정된 큰 지출을 기록하세요." /></label>
          </div>

          <div className="planning-panel category-panel">
            <div className="planning-panel-title">
              <div><h2>카테고리별 소비 예산</h2><p>가계부 거래의 메모 카테고리와 자동 비교됩니다.</p></div>
              <button className="planning-secondary-button" onClick={addCategory}>+ 항목 추가</button>
            </div>
            <div className="budget-table-head"><span>카테고리</span><span>예산</span><span>사용</span><span>남은 금액</span><span>소진율</span><span /></div>
            <div className="budget-table-body">
              {budgets.map((item, index) => {
                const usage = Number(item.budgetAmount || 0) > 0 ? Math.min(100, Number(item.actualAmount || 0) / Number(item.budgetAmount) * 100) : (Number(item.actualAmount || 0) > 0 ? 100 : 0);
                const remaining = Number(item.budgetAmount || 0) - Number(item.actualAmount || 0);
                return <div className="budget-table-row" key={`${item.categoryName}-${index}`}>
                  <input className="category-name-input" value={item.categoryName} onChange={(event) => setBudgets(budgets.map((row, rowIndex) => rowIndex === index ? { ...row, categoryName: event.target.value } : row))} />
                  <div className="inline-money-input">₩ <input type="number" min="0" value={item.budgetAmount} onChange={(event) => setBudgets(budgets.map((row, rowIndex) => rowIndex === index ? { ...row, budgetAmount: Number(event.target.value) } : row))} /></div>
                  <strong>{money(item.actualAmount)}</strong>
                  <strong className={remaining < 0 ? 'negative' : 'positive'}>{money(remaining)}</strong>
                  <div className="budget-usage"><span><i style={{ width: `${usage}%` }} /></span><b>{Math.round(usage)}%</b></div>
                  <button className="row-remove-button" onClick={() => setBudgets(budgets.filter((_, rowIndex) => rowIndex !== index))} aria-label="삭제">×</button>
                </div>;
              })}
            </div>
            <div className="budget-table-footer"><span>생활비 예산 합계</span><strong>{money(budgets.reduce((sum, item) => sum + Number(item.budgetAmount || 0), 0))}</strong></div>
          </div>
        </div>
      )}

      {activeTab === 'goals' && (
        <div className="planning-panel goals-panel">
          <div className="planning-panel-title">
            <div><h2>목표·위시리스트</h2><p>비상금부터 사고 싶은 물건까지 금액과 달성률을 기준으로 관리합니다.</p></div>
            <button className="planning-primary-button" onClick={() => openGoal()}>+ 새 목표</button>
          </div>
          <div className="goal-card-grid">
            {(data?.goals || []).map((goal) => (
              <article className={`goal-card tone-${(goal.iconColor || 'GREEN').toLowerCase()}`} key={goal.goalId}>
                <div className="goal-card-top"><span>{goalTypeLabel[goal.goalType] || goal.goalType}</span><div><button onClick={() => openGoal(goal)}>수정</button><button onClick={() => removeGoal(goal)}>보관</button></div></div>
                <h3>{goal.title}</h3>
                <p>{goal.description || '목표 설명이 없습니다.'}</p>
                <div className="goal-amount-line"><strong>{money(goal.currentAmount)}</strong><span>/ {money(goal.targetAmount)}</span></div>
                <div className="goal-progress"><i style={{ width: `${Math.min(100, Number(goal.progressRate || 0))}%` }} /></div>
                <div className="goal-meta"><span>{goal.progressRate || 0}% 달성</span><span>{goal.targetDate ? `${goal.targetDate}까지` : '기한 없음'}</span></div>
                <div className="goal-account-line"><span>{goal.linkedAccountName ? `연결 계좌 · ${goal.linkedAccountName}` : '기록형 목표'}</span><b>월 {money(goal.monthlyTargetAmount)}</b></div>
                <button className="goal-contribute-button" onClick={() => openContribution(goal)} disabled={goal.status === 'COMPLETED'}>{goal.status === 'COMPLETED' ? '목표 달성 완료' : '목표에 적립하기'}</button>
              </article>
            ))}
            {!data?.goals?.length && <div className="planning-empty-state"><span>◎</span><h3>아직 등록된 목표가 없습니다.</h3><p>비상금, 여행, 원하는 물건처럼 금액이 있는 목표를 만들어보세요.</p><button onClick={() => openGoal()}>첫 목표 만들기</button></div>}
          </div>
        </div>
      )}

      {activeTab === 'investment' && (
        <InvestmentPlanningPanel accounts={accounts} month={month} onOpenTrade={onOpenInvestmentTrade} />
      )}


    </section>
  );
}
