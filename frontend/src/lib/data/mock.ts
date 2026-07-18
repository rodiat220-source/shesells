import type { CriticalMoment, Message, ReplayTurn, Scenario, Session } from "@/src/types";

export const scenario: Scenario = {
  id: "sensitive_early_c_late_a",
  title: "敏感肌想试早 C 晚 A",
  customerProfile: {
    persona: "sensitive_skincare_newbie",
    skinType: "sensitive",
    goal: "try_early_c_late_a",
    concerns: ["afraid_of_irritation", "unsure_concentration", "afraid_of_breakout"],
    tolerance: "low",
    background: "25 岁女性，敏感肌，想尝试早 C 晚 A，但担心刺痛和屏障受损。",
  },
  initialMessage: "你好，我最近看到早 C 晚 A 很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？",
};

export const initialCustomerMessage = (): Message => ({
  id: "msg_initial",
  turn: 0,
  role: "customer",
  content: scenario.initialMessage,
  timestamp: new Date().toISOString(),
});

export function createMockSession(sessionId: string): Session {
  return {
    sessionId,
    scenarioId: scenario.id,
    status: "active",
    createdAt: new Date().toISOString(),
    customerProfile: scenario.customerProfile,
    customerState: {
      trust: 30,
      purchaseIntent: 20,
      irritationFear: 80,
      addressedConcerns: [],
      collectedInfo: [],
      currentStage: "opening",
    },
    dimensions: {
      listening: 58,
      professionalism: 60,
      recommendation: 52,
      objectionHandling: 48,
      warmth: 64,
    },
    dimensionReasoning: {
      listening: "本轮暂无评分依据。",
      professionalism: "本轮暂无评分依据。",
      recommendation: "本轮暂无评分依据。",
      objectionHandling: "本轮暂无评分依据。",
      warmth: "本轮暂无评分依据。",
    },
    messages: [initialCustomerMessage()],
    baTurnCount: 0,
  };
}

export const replayTurns: ReplayTurn[] = [
  {
    turn: 1,
    scenario: "probe_skipped",
    originalBaMessage: "我推荐你直接买这套早 C 晚 A，很适合你。",
    championMessage: "理解！早 C 晚 A 确实效果好，但敏感肌一定要小心。你先跟我说说，平时皮肤容易泛红吗？换季会不会刺痒？之前用过 A 醇或酸类吗？",
    baMessage: "理解！早 C 晚 A 确实效果好，但敏感肌一定要小心。你先跟我说说，平时皮肤容易泛红吗？换季会不会刺痒？之前用过 A 醇或酸类吗？",
    customerMessage: "我之前没用过 A 醇，换季的时候还挺容易泛红的。",
    note: "先共情，再用三连问收集信息，避免没有依据就推荐。",
    tags: ["先共情", "三连问", "不急着推荐"],
  },
  {
    turn: 2,
    scenario: "objection_missed",
    originalBaMessage: "很多人都在用，效果也不错。",
    championMessage: "你担心刺痛很正常，敏感肌确实不能一上来就猛用。我们可以把安全感放第一位：先低浓度、低频率，再搭配修护霜观察两周。",
    baMessage: "你担心刺痛很正常，敏感肌确实不能一上来就猛用。我们可以把安全感放第一位：先低浓度、低频率，再搭配修护霜观察两周。",
    customerMessage: "我最担心的还是刺痛。如果一开始不耐受，是不是皮肤会变得更敏感？",
    note: "不要用大众背书压过顾虑，要先复述担心，再给出可控方案。",
    tags: ["接住异议", "低频低浓度", "给安全感"],
  },
  {
    turn: 3,
    scenario: "closing",
    originalBaMessage: "那就买温和 VC、低浓度 A 醇和修护霜吧。",
    championMessage: "如果你想先稳妥试试，可以从三样开始：温和 VC、低浓度 A 醇和修护霜。前两周每周两次晚间用 A 醇，白天做好防晒；如果没有刺痛泛红，再慢慢加频率。",
    baMessage: "如果你想先稳妥试试，可以从三样开始：温和 VC、低浓度 A 醇和修护霜。前两周每周两次晚间用 A 醇，白天做好防晒；如果没有刺痛泛红，再慢慢加频率。",
    customerMessage: "这个节奏挺清楚的，我愿意先试试。",
    note: "促单不是催买，而是降低决策成本，把选择变成清晰的小步骤。",
    tags: ["降低决策成本", "步骤清晰", "可执行"],
  },
];

