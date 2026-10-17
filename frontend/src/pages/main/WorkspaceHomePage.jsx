import '../../styles/home-hub.css';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import WorkspaceShell from "../../components/workspace/WorkspaceShell";
import { useWorkspace } from "../../components/workspace/workspaceContext";
import { dateKey, progress } from "../../components/workspace/learningHelpers";
import MikaChatStation from "../../components/chat/MikaChatStation";
import api from "../../api/client";
import { googleApi, messageOf } from "../../api/workspace";
import { getAccounts, getLedgerDashboard } from "../../api/ledger";
import {
  summarizeAssets,
  assetMoney,
  convertAssetsToKrw,
} from "../../services/assetSummary";
import { useAssetRates } from "../../services/useAssetRates";

const CARDS = {
  calendar: {
    title: "캘린더",
    description: "일상과 공부 시간을 한눈에",
    path: "/calendar",
    color: "blue",
  },
  learning: {
    title: "학습",
    description: "작은 할 일에서 큰 목표까지",
    path: "/learning",
    color: "purple",
  },
  ledger: {
    title: "가계부",
    description: "내 자산과 이번 달의 흐름",
    path: "/ledger",
    color: "green",
  },
  travel: {
    title: "여행",
    description: "다음 여행을 준비하는 공간",
    path: "/planner",
    color: "orange",
  },
};
function HomeIcon({ kind }) {
  const paths = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
    learning: <><path d="M12 5v16M3 4h4a6 6 0 0 1 5 2 6 6 0 0 1 5-2h4v15h-4a6 6 0 0 0-5 2 6 6 0 0 0-5-2H3Z"/></>,
    ledger: <><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8m-8 5h3m-3 4h8m-2-4h2"/></>,
    travel: <><rect x="4" y="7" width="16" height="14" rx="3"/><path d="M9 7V4h6v3M8 7v14m8-14v14"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export default function WorkspaceHomePage() {
  const { user, entries, settings, preferences } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const [ledger, setLedger] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [assetState, setAssetState] = useState("loading");
  const [calendarState, setCalendarState] = useState("loading");
  const [trips, setTrips] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [notice, setNotice] = useState("");
  const [toggling, setToggling] = useState(false);
  const today = dateKey();
  useEffect(() => {
    let active = true;
    Promise.all([getLedgerDashboard(), getAccounts()])
      .then(([data, summary]) => {
        if (active) {
          setLedger(data);
          setAccounts(summary.accounts || []);
          setAssetState("ready");
        }
      })
      .catch(() => {
        if (active) setAssetState("error");
      });
    api.get("/api/travel/trips").then(r => { if (active) setTrips(r.data); }).catch(() => {});
    googleApi
      .status()
      .then(async (status) => {
        if (!status.tokenAvailable || status.calendarReady === false) {
          if (active) setCalendarState("permission");
          return;
        }
        const calendars = await googleApi.calendars();
        const results = await Promise.allSettled(
          calendars
            .filter((c) => !settings.hiddenCalendarIds.includes(c.id))
            .map((c) => googleApi.events(c.id, today, today)),
        );
        if (active) {
          setGoogleEvents(
            results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
          );
          setCalendarState(
            results.some((r) => r.status === "rejected") ? "error" : "ready",
          );
        }
      })
      .catch(() => {
        if (active) setCalendarState("error");
      });
    return () => {
      active = false;
    };
  }, [today, settings.hiddenCalendarIds]);
  const events = entries.filter(
    (e) =>
      e.kind === "EVENT" &&
      !e.details.googleEventId &&
      e.startDate <= today &&
      e.endDate >= today,
  );
  const schedules = entries.filter(
    (e) => e.kind === "SCHEDULE" && e.startDate === today,
  );
  const tasks = entries.filter((e) => e.kind === "TASK" && !e.completed);
  const roadmaps = entries.filter((e) => e.kind === "ROADMAP");
  const nextTrip = trips
    .filter((t) => !t.endDate || t.endDate >= today)
    .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""))[0];
  const toggleAi = async () => {
    setToggling(true);
    try {
      await preferences({ aiEnabled: !settings.aiEnabled });
      setNotice("");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setToggling(false);
    }
  };
  const assets = summarizeAssets(accounts, ledger?.investment);
  const { rates, loading: loadingRates } = useAssetRates(assets.currencies);
  const converted = convertAssetsToKrw(assets, rates);
  const summaries = {
    calendar: (
      <>
        <strong>
          {calendarState === "loading"
            ? "일정 불러오는 중…"
            : `${events.length + schedules.length + googleEvents.length}개의 오늘 일정`}
        </strong>
        <span>
          {events[0]?.title ||
            googleEvents[0]?.summary ||
            schedules[0]?.title ||
            (calendarState === "permission"
              ? "Google 로그인으로 캘린더 권한을 연결하세요."
              : calendarState === "error"
                ? "Google 연결 상태를 확인해주세요."
                : "새 일정을 계획해보세요.")}
        </span>
      </>
    ),
    learning: (
      <>
        <strong>
          {roadmaps.length}개 목표 · {tasks.length}개 남은 할 일
        </strong>
        <span>{tasks[0]?.title || "첫 학습 목표를 만들어보세요."}</span>
        {roadmaps[0] && (
          <div className="ws-progress">
            <i
              style={{ width: `${progress(entries, roadmaps[0].id).percent}%` }}
            />
          </div>
        )}
      </>
    ),
    ledger: (
      <>
        <strong>
          {assetState === "ready"
            ? converted.complete
              ? `총자산 ${assetMoney(converted.amount)}`
              : loadingRates
                ? "환율 조회 중…"
                : "통화별 자산 · 환율 조회 필요"
            : assetState === "error"
              ? "자산 조회 실패"
              : "자산 불러오는 중…"}
        </strong>
        {assetState === "ready" && assets.rows.some(row => row.currency !== "KRW" || !converted.complete) && (
          <span className="home-native-currencies" title={assets.rows.filter(row => row.currency !== "KRW" || !converted.complete).map(row => `${row.currency} ${assetMoney(row.amount, row.currency)}`).join(" · ")}>
            {assets.rows.filter(row => row.currency !== "KRW" || !converted.complete).map(row => `${row.currency} ${assetMoney(row.amount, row.currency)}`).join(" · ")}
          </span>
        )}
        <span className="home-monthly-flow">
          {assetState === "ready"
            ? `이번 달 원화 수지 ${assetMoney(ledger?.monthlyNetCashFlow?.KRW || 0)}`
            : assetState === "error"
              ? "가계부에서 연결 상태를 확인하세요."
              : "계좌 잔액과 투자 평가액을 합산합니다."}
        </span>
      </>
    ),
    travel: (
      <>
        <strong>{nextTrip?.title || "다음 여행은 어디로?"}</strong>
        <span>
          {nextTrip
            ? `${nextTrip.startDate || "날짜 미정"} — ${nextTrip.endDate || ""}`
            : "여행 계획을 시작해보세요."}
        </span>
      </>
    ),
  };
  return (
    <WorkspaceShell
      active="home"
      title={`${user?.nickname || "나"}의 하루`}
      subtitle={new Intl.DateTimeFormat("ko-KR", { dateStyle: "full" }).format(
        new Date(),
      )}
      actions={
        <>
          <Link className="ws-button" to="/settings">
            ⚙ 설정
          </Link>
          <button className="ws-button" disabled={toggling} onClick={toggleAi}>
            {settings.aiEnabled ? "AI 끄기" : "AI 켜기"}
          </button>
        </>
      }
    >
      {notice && (
        <div className="ws-alert" role="alert">
          {notice}
        </div>
      )}
      <section
        className={`home-card-space ${expanded && settings.aiEnabled ? "is-chat-open" : ""}`}
        aria-hidden={expanded && settings.aiEnabled}
      >
        <div className="home-intro home-hub-intro">
          <div><h2>내 작업 공간</h2><p>오늘의 현황을 확인하고 필요한 공간으로 이동하세요.</p></div>
          <Link className="home-customize" to="/settings">카드 설정 <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="home-feature-grid">
          {settings.cards.map((key) => {
            const card = CARDS[key];
            if (!card) return null;
            return (
              <Link
                className={`home-feature-card is-${card.color}`}
                key={key}
                to={card.path}
              >
                <div className="home-card-heading">
                  <span className="home-card-icon"><HomeIcon kind={key} /></span>
                  <div><h3>{card.title}</h3><p>{card.description}</p></div>
                  <span className="home-card-arrow" aria-hidden="true">↗</span>
                </div>
                <div className="home-card-summary">{summaries[key]}</div>
                <footer>
                  {card.title} 열기 <span>→</span>
                </footer>
              </Link>
            );
          })}
        </div>
        {!settings.cards.length && (
          <div className="ws-empty">
            표시할 홈 카드를 <Link to="/settings">설정</Link>에서 선택하세요.
          </div>
        )}
      </section>
      {user && (
        <div
          className={`home-chat-dock ${expanded ? "is-expanded" : ""}`}
          hidden={!settings.aiEnabled}
        >
          <MikaChatStation
            user={user}
            enabled={settings.aiEnabled}
            collapsed={!expanded}
            onExpand={() => setExpanded(true)}
            onCollapse={() => setExpanded(false)}
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
