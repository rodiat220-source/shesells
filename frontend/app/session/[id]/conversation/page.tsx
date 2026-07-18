"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { ChatContainer } from "@/components/ChatContainer";
import { useSessionStore } from "@/src/store/sessionStore";
import { profileToPersonaPreview } from "@/src/lib/persona";
import { useSessionPersona } from "@/src/lib/useSessionPersona";

export default function ConversationReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, messages, loadSession } = useSessionStore();
  const personaOverride = useSessionPersona(id);

  useEffect(() => {
    if (!session || session.sessionId !== id) void loadSession(id);
  }, [id, loadSession, session]);

  const customerProfile = session?.customerProfile;
  const persona = useMemo(() => {
    if (personaOverride) return personaOverride;
    if (customerProfile) return profileToPersonaPreview(customerProfile);
    return null;
  }, [customerProfile, personaOverride]);
  const scenarioTitle = persona?.displayLine || "本次训练画像";

  const conversationMessages = useMemo(() => {
    return messages.filter((message) => message.coachType !== "summary" && message.coachType !== "champion_replay");
  }, [messages]);
  const baReplyCount = conversationMessages.filter((m) => m.role === "ba").length;
  const haltCount = conversationMessages.filter((m) => m.role === "coach" && (m.coachType === "halt" || m.coachType === "halt_with_champion")).length;

  useEffect(() => {
    if (conversationMessages.length === 0 || !window.location.hash) return;

    window.requestAnimationFrame(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [conversationMessages.length]);

  return (
    <main className="conversation-review-shell">
      <header className="review-header">
        <Link className="back-link" href={`/session/${id}/review`} aria-label="返回复盘"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>回看对话</strong><span>{scenarioTitle}</span></div>
        <Link className="review-restart" href={`/session/${id}/review`}><ClipboardList size={16} />看复盘</Link>
      </header>

      <section className="conversation-review-layout">
        <aside className="conversation-review-summary">
          <span className="panel-kicker">训练回放</span>
          <h1>完整对话记录</h1>
          <p>{persona ? `本次顾客画像：${persona.displayLine}。` : "这里复现本次训练中的顾客、销售顾问和教练提示，按真实发生顺序完整呈现。"}</p>
          <div className="conversation-review-meta">
            <div><strong>{baReplyCount}</strong><span>BA 回复</span></div>
            <div><strong>{haltCount}</strong><span>停一下</span></div>
          </div>
        </aside>

        <section className="conversation-review-chat" aria-label="历史对话">
          <div className="conversation-head">
            <div><ClipboardList size={18} /><span>历史对话</span></div>
            <p>只读回放</p>
          </div>
          {conversationMessages.length > 0 ? (
            <ChatContainer messages={conversationMessages} isLoading={false} />
          ) : (
            <p>暂无对话记录</p>
          )}
        </section>
      </section>
    </main>
  );
}
