"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { useSessionStore } from "@/src/store/sessionStore";
import { createTrainingSession } from "@/src/lib/backendApi";

const AGE_OPTIONS = [
  { value: "18-25", label: "18-25岁" },
  { value: "26-35", label: "26-35岁" },
  { value: "36+", label: "36岁以上" },
];

const OILINESS_OPTIONS = [
  { value: "oily", label: "油皮" },
  { value: "dry", label: "干皮" },
  { value: "combination", label: "混合皮" },
];

const SENSITIVITY_OPTIONS = [
  { value: "sensitive", label: "敏感肌" },
  { value: "non_sensitive", label: "非敏感肌" },
];

export default function PersonaPage() {
  const router = useRouter();
  const { persona, isGeneratingPersona, generatePersona, reset } = useSessionStore();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const [age, setAge] = useState<string>("");
  const [oiliness, setOiliness] = useState<string>("");
  const [sensitivity, setSensitivity] = useState<string>("");
  const [concernText, setConcernText] = useState<string>("");

  const canGenerate = age && oiliness && sensitivity && !isGeneratingPersona;

  async function handleGenerate() {
    if (!canGenerate) return;
    const ok = await generatePersona({ age, oiliness, sensitivity, concernText: concernText.trim() || undefined });
    if (!ok) {
      reset();
    }
  }

  async function handleStartTraining() {
    if (!persona || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    try {
      const data = await createTrainingSession({
        customerProfile: persona.customerProfile,
        initialMessage: persona.initialMessage,
      });
      router.push(`/session/${data.sessionId}`);
    } catch {
      setStartError("创建训练失败，请稍后重试。");
    } finally {
      setIsStarting(false);
    }
  }

  function handleReselect() {
    reset();
    setStartError(null);
    setAge("");
    setOiliness("");
    setSensitivity("");
    setConcernText("");
  }

  if (persona) {
    return (
      <main className="training-shell">
        <header className="training-header">
          <Link className="back-link" href="/" aria-label="返回首页">
            <ArrowLeft size={18} />
          </Link>
          <Link className="brand training-brand" href="/">
            <span className="brand-mark">S</span>
            <span>SheSells</span>
          </Link>
          <div className="session-title">
            <strong>顾客画像</strong>
            <span>预览画像 · 开始训练</span>
          </div>
          <div className="session-state">
            <span className="status-dot" />
            AI 销售教练
          </div>
        </header>

        <div className="training-body">
          <section className="persona-preview-section">
            <div className="persona-preview-card">
              <div className="eyebrow">
                <Sparkles size={15} />
                你的顾客画像已生成
              </div>
              <h1 className="persona-preview-title">你的顾客画像</h1>

              <div className="persona-display-line">
                <span className="persona-display-icon">📋</span>
                <span>{persona.displayLine}</span>
              </div>

              <div className="persona-divider" />

              <div className="persona-detail">
                <div className="persona-detail-header">
                  <div className="persona-avatar-large">👤</div>
                  <p className="persona-background">{persona.customerProfile.background}</p>
                </div>

                <div className="persona-concerns">
                  <strong>主要顾虑</strong>
                  <ul>
                    {persona.customerProfile.concerns.map((concern, i) => (
                      <li key={i}>{concern}</li>
                    ))}
                  </ul>
                </div>

                <div className="persona-initial-message">
                  <div className="persona-initial-header">
                    <MessageCircle size={14} />
                    <span>顾客开场白</span>
                  </div>
                  <p>{persona.initialMessage}</p>
                </div>
              </div>

              {startError && <p className="case-error" role="alert">{startError}</p>}

              <div className="persona-actions">
                <button className="primary-button" onClick={handleStartTraining} disabled={isStarting} type="button">
                  {isStarting ? "创建训练中…" : "开始训练"}
                  <ArrowRight size={18} />
                </button>
                <button className="secondary-button" onClick={handleReselect} type="button">
                  <RotateCcw size={16} />
                  重选标签
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (isGeneratingPersona) {
    return (
      <main className="training-shell">
        <header className="training-header">
          <Link className="back-link" href="/" aria-label="返回首页">
            <ArrowLeft size={18} />
          </Link>
          <Link className="brand training-brand" href="/">
            <span className="brand-mark">S</span>
            <span>SheSells</span>
          </Link>
          <div className="session-title">
            <strong>生成顾客画像</strong>
            <span>AI 正在生成中…</span>
          </div>
          <div className="session-state">
            <span className="status-dot" />
            AI 销售教练
          </div>
        </header>
        <div className="training-body">
          <div className="persona-loading">
            <div className="case-loading-spinner" />
            <strong>正在生成画像…</strong>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="training-shell">
      <header className="training-header">
        <Link className="back-link" href="/" aria-label="返回首页">
          <ArrowLeft size={18} />
        </Link>
        <Link className="brand training-brand" href="/">
          <span className="brand-mark">S</span>
          <span>SheSells</span>
        </Link>
        <div className="session-title">
          <strong>生成顾客画像</strong>
          <span>选择标签 · 生成专属顾客</span>
        </div>
        <div className="session-state">
          <span className="status-dot" />
          AI 销售教练
        </div>
      </header>

      <div className="training-body">
        <section className="persona-select-section">
          <div className="persona-select-card">
            <div className="eyebrow">
              <Sparkles size={15} />
              选择你的顾客画像
            </div>
            <h1 className="persona-select-title">
              选择你的顾客画像
            </h1>
            <p className="persona-select-subtitle">
              教的不是话术，是懂她的能力。
            </p>

            <div className="tag-group">
              <label className="tag-group-label">年龄 <span className="tag-required">必选</span></label>
              <div className="tag-options">
                {AGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`tag-chip ${age === opt.value ? "is-selected" : ""}`}
                    onClick={() => setAge(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tag-group">
              <label className="tag-group-label">肤质 - 油性 <span className="tag-required">必选</span></label>
              <div className="tag-options">
                {OILINESS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`tag-chip ${oiliness === opt.value ? "is-selected" : ""}`}
                    onClick={() => setOiliness(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tag-group">
              <label className="tag-group-label">肤质 - 敏感度 <span className="tag-required">必选</span></label>
              <div className="tag-options">
                {SENSITIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`tag-chip ${sensitivity === opt.value ? "is-selected" : ""}`}
                    onClick={() => setSensitivity(opt.value)}
                    type="button"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="tag-group">
              <label className="tag-group-label">主要顾虑 <span className="tag-optional">选填</span></label>
              <textarea
                className="concern-input"
                placeholder="例：希望淡化红血丝的高性价比产品"
                value={concernText}
                onChange={(e) => setConcernText(e.target.value)}
                rows={2}
              />
            </div>

            <button
              className={`primary-button persona-generate-btn ${!canGenerate ? "is-disabled" : ""}`}
              onClick={handleGenerate}
              disabled={!canGenerate}
              type="button"
            >
              {isGeneratingPersona ? "正在生成画像…" : "生成消费者画像"}
              {!isGeneratingPersona && <ArrowRight size={18} />}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
