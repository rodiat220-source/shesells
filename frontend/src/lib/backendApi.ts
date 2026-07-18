import type {
  CaseAnalysisResult,
  CoachType,
  CriticalMoment,
  CustomerProfile,
  CustomerState,
  DimensionReasoning,
  Dimensions,
  Message,
  PersonaResult,
  ReplayTurn,
  SalesStage,
  Scenario,
  Session,
} from "@/src/types";

const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? "").replace(/\/$/, "");
const scenarioId = "sensitive_early_c_late_a";

interface BackendEnvelope<T> {
  code: number;
  data?: T;
  message?: string;
}

interface BackendCustomerProfile {
  name: string;
  age: number;
  skin_type: string;
  experience: string;
  tolerance: string;
  concern: string;
  display_line?: string;
  tags?: {
    age_range?: string;
    skin_type?: string;
    sensitivity?: string;
    concern?: string;
  };
  training_goal?: string;
}

interface BackendDimensionScores {
  listening?: number;
  warmth?: number;
  empathy?: number;
  professionalism?: number;
  objection_handling?: number;
  objectionHandling?: number;
  recommendation?: number;
}

interface BackendDimensionWithReasoning {
  score?: number;
  reasoning?: string;
}

interface BackendFinalDimensions {
  listening?: BackendDimensionWithReasoning | number;
  warmth?: BackendDimensionWithReasoning | number;
  empathy?: BackendDimensionWithReasoning | number;
  professionalism?: BackendDimensionWithReasoning | number;
  objection_handling?: BackendDimensionWithReasoning | number;
  objectionHandling?: BackendDimensionWithReasoning | number;
  recommendation?: BackendDimensionWithReasoning | number;
}

interface BackendMessage {
  role: string;
  content: string;
  type?: string | null;
  requires_action?: boolean;
}

interface BackendCustomerState {
  trust?: number;
  intent?: number;
  irritation_fear?: number;
  addressed_concerns?: string[];
  collected_info?: string[];
  current_stage?: string;
}

interface BackendSessionCreateData {
  session_id: string;
  customer_profile: BackendCustomerProfile;
  stage: string;
  initial_customer_message: string;
  dimensions: BackendDimensionScores;
  customer_state?: BackendCustomerState;
  persona_profile?: BackendPersonaCustomerProfile;
}

interface BackendChatData {
  messages: BackendMessage[];
  stage: string;
  dimensions: BackendDimensionScores;
  dimension_reasoning?: BackendFinalDimensions;
  status: string;
  customer_state?: BackendCustomerState;
}

interface BackendSessionData {
  session_id: string;
  customer_profile: BackendCustomerProfile;
  messages: BackendMessage[];
  stage: string;
  dimensions: BackendDimensionScores;
  dimension_reasoning?: BackendFinalDimensions;
  status: string;
  customer_state?: BackendCustomerState;
  ba_turn_count?: number;
  persona_profile?: BackendPersonaCustomerProfile;
  finish_data?: any;
}

interface BackendKeyMoment {
  turn: number;
  description: string;
  type: string;
}

interface BackendChampionRound {
  turn: number;
  customer_message?: string | null;
  ba_reply: string;
  champion_reply: string;
  skill_tags: string[];
}

interface BackendFinishData {
  summary: string;
  total_score: number;
  dimensions: BackendFinalDimensions;
  key_moments: BackendKeyMoment[];
  champion_replay: {
    title?: string;
    rounds?: BackendChampionRound[];
  };
  status: string;
  outcome?: string;               // 结局：deal / churn / follow_up
  outcome_title?: string;          // 结局标题
  final_state?: {                  // 顾客隐状态终值
    trust: number;
    intent: number;
    irritation_fear: number;
  };
  highlight_steps?: string[];      // 做对的关键步骤
  next_suggestion?: string;        // 一条核心建议
}

interface BackendCaseAnalysisData {
  practice_id: string;
  summary: string;
  key_issues: string[];
  total_score: number;
  dimensions: BackendFinalDimensions;
  key_moments: BackendKeyMoment[];
  champion_replay: {
    title?: string;
    rounds?: BackendChampionRound[];
  };
}

interface BackendCasePracticeData {
  champion_reply: string;
}

async function backendRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${backendBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const envelope = (await response.json()) as BackendEnvelope<T>;

  if (!response.ok || envelope.code !== 0 || envelope.data === undefined) {
    throw new Error(envelope.message ?? "后端接口请求失败");
  }

  return envelope.data;
}

interface BackendPersonaTags {
  age: string;
  oiliness: string;
  sensitivity: string;
  concern_text?: string;
}

interface BackendPersonaCustomerProfile {
  persona: string;
  skin_type: string;
  goal: string;
  concerns: string[];
  tolerance: string;
  background: string;
  tags: BackendPersonaTags;
  display_line: string;
}

