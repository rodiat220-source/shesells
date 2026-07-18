"use client";

import { use, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Heart, Home, MessageCircle, RotateCcw, Sparkles, Trophy, XCircle } from "lucide-react";
import { CriticalTimeline } from "@/components/CriticalTimeline";
import { MiniRadar } from "@/components/MiniRadar";
import { ReplayInline } from "@/components/ReplayInline";
import { useSessionStore } from "@/src/store/sessionStore";
import { profileToPersonaPreview } from "@/src/lib/persona";
import { useSessionPersona } from "@/src/lib/useSessionPersona";
import type { Dimensions } from "@/src/types";

const dimensionLabels: Array<[keyof Dimensions, string]> = [
  ["listening", "倾听力"],
  ["warmth", "温度感"],
  ["professionalism", "专业度"],
  ["objectionHandling", "异议处理"],
  ["recommendation", "推荐力"],
];

// 结局配置：颜色 + 图标 + 标签
const outcomeConfig = {
  deal: { label: "成交", icon: CheckCircle2, tone: "deal" },
  churn: { label: "流失离店", icon: XCircle, tone: "churn" },
  follow_up: { label: "待跟进", icon: Heart, tone: "follow_up" },
} as const;

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, messages, loadSession } = useSessionStore();
  const personaOverride = useSessionPersona(id);
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  function navigate(path: string) {
    if (isPending) return; // 防抖
    setPendingTarget(path);
    startTransition(() => {
      router.push(path);
    });
  }

  useEffect(() => {
    if (!session || session.sessionId !== id) void loadSession(id);
  }, [id, loadSession, session]);

  const summary = useMemo(() => messages.find((message) => message.coachType === "summary"), [messages]);
  const replay = useMemo(() => messages.find((message) => message.coachType === "champion_replay"), [messages]);

  const dimensions: Dimensions = summary?.metadata?.dimensions ?? session?.dimensions ?? { listening: 0, warmth: 0, professionalism: 0, objectionHandling: 0, recommendation: 0 };
  const moments = summary?.metadata?.criticalMoments ?? [];
  const turns = replay?.metadata?.replayTurns ?? [];
  const overall = Math.round(Object.values(dimensions).reduce((sum, score) => sum + score, 0) / 5);
  const customerProfile = session?.customerProfile;
  const persona = useMemo(() => {
    if (personaOverride) return personaOverride;
    if (customerProfile) return profileToPersonaPreview(customerProfile);
    return null;
  }, [customerProfile, personaOverride]);
  const scenarioTitle = persona?.displayLine || "本次训练画像";

  // 结局卡数据
  const outcome = summary?.metadata?.outcome ?? "follow_up";
  const outcomeTitle = summary?.metadata?.outcomeTitle ?? "";
  const finalState = summary?.metadata?.finalState;
  const highlightSteps = summary?.metadata?.highlightSteps ?? [];
  const nextSuggestion = summary?.metadata?.nextSuggestion ?? "";
  const OutcomeIcon = outcomeConfig[outcome]?.icon ?? Heart;

  return (
    <main className="review-shell">
      <header className="review-header">
        <Link className="home-link" href="/" aria-label="返回首页"><Home size={16} /><span>首页</span></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>训练复盘</strong><span>{scenarioTitle}</span></div>
      </header>

      {/* 结局卡：置顶，三种结局共用同一套样式，只改标签颜色和文案 */}
      <section className={`outcome-card outcome-${outcome}`}>
        <div className="outcome-badge">
          <OutcomeIcon size={18} />
          <span>{outcomeConfig[outcome]?.label}</span>
        </div>
        <h1 className="outcome-title">{outcomeTitle || "本次训练已结束"}</h1>
        {finalState && (
          <div className="outcome-state">
            <span>购买意愿 <strong>{finalState.intent}</strong></span>
            <span>信任 <strong>{finalState.trust}</strong></span>
          </div>
        )}
        {highlightSteps.length > 0 && (
          <div className="outcome-highlights">
            <span className="outcome-section-label">做对的关键 {highlightSteps.length} 步</span>
            <ul>
              {highlightSteps.map((step, index) => (
                <li key={index}>· {step}</li>
              ))}
            </ul>
          </div>
        )}
        {nextSuggestion && (
          <div className="outcome-suggestion">
            <span className="outcome-section-label">下次可以更好</span>
            <p>· {nextSuggestion}</p>
          </div>
        )}
      </section>

      <section className="review-hero">
        <div className="review-score-card">
          <div className="score-stub">
            <div className="review-score">{overall}<small>/100</small></div>
          </div>
          <div className="score-info">
            <span className="panel-kicker">本次表现</span>
            <h1>你已经建立了很好的信任基础</h1>
            <p>{summary?.content ?? "训练总结生成中…"}</p>
          </div>
        </div>
        <div className="review-radar-card">
          <MiniRadar dimensions={dimensions} />
          <div className="dim-list" aria-label="五维具体分数">
            {dimensionLabels.map(([key, label]) => (
              <div className="dim-row" key={key}>
                <span>{label}</span>
                <div className="dim-track"><i style={{ width: `${dimensions[key]}%` }} /></div>
                <strong>{dimensions[key]}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="review-grid">
        <article className="review-panel">
          <div className="review-panel-head"><Sparkles size={18} /><h2>关键时刻</h2></div>
          {moments.length > 0 ? (
            <CriticalTimeline moments={moments} getMomentHref={(moment) => `/session/${id}/conversation#turn-${moment.turn}`} />
          ) : (
            <p>暂无关键时刻数据</p>
          )}
        </article>

        <article className="review-panel">
          <div className="review-panel-head"><Trophy size={18} /><h2>优秀示范</h2></div>
          {turns.length > 0 ? (
            <ReplayInline turns={turns} />
          ) : (
            <p>暂无销冠对比数据</p>
          )}
        </article>
      </section>

        <nav className="review-actions" aria-label="复盘操作">
          <button
            onClick={() => navigate(`/session/${id}/conversation`)}
            className={isPending && pendingTarget === `/session/${id}/conversation` ? "is-loading" : ""}
            disabled={isPending}
          >
            {isPending && pendingTarget === `/session/${id}/conversation` ? "正在进入…" : <><MessageCircle size={17} />回看对话</>}
          </button>
        <button
          onClick={() => navigate("/training/new")}
          className={isPending && pendingTarget === "/training/new" ? "is-loading" : ""}
          disabled={isPending}
        >
          <RotateCcw size={17} />{isPending && pendingTarget === "/training/new" ? "正在进入…" : "开始新训练"}
        </button>
      </nav>
    </main>
  );
}
