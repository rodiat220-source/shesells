"use client";

import { Bot, Check, CircleStop, Lightbulb, Sparkles, UserRound } from "lucide-react";
import type { Message } from "@/src/types";
import { useSessionStore } from "@/src/store/sessionStore";
import { CriticalTimeline } from "./CriticalTimeline";
import { MiniRadar } from "./MiniRadar";
import { ReplayInline } from "./ReplayInline";

const coachConfig = {
  probe: { label: "教练提示", icon: Lightbulb },
  halt: { label: "停一下", icon: CircleStop },
  feedback: { label: "即时反馈", icon: Bot },
  summary: { label: "训练总结", icon: Sparkles },
  champion_replay: { label: "优秀示范", icon: Sparkles },
};

export function MessageBubble({
  message,
  forceCoachAction = false,
  baLabel = "你 · 销售顾问",
  customerLabel = "顾客",
}: {
  message: Message;
  forceCoachAction?: boolean;
  baLabel?: string;
  customerLabel?: string;
}) {
  const { continueAfterHalt, isHalted } = useSessionStore();

  if (message.role === "coach" && message.coachType) {
    const config = coachConfig[message.coachType];
    const Icon = config.icon;
    const dimensions = message.metadata?.dimensions;
    const overall = dimensions ? Math.round(Object.values(dimensions).reduce((sum, score) => sum + score, 0) / 5) : null;
    const shouldShowAction = Boolean(message.metadata?.requiresAction && (forceCoachAction || isHalted));

    return (
      <article className={`coach-card coach-${message.coachType}`}>
        <div className="coach-card-bar" />
        <div className="coach-card-body">
          <div className="coach-card-head">
            <span className="coach-icon"><Icon size={18} /></span>
            <div><span>{config.label}</span>{message.coachType === "halt" && <small>关键顾虑未被回应</small>}</div>
          </div>
          <p className="coach-content">{message.content}</p>

          {dimensions && (
            <div className="summary-grid">
              <div className="summary-score">
                <span>综合表现</span><strong>{overall}</strong><small>/ 100</small>
                <p>你已经建立了很好的信任基础</p>
              </div>
              <MiniRadar dimensions={dimensions} />
            </div>
          )}
          {message.metadata?.criticalMoments && <CriticalTimeline moments={message.metadata.criticalMoments} />}
          {message.metadata?.replayTurns && <ReplayInline turns={message.metadata.replayTurns} />}
          {shouldShowAction && (
            <div className="coach-confirmation">
              <div>
                <strong>明白了吗？</strong>
                <span>确认后就可以继续回应顾客。</span>
              </div>
              <button type="button" onClick={forceCoachAction ? undefined : () => void continueAfterHalt()}>
                <Check size={15} />{message.metadata?.actionLabel ?? "明白了，继续"}
              </button>
            </div>
          )}
        </div>
      </article>
    );
  }

  const isBA = message.role === "ba";
  return (
    <div className={`message-row ${isBA ? "message-ba" : "message-customer"}`}>
      {!isBA && <span className="chat-avatar"><UserRound size={17} /></span>}
      <div className="message-stack">
        <span className="message-author">{isBA ? baLabel : customerLabel}</span>
        <div className="message-bubble">{message.content}</div>
      </div>
      {isBA && <span className="chat-avatar ba"><span>BA</span></span>}
    </div>
  );
}
