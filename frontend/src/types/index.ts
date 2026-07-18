export type SalesStage = "opening" | "probing" | "objection" | "recommending" | "closing";
export type CoachType = "probe" | "halt" | "halt_with_champion" | "feedback" | "summary" | "champion_replay";

export interface PersonaTags {
  ageRange: string;
  skinType: string;
  sensitivity: string;
  concern?: string;
}

export interface PersonaPreview {
  tags: PersonaTags;
  displayLine: string;
  name: string;
  ageLabel: string;
  avatar: string;
  tagLabels: string[];
  background: string;
  trainingGoal: string;
}

export interface CustomerProfile {
  persona: string;
  skinType: string;
  goal: string;
  concerns: string[];
  tolerance: "low" | "medium" | "high";
  background: string;
  tags?: PersonaTags;
  displayLine?: string;
}

export interface PersonaResult {
  displayLine: string;
  customerProfile: CustomerProfile;
  initialMessage: string;
  trainingGoal?: string;
}

export interface CustomerState {
  trust: number;
  purchaseIntent: number;
  irritationFear: number;
  addressedConcerns: string[];
  collectedInfo: string[];
  currentStage: SalesStage;
}

export interface Dimensions {
  listening: number;
  professionalism: number;
  recommendation: number;
  objectionHandling: number;
  warmth: number;
}

export type DimensionReasoning = Record<keyof Dimensions, any>;

export interface CriticalMoment {
  turn: number;
  type: "missed_concern" | "good_probe" | "objection_raised" | "buying_signal" | "premature_recommendation";
  description: string;
}

export interface ReplayTurn {
  turn: number;
  baMessage: string;
  customerMessage: string;
  note: string;
  originalBaMessage?: string;
  championMessage?: string;
  scenario?: "probe_skipped" | "objection_missed" | "closing";
  tags?: string[];
}

export interface Message {
  id: string;
  turn: number;
  role: "ba" | "customer" | "coach";
  content: string;
  timestamp: string;
  coachType?: CoachType;
  metadata?: {
    turn?: number;
    stage?: SalesStage;
    dimensions?: Dimensions;
    criticalMoments?: CriticalMoment[];
    replayTurns?: ReplayTurn[];
    requiresAction?: boolean;
    actionLabel?: string;
    // 结局卡相关（仅 summary 消息）
    outcome?: "deal" | "churn" | "follow_up";
    outcomeTitle?: string;
    finalState?: { trust: number; intent: number; irritation_fear: number };
    highlightSteps?: string[];
    nextSuggestion?: string;
  };
}

export interface Session {
  sessionId: string;
  scenarioId: string;
  status: "active" | "halted" | "completed";
  createdAt: string;
  customerProfile: CustomerProfile;
  customerState: CustomerState;
  dimensions: Dimensions;
  dimensionReasoning: DimensionReasoning;
  messages: Message[];
  baTurnCount: number;
}

export interface Scenario {
  id: string;
  title: string;
  customerProfile: CustomerProfile;
  initialMessage: string;
}

/** 案例复盘相关类型 */

export interface CaseAnalysisResult {
  practiceId: string;
  summary: string;
  keyIssues: string[];
  totalScore: number;
  dimensions: Dimensions;
  keyMoments: CriticalMoment[];
  championReplay: {
    title: string;
    rounds: ReplayTurn[];
  };
}

export interface PracticeMessage {
  id: string;
  role: "customer" | "champion";
  content: string;
}