export const criticalMoments: CriticalMoment[] = [
  { turn: 1, type: "good_probe", description: "主动询问使用史，没有急着推荐产品。" },
  { turn: 2, type: "missed_concern", description: "顾客再次提到刺痛，但回应还可以更具体。" },
  { turn: 3, type: "buying_signal", description: "清晰的使用节奏降低了顾客的不确定感。" },
];

export const summaryText = "你很愿意倾听，也能用温和的语气建立信任。下一步，可以更早确认她对刺痛的担忧，并把建议说得更具体、可执行。";

export const summaryDimensions = {
  listening: 86,
  professionalism: 78,
  recommendation: 72,
  objectionHandling: 68,
  warmth: 90,
};

export const completedConversationMessages: Message[] = [
  {
    id: "history_customer_0",
    turn: 0,
    role: "customer",
    content: scenario.initialMessage,
    timestamp: "2026-07-13T05:40:00.000Z",
  },
  {
    id: "history_ba_1",
    turn: 1,
    role: "ba",
    content: "当然可以，我先了解一下，你之前有使用过 A 醇、酸类或者高浓度 VC 吗？平时换季会不会容易泛红刺痛？",
    timestamp: "2026-07-13T05:40:18.000Z",
  },
  {
    id: "history_coach_1",
    turn: 1,
    role: "coach",
    coachType: "feedback",
    content: "很好的开场。你先接住了敏感肌的担心，再询问使用史和耐受情况，没有急着推荐。",
    timestamp: "2026-07-13T05:40:22.000Z",
    metadata: { stage: "probing" },
  },
  {
    id: "history_customer_1",
    turn: 1,
    role: "customer",
    content: "我没用过 A 醇，换季的时候会泛红，所以有点怕不适合我。",
    timestamp: "2026-07-13T05:40:37.000Z",
  },
  {
    id: "history_ba_2",
    turn: 2,
    role: "ba",
    content: "理解，你最担心的是刺痛和屏障受损，对吗？那我们不建议一上来就每天用，可以先从低浓度、低频率开始。",
    timestamp: "2026-07-13T05:41:02.000Z",
  },
  {
    id: "history_customer_2",
    turn: 2,
    role: "customer",
    content: "对，我就是怕一开始不耐受，皮肤反而更敏感。",
    timestamp: "2026-07-13T05:41:16.000Z",
  },
  {
    id: "history_ba_3",
    turn: 3,
    role: "ba",
    content: "那我们先把安全感放第一位。前两周每周两次 A 醇，夹在修护霜中间用；白天 VC 也选温和型，并且一定配防晒。",
    timestamp: "2026-07-13T05:41:42.000Z",
  },
  {
    id: "history_customer_3",
    turn: 3,
    role: "customer",
    content: "这样听起来清楚很多。如果先买入门组合，你建议我从哪几样开始？",
    timestamp: "2026-07-13T05:41:58.000Z",
  },
  {
    id: "history_ba_4",
    turn: 4,
    role: "ba",
    content: "可以先从三样开始：温和 VC、低浓度 A 醇和修护霜。先建立耐受，不追求一步到位；如果两周后没有刺痛泛红，再慢慢加频率。",
    timestamp: "2026-07-13T05:42:25.000Z",
  },
  {
    id: "history_customer_4",
    turn: 4,
    role: "customer",
    content: "这个节奏我可以接受，感觉不会太冒险。",
    timestamp: "2026-07-13T05:42:39.000Z",
  },
];
