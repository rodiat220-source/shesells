import type { CustomerProfile, PersonaPreview, PersonaTags } from "@/src/types";

export const AGE_RANGE_OPTIONS = ["18-25岁", "26-35岁", "36岁以上"] as const;
export const SKIN_TYPE_OPTIONS = ["油皮", "干皮", "混合皮"] as const;
export const SENSITIVITY_OPTIONS = ["敏感肌", "非敏感肌"] as const;

const storagePrefix = "shesells:persona:";
const recordsKey = "shesells:sessionRecords";
export interface SessionRecord {
  sessionId: string;
  displayLine: string;
  createdAt: string;
}
export function saveSessionRecord(sessionId: string, displayLine: string) {
  try {
    const raw = localStorage.getItem(recordsKey);
    const records: SessionRecord[] = raw ? JSON.parse(raw) : [];
    const filtered = records.filter((r) => r.sessionId !== sessionId);
    filtered.unshift({ sessionId, displayLine, createdAt: new Date().toISOString() });
    localStorage.setItem(recordsKey, JSON.stringify(filtered.slice(0, 15)));
  } catch { /* ignore */ }
}
export function getSessionRecords(): SessionRecord[] {
  try {
    const raw = localStorage.getItem(recordsKey);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const personaNameByAge: Record<string, string> = {
  "18-25岁": "小林",
  "26-35岁": "陈小姐",
  "36岁以上": "王女士",
};

function trimConcern(concern?: string) {
  return concern?.trim().replace(/\s+/g, " ");
}

export function hasRequiredPersonaTags(tags: Partial<PersonaTags>): tags is PersonaTags {
  return Boolean(tags.ageRange && tags.skinType && tags.sensitivity);
}

export function buildPersonaPreview(tags: PersonaTags): PersonaPreview {
  const concern = trimConcern(tags.concern);
  const name = personaNameByAge[tags.ageRange] ?? "顾客";
  const displayLine = [tags.ageRange, tags.skinType, tags.sensitivity, concern].filter(Boolean).join("｜");
  const concernPart = concern ? `，主要顾虑是${concern}` : "";
  const toleranceCopy = tags.sensitivity === "敏感肌" ? "对刺激和泛红比较警惕" : "希望在效果和使用感之间找到平衡";

  return {
    tags: {
      ageRange: tags.ageRange,
      skinType: tags.skinType,
      sensitivity: tags.sensitivity,
      concern,
    },
    displayLine,
    name,
    ageLabel: tags.ageRange,
    avatar: name.slice(0, 1).toUpperCase(),
    tagLabels: [tags.ageRange, tags.skinType, tags.sensitivity],
    background: `${name}，${tags.ageRange}，${tags.skinType}，${tags.sensitivity}。${toleranceCopy}${concernPart}。`,
    trainingGoal: "先识别顾客真实担忧，再用安心、专业、可执行的方式推进推荐。",
  };
}

export function profileToPersonaPreview(profile: CustomerProfile): PersonaPreview {
  const fallbackTags: PersonaTags = profile.tags ?? {
    ageRange: "",
    skinType: profile.skinType,
    sensitivity: profile.tolerance === "low" ? "敏感肌" : "非敏感肌",
    concern: profile.concerns[0],
  };

  return {
    tags: fallbackTags,
    displayLine: profile.displayLine ?? [profile.skinType, fallbackTags.sensitivity].filter(Boolean).join("｜"),
    name: profile.persona,
    ageLabel: fallbackTags.ageRange,
    avatar: profile.persona.slice(0, 1).toUpperCase(),
    tagLabels: [fallbackTags.ageRange, profile.skinType, fallbackTags.sensitivity].filter(Boolean),
    background: profile.background,
    trainingGoal: "理解顾客真正的担忧，给出让她感到安心、可执行的入门建议。",
  };
}

export function saveSessionPersona(sessionId: string, persona: PersonaPreview) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${storagePrefix}${sessionId}`, JSON.stringify(persona));
}

export function readSessionPersona(sessionId: string): PersonaPreview | null {
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(`${storagePrefix}${sessionId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersonaPreview;
  } catch {
    window.sessionStorage.removeItem(`${storagePrefix}${sessionId}`);
    return null;
  }
}
