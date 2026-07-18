"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { CriticalTimeline } from "@/components/CriticalTimeline";
import { MessageBubble } from "@/components/MessageBubble";
import { MiniRadar } from "@/components/MiniRadar";
import { ReplayInline } from "@/components/ReplayInline";
import { analyzeCase, sendPracticeMessage } from "@/src/lib/backendApi";
import type { CaseAnalysisResult, Message, PracticeMessage } from "@/src/types";

const sampleNarrative = "顾客说自己敏感肌，想试早 C 晚 A，但是担心刺痛和烂脸。我当时觉得她已经很感兴趣，就直接推荐了套装，还说很多人都在用效果不错。她问会不会刺激，我没有继续追问她之前用过什么，只说可以先试试。最后顾客说再考虑一下就走了。";
const maxPracticeTurns = 10;

export default function CaseReviewPage() {
  const [phase, setPhase] = useState<"input" | "loading" | "result" | "practice">("input");
  const [narrative, setNarrative] = useState("");
  const [analysis, setAnalysis] = useState<CaseAnalysisResult | null>(null);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceMessages, setPracticeMessages] = useState<PracticeMessage[]>([]);
  const [isPracticing, setIsPracticing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sampleFilled, setSampleFilled] = useState(false);
  const [switchingPhase, setSwitchingPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const practiceTurns = practiceMessages.filter((message) => message.role === "customer").length;
  const canPractice = Boolean(analysis?.practiceId) && practiceTurns < maxPracticeTurns;

  const practiceChatMessages = useMemo<Message[]>(() => {
    return practiceMessages.map((message, index) => ({
      id: message.id,
      turn: Math.floor(index / 2) + 1,
      role: message.role === "champion" ? "ba" : "customer",
      content: message.content,
      timestamp: new Date().toISOString(),
    }));
  }, [practiceMessages]);

  async function startAnalysis() {
    if (isAnalyzing) return; // 防抖
    if (narrative.trim().length < 10) {
      setError("请先粘贴至少 10 个字的案例叙述。");
      return;
    }

    setIsAnalyzing(true);
    setPhase("loading");
    setError(null);
    try {
      const result = await analyzeCase(narrative.trim());
      setAnalysis(result);
      setPracticeMessages([]);
      setPhase("result");
    } catch {
      setError("案例分析失败，请确认后端服务正常后重试。");
      setPhase("input");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function submitPracticeMessage() {
    const content = practiceInput.trim();
    if (!content || !analysis?.practiceId || isPracticing || !canPractice) return;

    const nextTurn = practiceTurns + 1;
    const customerMessage: PracticeMessage = {
      id: `practice_customer_${Date.now()}`,
      role: "customer",
      content,
    };
    setPracticeMessages((messages) => [...messages, customerMessage]);
    setPracticeInput("");
    setIsPracticing(true);
    setError(null);

    try {
      const championReply = await sendPracticeMessage(analysis.practiceId, content);
      setPracticeMessages((messages) => [
        ...messages,
        {
          id: `practice_champion_${Date.now()}_${nextTurn}`,
          role: "champion",
          content: championReply,
        },
      ]);
    } catch {
      setError("销冠回复生成失败，请稍后再试。");
    } finally {
      setIsPracticing(false);
    }
  }

  // 切换 phase 时给一个短暂的 loading 反馈，让用户感知到点击已触发
  function switchPhase(target: "input" | "result" | "practice") {
    if (switchingPhase) return; // 防抖
    setSwitchingPhase(target);
    window.setTimeout(() => {
      setPhase(target);
      setSwitchingPhase(null);
    }, 220);
  }

  function fillSample() {
    if (sampleFilled) return; // 防止重复点击
    setNarrative(sampleNarrative);
    setSampleFilled(true);
  }

  return (
    <main className="case-review-shell">
      <header className="review-header">
        <Link className="back-link" href="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>案例复盘</strong><span>粘贴真实丢单案例</span></div>
      </header>

      {phase === "input" && (
        <section className="case-input-layout">
          <div className="case-input-copy">
            <span className="panel-kicker">CASE REVIEW</span>
            <h1>把一次没成交，变成下一次会成交。</h1>
            <p>粘贴语音转文字后的失败案例，AI 会帮你找出丢单原因、关键时刻和销冠处理方式。</p>
            <div className="case-tips">
              <span><CheckCircle2 size={15} />写清顾客顾虑</span>
              <span><CheckCircle2 size={15} />写下你的原回复</span>
              <span><CheckCircle2 size={15} />写出最后没成交的原因猜测</span>
            </div>
          </div>
          <div className="case-input-card">
            <div className="case-input-head">
              <div><MessageCircle size={18} /><strong>失败案例叙述</strong></div>
              <button type="button" onClick={fillSample} disabled={sampleFilled}>
                {sampleFilled ? "已填入" : "填入示例"}
              </button>
            </div>
            <textarea
              aria-label="粘贴失败案例叙述"
              onChange={(event) => setNarrative(event.target.value)}
              placeholder="例如：顾客说自己敏感肌，想试早 C 晚 A，但担心刺痛。我当时直接推荐了套装..."
              value={narrative}
            />
            {error && <p className="case-error">{error}</p>}
            <button
              className={`primary-button ${isAnalyzing ? "is-loading" : ""}`}
              onClick={startAnalysis}
              disabled={isAnalyzing}
              type="button"
            >
              {isAnalyzing ? "正在分析…" : "开始分析"}
              {!isAnalyzing && <ArrowRight size={17} />}
            </button>
          </div>
        </section>
      )}

      {phase === "loading" && (
        <section className="case-loading">
          <Loader2 size={30} />
          <h1>AI 正在分析你的案例...</h1>
          <p>正在识别顾客信号、BA 关键动作和更优销冠回应。</p>
        </section>
      )}

      {analysis && phase === "result" && (
        <section className="case-result-layout">
          <article className="case-score-panel">
            <div className="case-score">
              <strong>{analysis.totalScore}</strong>
              <span>/100</span>
            </div>
            <div>
              <span className="panel-kicker">问题诊断</span>
              <h1>{analysis.summary}</h1>
            </div>
          </article>

          <article className="case-panel">
            <div className="review-panel-head"><Sparkles size={18} /><h2>关键问题</h2></div>
            <ol className="case-issue-list">
              {analysis.keyIssues.map((issue) => <li key={issue}>{issue}</li>)}
            </ol>
          </article>

          <article className="case-panel case-radar-panel">
            <MiniRadar dimensions={analysis.dimensions} />
          </article>

          <article className="case-panel">
            <div className="review-panel-head"><Sparkles size={18} /><h2>关键时刻</h2></div>
            {analysis.keyMoments.length > 0 ? <CriticalTimeline moments={analysis.keyMoments} /> : <p>暂无关键时刻。</p>}
          </article>

          <article className="case-panel">
            <div className="review-panel-head"><Trophy size={18} /><h2>销冠对比</h2></div>
            {analysis.championReplay.rounds.length > 0 ? <ReplayInline turns={analysis.championReplay.rounds} /> : <p>暂无销冠示范。</p>}
          </article>

          <nav className="review-actions" aria-label="案例复盘操作">
            <button
              onClick={() => switchPhase("practice")}
              type="button"
              className={switchingPhase === "practice" ? "is-loading" : ""}
              disabled={Boolean(switchingPhase)}
            >
              <Bot size={17} />跟销冠对练
            </button>
            <button
              onClick={() => switchPhase("input")}
              type="button"
              className={switchingPhase === "input" ? "is-loading" : ""}
              disabled={Boolean(switchingPhase)}
            >
              <Sparkles size={17} />重新分析
            </button>
          </nav>
        </section>
      )}

      {analysis && phase === "practice" && (
        <section className="case-practice-layout">
          <aside className="case-practice-summary">
            <span className="panel-kicker">CHAMPION PRACTICE</span>
            <h1>你扮演顾客，销冠来接话。</h1>
            <p>把自己代入顾客，继续抛出顾虑，观察销冠 BA 如何承接、追问和转化。</p>
            <div className="conversation-review-meta">
              <div><strong>{practiceTurns}</strong><span>已练轮次</span></div>
              <div><strong>{maxPracticeTurns}</strong><span>轮上限</span></div>
            </div>
            <button
              className={`conversation-review-action ${switchingPhase === "result" ? "is-loading" : ""}`}
              onClick={() => switchPhase("result")}
              type="button"
              disabled={Boolean(switchingPhase)}
            >
              结束对练
            </button>
          </aside>

          <section className="case-practice-chat" aria-label="销冠对练">
            <div className="conversation-head">
              <div><Bot size={18} /><span>销冠对练</span></div>
              <p>{canPractice ? "你正在扮演顾客" : "已达到轮次上限"}</p>
            </div>
            <div className="case-practice-scroll">
              {practiceChatMessages.length === 0 ? (
                <div className="case-empty-practice">
                  <Sparkles size={20} />
                  <p>先用顾客口吻说一句，例如：“我还是怕会不会太刺激？”</p>
                </div>
              ) : (
                practiceChatMessages.map((message) => (
                  <MessageBubble
                    baLabel="销冠 BA"
                    customerLabel="你 · 扮演顾客"
                    key={message.id}
                    message={message}
                  />
                ))
              )}
              {isPracticing && (
                <div className="thinking-row">
                  <span className="chat-avatar">冠</span>
                  <div className="thinking-bubble"><i /><i /><i /></div>
                </div>
              )}
            </div>
            <div className="composer-wrap">
              <div className="composer">
                <textarea
                  aria-label="输入顾客回应"
                  disabled={isPracticing || !canPractice}
                  onChange={(event) => setPracticeInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submitPracticeMessage();
                    }
                  }}
                  placeholder={canPractice ? "用顾客口吻继续追问..." : "本次对练已达到 10 轮上限"}
                  rows={1}
                  value={practiceInput}
                />
                <button
                  aria-label="发送顾客回应"
                  className={`send-button ${isPracticing ? "is-loading" : ""}`}
                  disabled={!practiceInput.trim() || isPracticing || !canPractice}
                  onClick={() => void submitPracticeMessage()}
                  type="button"
                >
                  <Send size={17} />
                </button>
              </div>
              <div className="composer-meta">
                <span>Enter 发送 · Shift + Enter 换行</span>
                {error && <span className="case-error-inline">{error}</span>}
              </div>
            </div>
          </section>
        </section>
      )}
    </main>
  );
}
