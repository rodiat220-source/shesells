"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { createTrainingSession, generatePersona } from "@/src/lib/backendApi";
import {
  AGE_RANGE_OPTIONS,
  SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  buildPersonaPreview,
  hasRequiredPersonaTags,
  saveSessionPersona,
} from "@/src/lib/persona";
import type { PersonaResult, PersonaTags } from "@/src/types";

const initialTags: Partial<PersonaTags> = {
  ageRange: "26-35岁",
  skinType: "干皮",
  sensitivity: "敏感肌",
  concern: "",
};

export default function TrainingSetupPage() {
  const router = useRouter();
  const [tags, setTags] = useState<Partial<PersonaTags>>(initialTags);
  const [isStarting, setIsStarting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persona = useMemo(() => {
    if (!hasRequiredPersonaTags(tags)) return null;
    return buildPersonaPreview(tags);
  }, [tags]);

  function updateTag(key: keyof PersonaTags, value: string) {
    setTags((current) => ({ ...current, [key]: value }));
  }

  function resetTags() {
    if (isResetting) return; // 防抖
    setIsResetting(true);
    setTags(initialTags);
    window.setTimeout(() => setIsResetting(false), 300); // 短暂视觉反馈
  }

  async function startTraining() {
    if (!persona || isStarting) return; // 防抖

    setIsStarting(true);
    setError(null);
    try {
      // 1. 中文标签映射为后端需要的英文标签
      const ageMap: Record<string, string> = {
        "18-25岁": "18-25",
        "26-35岁": "26-35",
        "36岁以上": "36+",
      };
      const skinMap: Record<string, string> = {
        "干皮": "dry",
        "油皮": "oily",
        "混合皮": "combination",
      };
      const sensitivityMap: Record<string, string> = {
        "敏感肌": "sensitive",
        "非敏感肌": "non_sensitive",
      };

      // 2. 调用 /api/persona 生成完整画像
      const personaResult: PersonaResult = await generatePersona({
        age: ageMap[persona.tags.ageRange] ?? persona.tags.ageRange,
        oiliness: skinMap[persona.tags.skinType] ?? persona.tags.skinType,
        sensitivity: sensitivityMap[persona.tags.sensitivity] ?? persona.tags.sensitivity,
        concernText: persona.tags.concern,
      });

      // 3. 用完整画像创建会话
      const data = await createTrainingSession({
        customerProfile: personaResult.customerProfile,
        initialMessage: personaResult.initialMessage,
      });
      saveSessionPersona(data.sessionId, persona);
      router.push(`/session/${data.sessionId}`);
    } catch {
      setIsStarting(false);
      setError("训练暂时创建失败，请确认后端服务已启动后重试。");
    }
  }

  return (
    <main className="setup-shell">
      <header className="review-header">
        <Link className="back-link" href="/" aria-label="返回首页"><ArrowLeft size={18} /></Link>
        <Link className="brand training-brand" href="/"><span className="brand-mark">S</span><span>SheSells</span></Link>
        <div className="session-title"><strong>训练准备</strong><span>选择本次顾客画像</span></div>
      </header>

      <section className="setup-layout">
        <article className="setup-panel">
          <span className="panel-kicker">顾客画像标签</span>
          <h1>先定义这次要练的顾客</h1>
          <p>选择标签后，系统会生成本次训练的顾客画像。后续后端接入动态画像后，对话、回看和复盘都会围绕同一份画像展开。</p>

          <div className="tag-group" aria-label="年龄选择">
            <div className="tag-group-head"><strong>年龄</strong><span>必选</span></div>
            <div className="tag-options">
              {AGE_RANGE_OPTIONS.map((option) => (
                <button
                  className={tags.ageRange === option ? "is-selected" : ""}
                  key={option}
                  onClick={() => updateTag("ageRange", option)}
                  type="button"
                >
                  {tags.ageRange === option && <Check size={14} />}
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="tag-group" aria-label="肤质选择">
            <div className="tag-group-head"><strong>肤质</strong><span>必选</span></div>
            <div className="tag-options">
              {SKIN_TYPE_OPTIONS.map((option) => (
                <button
                  className={tags.skinType === option ? "is-selected" : ""}
                  key={option}
                  onClick={() => updateTag("skinType", option)}
                  type="button"
                >
                  {tags.skinType === option && <Check size={14} />}
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="tag-group" aria-label="敏感度选择">
            <div className="tag-group-head"><strong>敏感度</strong><span>必选</span></div>
            <div className="tag-options">
              {SENSITIVITY_OPTIONS.map((option) => (
                <button
                  className={tags.sensitivity === option ? "is-selected" : ""}
                  key={option}
                  onClick={() => updateTag("sensitivity", option)}
                  type="button"
                >
                  {tags.sensitivity === option && <Check size={14} />}
                  {option}
                </button>
              ))}
            </div>
          </div>

          <label className="concern-field">
            <span>主要顾虑</span>
            <textarea
              value={tags.concern ?? ""}
              onChange={(event) => updateTag("concern", event.target.value)}
              placeholder="例如：担心泛红刺痛、怕闷痘、预算有限、想要快速见效"
              maxLength={80}
            />
          </label>
        </article>

        <aside className="setup-preview">
          <div className="setup-preview-head">
            <span className="panel-kicker">画像预览</span>
            <Sparkles size={18} />
          </div>

          {persona ? (
            <>
              <div className="persona-row setup-persona-row">
                <div className="persona-avatar">{persona.avatar}</div>
                <div className="persona-copy">
                  <h2>{persona.name}</h2>
                  <div className="persona-tags">
                    {persona.tagLabels.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                </div>
              </div>
              <p className="setup-display-line">{persona.displayLine}</p>
              <p className="setup-background">{persona.background}</p>
              <div className="goal-card">
                <div><Sparkles size={17} /><strong>训练目标</strong></div>
                <p>{persona.trainingGoal}</p>
              </div>
            </>
          ) : (
            <p className="setup-background">请选择完整标签后生成画像预览。</p>
          )}

          {error && <p className="setup-error">{error}</p>}

          <div className="setup-actions">
            <button
              className={`secondary-button ${isResetting ? "is-loading" : ""}`}
              onClick={resetTags}
              disabled={isResetting}
              type="button"
            >
              <RotateCcw size={16} />{isResetting ? "重置中…" : "重置"}
            </button>
            <button
              className={`primary-button ${isStarting ? "is-loading" : ""}`}
              onClick={startTraining}
              disabled={!persona || isStarting}
              type="button"
            >
              <ArrowRight size={17} />
              {isStarting ? "正在创建训练" : "开始训练"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
