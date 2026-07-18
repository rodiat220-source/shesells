import type { Dimensions, Message } from "@/src/types";
import { criticalMoments, replayTurns, summaryDimensions, summaryText } from "@/src/lib/data/mock";

const timestamp = "2026-07-14T10:00:00.000Z";

export interface CoachStateFixture {
  id: string;
  title: string;
  description: string;
  trigger: string;
  expectedUi: string;
  messages: Message[];
  dimensions?: Dimensions;
  isLoading?: boolean;
  isHalted?: boolean;
}

export interface DemoConversationStep {
  step: string;
  userAction: string;
  expectedUi: string;
  note: string;
}

export const demoConversationScript: DemoConversationStep[] = [
  {
    step: "第 1 轮",
    userAction: "我推荐你直接买这套早 C 晚 A，很适合你。",
    expectedUi: "触发 probe，出现淡黄色“教练提示”，输入框保持可用。",
    note: "演示 BA 跳过探询时，教练会温和拉回需求了解。",
  },
  {
    step: "第 2 轮",
    userAction: "很多人都在用，效果也不错。",
    expectedUi: "触发 halt，红色“停一下”卡片内出现“明白了吗？”确认区。",
    note: "演示顾客连续表达担心后，BA 仍然没有接住顾虑，教练会强介入。点击卡片里的“明白了，继续”后再往下演。",
  },
  {
    step: "第 3 轮",
    userAction: "你担心刺痛是很正常的，我们先从低浓度、低频率开始，搭配修护霜观察两周。",
    expectedUi: "触发 feedback，输入恢复，左侧实时雷达图更新。",
    note: "演示被喊停后，BA 按教练建议修正回应，会得到即时正向反馈。",
  },
  {
    step: "第 4 轮",
    userAction: "如果你能接受，我们先选温和 VC、低浓度 A 醇和修护霜，先低频建立耐受。",
    expectedUi: "继续触发 feedback，顾客继续追问，演示对话不会在 5 轮后断掉。",
    note: "演示推荐阶段仍然可以持续对话，mock 不再有硬性的短轮数终点。",
  },
  {
    step: "结束训练",
    userAction: "点击“结束训练”。",
    expectedUi: "当前对话流内依次出现 summary 和 champion_replay。",
    note: "演示复盘不跳页，最终评分和销冠对比都在当前对话里展开。",
  },
];

const openingCustomer: Message = {
  id: "fixture_customer_opening",
  turn: 0,
  role: "customer",
  content: "你好，我最近看到早 C 晚 A 很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？",
  timestamp,
};

const baProbeTrigger: Message = {
  id: "fixture_ba_probe",
  turn: 1,
  role: "ba",
  content: "我推荐你直接买这套早 C 晚 A，很适合你。",
  timestamp,
};

const baFeedbackTrigger: Message = {
  id: "fixture_ba_feedback",
  turn: 1,
  role: "ba",
  content: "我理解你担心刺痛，我们先了解一下你之前有没有用过 A 醇或酸类产品。",
  timestamp,
};

const baHaltTrigger: Message = {
  id: "fixture_ba_halt",
  turn: 2,
  role: "ba",
  content: "很多人都在用，效果也不错。",
  timestamp,
};

