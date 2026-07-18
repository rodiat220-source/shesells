"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  MessageCircleHeart,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  
  function navigate(path: string) {
    if (isPending) return; // 防抖：跳转进行中忽略后续点击
    setPendingTarget(path);
    startTransition(() => {
      router.push(path);
    });
  }

  return (
    <main className="landing-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <nav className="landing-nav" aria-label="主导航">
        <a className="brand" href="#top" aria-label="SheSells 首页">
          <span className="brand-mark">S</span>
          <span>SheSells</span>
        </a>
        <div className="nav-note">
          <span className="status-dot" />
          AI 销售教练
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={15} />
            专为美妆顾问设计的实战陪练
          </div>
          <h1>
            教的不是话术，
            <span>是懂她的能力。</span>
          </h1>
          <p className="hero-description">
            在真实顾客情境中练习倾听、回应与推荐。你的 AI 教练会在关键时刻主动提醒，陪你把每一次对话变成成长。
          </p>

          <div className="hero-actions">
            <button
              className={`primary-button ${isPending && pendingTarget === "/training/new" ? "is-loading" : ""}`}
              onClick={() => navigate("/training/new")}
              disabled={isPending}
            >
              {isPending && pendingTarget === "/training/new" ? "正在进入…" : "开始情境训练"}
              {!isPending && <ArrowRight size={18} />}
            </button>
            <button
              className={`secondary-button ${isPending && pendingTarget === "/case-review" ? "is-loading" : ""}`}
              onClick={() => navigate("/case-review")}
              type="button"
              disabled={isPending}
            >
              <BookOpen size={17} />
              {isPending && pendingTarget === "/case-review" ? "正在进入…" : "案例复盘"}
            </button>
          </div>

          <div className="trust-row" aria-label="训练特色">
            <span><MessageCircle size={14} />真实顾客反应</span>
            <span><Megaphone size={14} />即时教练反馈</span>
            <span><Trophy size={14} />销冠案例对比</span>
          </div>
        </div>

        <div className="hero-demo" aria-label="训练对话预览">
          <div className="demo-window">
            <div className="demo-topbar">
              <div className="mini-brand">
                <span className="brand-mark small">S</span>
                <div>
                  <strong>情境训练</strong>
                  <span>敏感肌 · 早 C 晚 A</span>
                </div>
              </div>
              <span className="live-pill"><span />进行中</span>
            </div>

            <div className="demo-chat">
              <div className="demo-message customer-preview">
                <span className="avatar customer-avatar">顾</span>
                <div>
                  <label>顾客</label>
                  <p>我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？</p>
                </div>
              </div>

              <div className="demo-message ba-preview">
                <div>
                  <label>你</label>
                  <p>当然可以，我先了解一下，你之前有使用过 A 醇或酸类产品吗？</p>
                </div>
                <span className="avatar ba-avatar">你</span>
              </div>

              <div className="coach-preview">
                <div className="coach-preview-icon"><MessageCircleHeart size={18} /></div>
                <div>
                  <span>教练观察</span>
                  <strong>很好的探询</strong>
                  <p>你没有急着推荐，而是先了解她的耐受经历。</p>
                </div>
              </div>
            </div>

            <div className="demo-input">
              <span>输入你的回应…</span>
              <span className="send-circle"><ArrowRight size={16} /></span>
            </div>
          </div>

          <div className="floating-card floating-score">
            <div className="score-ring">86</div>
            <div><strong>倾听力</strong><span>表现优秀</span></div>
          </div>
          <div className="floating-card floating-safe">
            <ShieldCheck size={18} />
            <span>在安全环境中反复练习</span>
          </div>
        </div>
      </section>

            <section className="feature-strip" aria-label="教练能力">
        <div><span>01</span><strong>主动追问</strong><p>遗漏关键需求时，教练引导你重新思考。</p></div>
        <div><span>02</span><strong>关键喊停</strong><p>连续错过顾虑时，及时暂停并给出方向。</p></div>
        <div><span>03</span><strong>销冠对比</strong><p>训练结束后，看优秀顾问如何接住信号。</p></div>
      </section>
    </main>
  );
}
