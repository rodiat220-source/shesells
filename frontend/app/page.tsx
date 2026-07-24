"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Eye,
  MessageCircleHeart,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
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

  const entryCards = [
    {
      path: "/demos",
      title: "看销冠怎么说",
      description: "先看标杆对话和教练讲解，知道练好了是什么样。",
      meta: "首次推荐",
      icon: Eye,
      tone: "recommended",
    },
    {
      path: "/case-review",
      title: "复盘我的真实案例",
      description: "把一次没成交、被问住或聊崩的经历，拆成可改进动作。",
      meta: "有案例就从这里进",
      icon: ClipboardList,
      tone: "standard",
    },
    {
      path: "/training/new",
      title: "开始一轮情境训练",
      description: "选择顾客画像，直接进入模拟对话，获得实时反馈。",
      meta: "明确想练就直接上",
      icon: Target,
      tone: "standard",
    },
  ];

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
            每个 BA 的训练需求都不一样。你可以先看销冠示范，也可以复盘自己的真实案例，或者直接开始一轮情境训练。
          </p>

          <div className="entry-copy">
            <BookOpen size={16} />
            <span>第一次使用，建议先看一段销冠示范；有真实丢单案例时，可以直接进入复盘。</span>
          </div>

          <div className="home-entry-grid" aria-label="训练入口">
            {entryCards.map((entry) => {
              const Icon = entry.icon;
              const isLoading = isPending && pendingTarget === entry.path;
              return (
                <button
                  className={`home-entry-card ${entry.tone === "recommended" ? "is-recommended" : ""} ${isLoading ? "is-loading" : ""}`}
                  disabled={isPending}
                  key={entry.path}
                  onClick={() => navigate(entry.path)}
                  type="button"
                >
                  <span className="home-entry-icon"><Icon size={18} /></span>
                  <span className="home-entry-content">
                    <strong>{isLoading ? "正在进入..." : entry.title}</strong>
                    <small>{entry.meta}</small>
                    <em>{entry.description}</em>
                  </span>
                  {!isLoading && <ArrowRight size={16} />}
                </button>
              );
            })}
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
              <span>选择你的训练入口…</span>
              <span className="send-circle"><ArrowRight size={16} /></span>
            </div>
          </div>

          <div className="floating-card floating-score">
            <div className="score-ring">86</div>
            <div><strong>示范评分</strong><span>销冠水平</span></div>
          </div>
          <div className="floating-card floating-safe">
            <ShieldCheck size={18} />
            <span>先看标杆，再按需训练</span>
          </div>
        </div>
      </section>

      <section className="feature-strip" aria-label="训练方式">
        <div><span>01</span><strong>看标杆</strong><p>先看销冠如何接住顾虑、追问需求和专业收口。</p></div>
        <div><span>02</span><strong>问案例</strong><p>把真实丢单经历交给 AI，找出关键失误和更优回应。</p></div>
        <div><span>03</span><strong>做练习</strong><p>选择顾客画像进入情境训练，在对话中获得即时反馈。</p></div>
      </section>
    </main>
  );
}