export const coachStateFixtures: CoachStateFixture[] = [
  {
    id: "probe",
    title: "主动追问 probe",
    description: "BA 跳过探询直接推荐时，教练用轻量提示把用户拉回需求了解。",
    trigger: "我推荐你直接买这套早 C 晚 A，很适合你。",
    expectedUi: "淡黄色教练提示卡片，输入框保持可用。",
    dimensions: {
      listening: 52,
      professionalism: 64,
      recommendation: 55,
      objectionHandling: 48,
      warmth: 62,
    },
    messages: [
      openingCustomer,
      baProbeTrigger,
      {
        id: "fixture_coach_probe",
        turn: 1,
        role: "coach",
        coachType: "probe",
        content: "等等，先别急着推荐。她刚刚说自己是敏感肌，你还需要了解她的使用史和耐受情况。试着先问一个问题。",
        timestamp,
        metadata: { stage: "probing", requiresAction: false },
      },
      {
        id: "fixture_customer_probe",
        turn: 1,
        role: "customer",
        content: "我之前没用过 A 醇，换季的时候还挺容易泛红的。是不是不太适合我？",
        timestamp,
      },
    ],
  },
  {
    id: "feedback",
    title: "即时反馈 feedback",
    description: "BA 先共情再探询时，教练即时强化正确动作，但不打断对话。",
    trigger: "我理解你担心刺痛，我们先了解一下你之前有没有用过 A 醇或酸类产品。",
    expectedUi: "蓝绿色教练反馈卡片，输入框保持可用。",
    dimensions: {
      listening: 76,
      professionalism: 70,
      recommendation: 61,
      objectionHandling: 68,
      warmth: 82,
    },
    messages: [
      openingCustomer,
      baFeedbackTrigger,
      {
        id: "fixture_coach_feedback",
        turn: 1,
        role: "coach",
        coachType: "feedback",
        content: "很好，你先接住了她对敏感和刺痛的担心，再把建议说成可控的小步骤。这样的回应会让顾客更愿意继续听你解释。",
        timestamp,
        metadata: { stage: "probing", requiresAction: false },
      },
      {
        id: "fixture_customer_feedback",
        turn: 1,
        role: "customer",
        content: "我没用过 A 醇，换季的时候会泛红，所以有点怕不适合我。",
        timestamp,
      },
    ],
  },
  {
    id: "halt",
    title: "主动喊停 halt",
    description: "BA 连续忽略顾客对刺痛和敏感的担心，教练强介入并暂停输入。",
    trigger: "第 2 轮输入：很多人都在用，效果也不错。",
    expectedUi: "红色教练喊停卡片，卡片内出现“明白了吗？”和“明白了，继续”。",
    dimensions: {
      listening: 56,
      professionalism: 68,
      recommendation: 64,
      objectionHandling: 50,
      warmth: 62,
    },
    isHalted: true,
    messages: [
      openingCustomer,
      {
        id: "fixture_ba_halt_1",
        turn: 1,
        role: "ba",
        content: "这个产品很温和，不会刺激。",
        timestamp,
      },
      {
        id: "fixture_customer_halt_1",
        turn: 1,
        role: "customer",
        content: "可是我最担心的还是刺痛，之前换季也会泛红。",
        timestamp,
      },
      baHaltTrigger,
      {
        id: "fixture_coach_halt",
        turn: 2,
        role: "coach",
        coachType: "halt",
        content: "停一下——她已经不止一次提到怕刺痛，但你的回应还没有真正接住这个顾虑。先让她感到被理解，再给方案。",
        timestamp,
        metadata: { stage: "objection", requiresAction: true, actionLabel: "明白了，继续" },
      },
    ],
  },
  {
    id: "loading",
    title: "顾客思考 loading",
    description: "BA 刚发送消息后，等待顾客和教练返回时的状态。",
    trigger: "任意有效回复发送后。",
    expectedUi: "消息流底部出现三点思考动画，发送按钮禁用。",
    isLoading: true,
    messages: [openingCustomer, baFeedbackTrigger],
  },
  {
    id: "summary",
    title: "训练总结 summary",
    description: "点击结束训练后，教练在当前对话流里展示最终评分和关键时刻。",
    trigger: "点击“结束训练”。",
    expectedUi: "较大的训练总结卡片，包含综合表现、雷达图和关键时刻。",
    dimensions: summaryDimensions,
    messages: [
      openingCustomer,
      baFeedbackTrigger,
      {
        id: "fixture_coach_summary",
        turn: 4,
        role: "coach",
        coachType: "summary",
        content: summaryText,
        timestamp,
        metadata: {
          dimensions: summaryDimensions,
          criticalMoments,
        },
      },
    ],
  },
  {
    id: "champion_replay",
    title: "销冠对比 champion_replay",
    description: "summary 之后展示优秀顾问如何处理同类顾虑。",
    trigger: "点击“结束训练”后，紧接 summary 出现。",
    expectedUi: "对话流内的销冠回放卡片，逐轮展示话术和技巧说明。",
    dimensions: summaryDimensions,
    messages: [
      openingCustomer,
      {
        id: "fixture_coach_replay",
        turn: 4,
        role: "coach",
        coachType: "champion_replay",
        content: "同样面对一位怕刺激的敏感肌顾客，来看看优秀顾问如何一步步建立安全感。",
        timestamp,
        metadata: { replayTurns },
      },
    ],
  },
];