interface BackendPersonaData {
  display_line: string;
  customer_profile: BackendPersonaCustomerProfile;
  initial_message: string;
}

export async function generatePersona(tags: {
  age: string;
  oiliness: string;
  sensitivity: string;
  concernText?: string;
}): Promise<PersonaResult> {
  const data = await backendRequest<BackendPersonaData>("/api/persona", {
    method: "POST",
    body: JSON.stringify({
      age: tags.age,
      oiliness: tags.oiliness,
      sensitivity: tags.sensitivity,
      concern_text: tags.concernText || null,
    }),
  });

  return {
    displayLine: data.display_line,
    customerProfile: {
      persona: data.customer_profile.persona,
      skinType: data.customer_profile.skin_type,
      goal: data.customer_profile.goal,
      concerns: data.customer_profile.concerns,
      tolerance: data.customer_profile.tolerance as "low" | "medium" | "high",
      background: data.customer_profile.background,
      tags: {
        ageRange: data.customer_profile.tags.age === "18-25" ? "18-25岁" : data.customer_profile.tags.age === "26-35" ? "26-35岁" : "36岁以上",
        skinType: data.customer_profile.tags.oiliness === "dry" ? "干皮" : data.customer_profile.tags.oiliness === "oily" ? "油皮" : "混合皮",
        sensitivity: data.customer_profile.tags.sensitivity === "sensitive" ? "敏感肌" : "非敏感肌",
        concern: data.customer_profile.tags.concern_text,
      },
      displayLine: data.display_line,
    },
    initialMessage: data.initial_message,
  };
}

export async function createTrainingSession(persona?: {
  customerProfile: PersonaResult["customerProfile"];
  initialMessage: string;
  coachStyle?: string;
}) {
  const body = persona
    ? {
        customer_profile: {
          persona: persona.customerProfile.persona,
          skin_type: persona.customerProfile.skinType,
          goal: persona.customerProfile.goal,
          concerns: persona.customerProfile.concerns,
          tolerance: persona.customerProfile.tolerance,
          background: persona.customerProfile.background,
          tags: persona.customerProfile.tags,
          display_line: persona.customerProfile.displayLine,
        },
        initial_message: persona.initialMessage,
        coach_style: persona.coachStyle ?? "gentle",
      }
    : { scenario_id: scenarioId, coach_style: "gentle" };

  const data = await backendRequest<BackendSessionCreateData>("/api/session", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return {
    sessionId: data.session_id,
    scenario: mapScenario(data),
  };
}

export async function loadTrainingSession(sessionId: string): Promise<Session> {
  const data = await backendRequest<BackendSessionData>(`/api/session/${encodeURIComponent(sessionId)}`);
  return mapSession(data);
}

export async function sendTrainingMessage(sessionId: string, message: string, turn: number) {
  const data = await backendRequest<BackendChatData>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, message }),
  });

  return {
    newMessages: mapBackendMessages(data.messages, turn),
    updatedState: data.customer_state
      ? mapCustomerState(data.customer_state, data.stage)
      : { currentStage: mapStage(data.stage) },
    updatedDimensions: mapDimensions(data.dimensions),
    updatedDimensionReasoning: mapDimensionReasoning(data.dimension_reasoning),
    sessionStatus: mapStatus(data.status),
  };
}

export async function continueTrainingSession(sessionId: string) {
  const data = await backendRequest<BackendChatData>("/api/chat/continue", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });

  return {
    updatedState: data.customer_state
      ? mapCustomerState(data.customer_state, data.stage)
      : undefined,
    updatedDimensions: mapDimensions(data.dimensions),
    updatedDimensionReasoning: mapDimensionReasoning(data.dimension_reasoning),
    sessionStatus: mapStatus(data.status),
  };
}

export async function finishTrainingSession(sessionId: string, turn: number) {
  const data = await backendRequest<BackendFinishData>("/api/finish", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });

  const dimensions = mapFinalDimensions(data.dimensions);
  return {
    newMessages: [
      {
        id: `summary_${Date.now()}`,
        turn,
        role: "coach",
        coachType: "summary",
        content: data.summary,
        timestamp: new Date().toISOString(),
        metadata: {
          dimensions,
          criticalMoments: mapCriticalMoments(data.key_moments),
          outcome: (data.outcome ?? "follow_up") as "deal" | "churn" | "follow_up",
          outcomeTitle: data.outcome_title ?? "",
          finalState: data.final_state,
          highlightSteps: data.highlight_steps ?? [],
          nextSuggestion: data.next_suggestion ?? "",
        },
      },
      {
        id: `replay_${Date.now()}`,
        turn,
        role: "coach",
        coachType: "champion_replay",
        content: data.champion_replay?.title ?? "优秀示范",
        timestamp: new Date().toISOString(),
        metadata: {
          replayTurns: mapReplayTurns(data.champion_replay?.rounds ?? []),
        },
      },
    ] satisfies Message[],
    updatedDimensions: dimensions,
    sessionStatus: mapStatus(data.status),
  };
}

