"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, HeartHandshake, MoreHorizontal, ShieldCheck } from "lucide-react";
import { ChatContainer } from "@/components/ChatContainer";
import { BAInput } from "@/components/BAInput";
import { useSessionStore } from "@/src/store/sessionStore";
import { profileToPersonaPreview } from "@/src/lib/persona";
import { useSessionPersona } from "@/src/lib/useSessionPersona";

const stageSteps = ["开场", "探询", "异议", "推荐", "促单"];

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { session, messages, isLoading, error, loadSession } = useSessionStore();
  const personaOverride = useSessionPersona(id);
  const [isReloading, setIsReloading] = useState(false);

  async function handleReload() {
    if (isReloading) return; // 防抖
    setIsReloading(true);
    await loadSession(id);
    setIsReloading(false);
  }

  useEffect(() => {
    void loadSession(id);
  }, [id, loadSession]);

  useEffect(() => {
    if (session?.sessionId === id && session.status === "completed") {
      router.replace(`/session/${id}/review`);
    }
  }, [id, router, session]);

  const baTurns = messages.filter((message) => message.role === "ba").length;
  const stageLabel = baTurns === 0 ? "建立信任" : baTurns < 2 ? "了解需求" : baTurns < 4 ? "回应顾虑" : "给出建议";
  const activeStep = Math.min(stageSteps.length - 1, baTurns);
  const isCompleted = session?.status === "completed";
  const visibleMessages = messages.filter((message) => message.coachType !== "summary" && message.coachType !== "champion_replay");
  const liveScore = session?.dimensions
    ? Math.round(Object.values(session.dimensions).reduce((sum, score) => sum + score, 0) / 5)
    : 0;
  const liveReasoning = session?.dimensionReasoning
    ? Object.values(session.dimensionReasoning).join("\n\n")
    : "本轮暂无评分依据。";
  const customerProfile = session?.customerProfile;
  const persona = useMemo(() => {
    if (personaOverride) return personaOverride;
    if (customerProfile) return profileToPersonaPreview(customerProfile);
    return null;
  }, [customerProfile, personaOverride]);
  const scenarioTitle = persona?.displayLine || "顾客画像加载中";

  return (
    <main className="training-shell">
      <header className="training-header">
        <Link className="back-link" href="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>情境训练</strong><span>{scenarioTitle}</span></div>
        <div className="session-state"><span className="status-dot" />{session?.status === "completed" ? "已完成" : "训练中"}</div>
        <button className="icon-button" aria-label="更多选项"><MoreHorizontal size={20} /></button>
      </header>

      <div className="training-layout">
        <aside className="scenario-panel">
          <div className="persona-tag">
            <span className="panel-kicker">本次情境</span>
            <div className="persona-row">
              <div className="persona-avatar">{persona?.avatar ?? "顾"}<span>{scenarioTitle}</span></div>
              <div className="persona-copy">
                <h2>{persona?.name ?? "顾客"}{persona?.ageLabel ? `，${persona.ageLabel}` : ""}</h2>
                <div className="persona-tags">
                  {(persona?.tagLabels.length ? persona.tagLabels : ["顾客画像"]).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
              </div>
            </div>
            <p>{persona?.background ?? "正在读取本次训练画像。"}</p>
          </div>

          <div className="goal-card">
            <div><ShieldCheck size={17} /><strong>你的训练目标</strong></div>
            <p>{persona?.trainingGoal ?? "理解顾客真正的担忧，给出让她感到安心、可执行的入门建议。"}</p>
          </div>

          <div className="stage-progress">
            <div className="progress-head"><span>对话进程</span><strong>{stageLabel}</strong></div>
            <div className="stepper" aria-label="对话进程">
              {stageSteps.map((step, index) => (
                <div className={`stepper-item ${index <= activeStep ? "is-active" : ""} ${index === activeStep ? "is-current" : ""}`} key={step}>
                  <span />
                  <em>{step}</em>
                </div>
              ))}
            </div>
          </div>

          {session?.dimensions && !isCompleted && (
            <div className="live-score-note" title={liveReasoning}>
              <strong>{liveScore}</strong>
              <p>悬停分数查看本轮评分依据。</p>
            </div>
          )}
        </aside>

        <section className="conversation-panel">
          <div className="conversation-head">
            <div><HeartHandshake size={18} /><span>顾客对话</span></div>
            <p>你正在扮演专柜销售顾问</p>
          </div>

          {error ? (
            <div className="error-state"><p>{error}</p><button className={isReloading ? "is-loading" : ""} onClick={handleReload} disabled={isReloading}>{isReloading ? "正在重载…" : "重新加载"}</button></div>
          ) : (
            <ChatContainer messages={visibleMessages} isLoading={isLoading && messages.length > 0} />
          )}
          <BAInput />
        </section>
      </div>
    </main>
  );
}