export async function analyzeCase(narrative: string): Promise<CaseAnalysisResult> {
  const data = await backendRequest<BackendCaseAnalysisData>("/api/case-analysis", {
    method: "POST",
    body: JSON.stringify({ narrative }),
  });

  return {
    practiceId: data.practice_id,
    summary: data.summary,
    keyIssues: data.key_issues ?? [],
    totalScore: data.total_score,
    dimensions: mapFinalDimensions(data.dimensions),
    keyMoments: mapCriticalMoments(data.key_moments ?? []),
    championReplay: {
      title: data.champion_replay?.title ?? "销冠示范",
      rounds: mapReplayTurns(data.champion_replay?.rounds ?? []),
    },
  };
}

export async function sendPracticeMessage(practiceId: string, message: string): Promise<string> {
  const data = await backendRequest<BackendCasePracticeData>("/api/case-practice", {
    method: "POST",
    body: JSON.stringify({ practice_id: practiceId, message }),
  });

  return data.champion_reply;
}

function mapScenario(data: BackendSessionCreateData): Scenario {
  return {
    id: scenarioId,
    title: "敏感肌想试早 C 晚 A",
    customerProfile: mapCustomerProfile(data.customer_profile, data.persona_profile),
    initialMessage: data.initial_customer_message,
  };
}

function mapSession(data: BackendSessionData): Session {
  const messages = mapBackendMessages(data.messages);
  // 从持久化的 finish_data 恢复总结和销冠示范消息
  if (data.finish_data) {
    const fd = data.finish_data;
    const dims = mapFinalDimensions(fd.dimensions ?? {});
    const turn = messages.filter((m) => m.role === "ba").length;
    messages.push({
      id: "summary_restored", turn, role: "coach", coachType: "summary",
      content: fd.summary ?? "", timestamp: new Date().toISOString(),
      metadata: {
        dimensions: dims,
        criticalMoments: mapCriticalMoments(fd.key_moments ?? []),
        outcome: (fd.outcome ?? "follow_up") as "deal" | "churn" | "follow_up",
        outcomeTitle: fd.outcome_title ?? "",
        finalState: fd.final_state,
        highlightSteps: fd.highlight_steps ?? [],
        nextSuggestion: fd.next_suggestion ?? "",
      },
    } as Message);
    messages.push({
      id: "replay_restored", turn, role: "coach", coachType: "champion_replay",
      content: fd.champion_replay?.title ?? "优秀示范",
      timestamp: new Date().toISOString(),
      metadata: { replayTurns: mapReplayTurns(fd.champion_replay?.rounds ?? []) },
    } as Message);
  }
  return {
    sessionId: data.session_id,
    scenarioId,
    status: mapStatus(data.status),
    createdAt: new Date().toISOString(),
    customerProfile: mapCustomerProfile(data.customer_profile, data.persona_profile),
    customerState: mapCustomerState(data.customer_state, data.stage),
    dimensions: mapDimensions(data.dimensions),
    dimensionReasoning: mapDimensionReasoning(data.dimension_reasoning),
    messages,
    baTurnCount: data.ba_turn_count ?? messages.filter((message) => message.role === "ba").length,
  };
}

function mapCustomerProfile(profile: BackendCustomerProfile, personaProfile?: BackendPersonaCustomerProfile): CustomerProfile {
  const tags = profile.tags
    ? {
        ageRange: profile.tags.age_range ?? "",
        skinType: profile.tags.skin_type ?? profile.skin_type,
        sensitivity: profile.tags.sensitivity ?? (profile.tolerance.includes("低") ? "敏感肌" : "非敏感肌"),
        concern: profile.tags.concern ?? profile.concern,
      }
    : undefined;

  return {
    persona: personaProfile?.persona ?? profile.name,
    skinType: personaProfile?.skin_type ?? profile.skin_type,
    goal: personaProfile?.goal ?? "try_early_c_late_a",
    concerns: personaProfile?.concerns ?? [profile.concern],
    tolerance: personaProfile?.tolerance
      ? (personaProfile.tolerance.includes("低") ? "low" : personaProfile.tolerance.includes("高") ? "high" : "medium")
      : (profile.tolerance.includes("低") ? "low" : profile.tolerance.includes("高") ? "high" : "medium"),
    background: personaProfile?.background ?? `${profile.name}，${profile.age} 岁，${profile.skin_type}，${profile.experience}，${profile.tolerance}，核心顾虑：${profile.concern}。`,
    tags: personaProfile?.tags ? {
      ageRange: personaProfile.tags.age ?? tags?.ageRange ?? "",
      skinType: profile.skin_type,
      sensitivity: personaProfile.tags.sensitivity ?? tags?.sensitivity ?? (profile.tolerance.includes("低") ? "敏感肌" : "非敏感肌"),
      concern: personaProfile.tags.concern_text ?? tags?.concern ?? profile.concern,
    } : tags,
    displayLine: personaProfile?.display_line ?? profile.display_line,
  };
}

function mapDimensions(dimensions: BackendDimensionScores): Dimensions {
  return {
    listening: dimensions.listening ?? 0,
    warmth: dimensions.warmth ?? dimensions.empathy ?? 0,
    professionalism: dimensions.professionalism ?? 0,
    objectionHandling: dimensions.objection_handling ?? dimensions.objectionHandling ?? 0,
    recommendation: dimensions.recommendation ?? 0,
  };
}

function mapFinalDimensions(dimensions: BackendFinalDimensions): Dimensions {
  return {
    listening: readScore(dimensions.listening),
    warmth: readScore(dimensions.warmth ?? dimensions.empathy),
    professionalism: readScore(dimensions.professionalism),
    objectionHandling: readScore(dimensions.objection_handling ?? dimensions.objectionHandling),
    recommendation: readScore(dimensions.recommendation),
  };
}

function mapDimensionReasoning(dimensions?: BackendFinalDimensions): DimensionReasoning {
  return {
    listening: readReasoning(dimensions?.listening),
    warmth: readReasoning(dimensions?.warmth ?? dimensions?.empathy),
    professionalism: readReasoning(dimensions?.professionalism),
    objectionHandling: readReasoning(dimensions?.objection_handling ?? dimensions?.objectionHandling),
    recommendation: readReasoning(dimensions?.recommendation),
  };
}

function readScore(value: BackendDimensionWithReasoning | number | undefined): number {
  if (typeof value === "number") return value;
  return value?.score ?? 0;
}

function readReasoning(value: BackendDimensionWithReasoning | number | undefined): string {
  return typeof value === "object" && value?.reasoning ? value.reasoning : "本轮暂无评分依据。";
}

function mapBackendMessages(messages: BackendMessage[], forcedTurn?: number): Message[] {
  let currentTurn = 0;

  return messages.map((message, index) => {
    const role = mapRole(message.role);
    if (forcedTurn !== undefined) {
      currentTurn = forcedTurn;
    } else if (role === "ba") {
      currentTurn += 1;
    }

    const coachType = role === "coach" ? mapCoachType(message.type) : undefined;
    return {
      id: `${role}_${forcedTurn ?? currentTurn}_${index}`,
      turn: forcedTurn ?? currentTurn,
      role,
      content: message.content,
      timestamp: new Date().toISOString(),
      coachType,
      metadata: role === "coach"
        ? {
            requiresAction: message.requires_action,
            actionLabel: message.requires_action ? "明白了，继续" : undefined,
          }
        : undefined,
    };
  });
}

function mapRole(role: string): Message["role"] {
  if (role === "ba" || role === "customer" || role === "coach") return role;
  return "coach";
}

function mapCoachType(type: string | null | undefined): CoachType | undefined {
  if (type === "probe" || type === "halt" || type === "feedback") return type;
  return "feedback";
}

function mapStatus(status: string): Session["status"] {
  if (status === "halted" || status === "completed") return status;
  return "active";
}

function mapStage(stage: string): SalesStage {
  if (stage === "opening" || stage === "probing" || stage === "objection" || stage === "recommending" || stage === "closing") {
    return stage;
  }
  return "opening";
}

function mapCustomerState(state: BackendCustomerState | undefined, stage: string): CustomerState {
  return {
    trust: state?.trust ?? 50,
    purchaseIntent: state?.intent ?? 30,
    irritationFear: state?.irritation_fear ?? 70,
    addressedConcerns: state?.addressed_concerns ?? [],
    collectedInfo: state?.collected_info ?? [],
    currentStage: mapStage(state?.current_stage ?? stage),
  };
}

function mapCriticalMoments(moments: BackendKeyMoment[]): CriticalMoment[] {
  return moments.map((moment) => ({
    turn: moment.turn,
    description: moment.description,
    type: moment.type === "good" ? "good_probe" : "missed_concern",
  }));
}

function mapReplayTurns(rounds: BackendChampionRound[]): ReplayTurn[] {
  return rounds.map((round) => ({
    turn: round.turn,
    baMessage: round.champion_reply,
    customerMessage: round.customer_message ?? "这一轮出现了可复盘的顾客信号。",
    note: round.skill_tags.length > 0 ? round.skill_tags.join("、") : "先接住顾虑，再给出清晰可执行的建议。",
    originalBaMessage: round.ba_reply,
    championMessage: round.champion_reply,
    tags: round.skill_tags,
  }));
}

