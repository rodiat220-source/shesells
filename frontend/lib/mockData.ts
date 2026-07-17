/**
 * AI 销售教练 - 模拟数据文件
 * 用于前端页面开发，模拟 5 轮对话场景
 */

// ============================================================
// 类型定义
// ============================================================

/** 顾客信息接口 */
export interface CustomerProfile {
  /** 顾客姓名 */
  name: string;
  /** 年龄 */
  age: number;
  /** 肤质 */
  skinType: string;
  /** 护肤经验 */
  experience: string;
  /** 耐受度 */
  tolerance: string;
  /** 核心顾虑 */
  concern: string;
  /** 头像字母 */
  avatar: string;
}

/** 评分维度名称接口 */
export interface DimensionNames {
  /** 倾听力 */
  listening: string;
  /** 共情力 */
  empathy: string;
  /** 专业度 */
  professionalism: string;
  /** 异议处理 */
  objectionHandling: string;
  /** 推荐力 */
  recommendation: string;
}

/** 教练类型 */
export type CoachType = 'probe' | 'halt' | 'feedback' | null;

/** 对话状态 */
export type ConversationStatus = 'active' | 'halted';

/** 对话阶段 */
export type ConversationStage = 'opening' | 'probing' | 'objection';

/** 雷达图数据接口 */
export interface RadarData {
  /** 倾听力分数 */
  listening: number;
  /** 共情力分数 */
  empathy: number;
  /** 专业度分数 */
  professionalism: number;
  /** 异议处理分数 */
  objectionHandling: number;
  /** 推荐力分数 */
  recommendation: number;
}

/** 单轮对话数据接口 */
export interface ConversationTurn {
  /** 轮次编号 */
  turn: number;
  /** 当前阶段 */
  stage: ConversationStage;
  /** BA 消息（null 表示无消息） */
  baMessage: string | null;
  /** 顾客消息（null 表示无消息） */
  customerMessage: string | null;
  /** 教练消息（null 表示无消息） */
  coachMessage: string | null;
  /** 教练类型（probe=追问, halt=喊停, feedback=反馈, null=无） */
  coachType: CoachType;
  /** 是否需要确认（仅 halt 类型为 true） */
  requiresAction: boolean;
  /** 该轮雷达图数据 */
  radarData: RadarData;
  /** 对话状态（active=进行中, halted=已暂停） */
  status: ConversationStatus;
}

/** 最终维度评分（含推理链） */
export interface FinalDimension {
  /** 维度分数 */
  score: number;
  /** 推理链（评分依据） */
  reasoning: string;
}

/** 最终五维评分 */
export interface FinalDimensions {
  /** 倾听力 */
  listening: FinalDimension;
  /** 共情力 */
  empathy: FinalDimension;
  /** 专业度 */
  professionalism: FinalDimension;
  /** 异议处理 */
  objectionHandling: FinalDimension;
  /** 推荐力 */
  recommendation: FinalDimension;
}

/** 关键时刻类型 */
export type KeyMomentType = 'good' | 'missed';

/** 关键时刻接口 */
export interface KeyMoment {
  /** 轮次编号 */
  turn: number;
  /** 时刻描述 */
  description: string;
  /** 类型（good=做得好, missed=错失机会） */
  type: KeyMomentType;
}

/** 销冠对比轮次接口 */
export interface ChampionComparisonTurn {
  /** BA 的实际回复 */
  baReply: string;
  /** 销冠的示范回复 */
  championReply: string;
  /** 技巧标签 */
  tags: string[];
}

/** 销冠对比接口 */
export interface ChampionComparison {
  /** 对比标题 */
  title: string;
  /** 对比轮次 */
  comparisons: ChampionComparisonTurn[];
}

/** 总结页数据接口 */
export interface SummaryData {
  /** 综合评分 */
  overallScore: number;
  /** 最终五维评分（含推理链） */
  finalDimensions: FinalDimensions;
  /** 总结文字 */
  summaryText: string;
  /** 关键时刻列表 */
  keyMoments: KeyMoment[];
  /** 销冠对比数据 */
  championComparison: ChampionComparison;
}

/** 完整对话数据接口 */
export interface Conversation {
  /** 所有对话轮次 */
  turns: ConversationTurn[];
  /** 总结页数据 */
  summary: SummaryData;
}

/** getAllMessages 返回的单条消息接口 */
export interface ChatMessage {
  /** 轮次编号 */
  turn: number;
  /** 角色（ba=BA, customer=顾客, coach=教练） */
  role: 'ba' | 'customer' | 'coach';
  /** 消息内容 */
  content: string;
  /** 教练类型（仅 coach 角色有值） */
  type?: CoachType;
  /** 是否需要确认（仅 coach 角色有值） */
  requiresAction?: boolean;
}

// ============================================================
// 数据定义
// ============================================================

/** 顾客信息 */
export const mockCustomerProfile: CustomerProfile = {
  name: '林小姐',
  age: 25,
  skinType: '敏感肌',
  experience: '护肤新手',
  tolerance: '低耐受',
  concern: '怕刺痛烂脸',
  avatar: 'L',
};

/** 5 个评分维度名称 */
export const DIMENSION_NAMES: DimensionNames = {
  listening: '倾听力',
  empathy: '共情力',
  professionalism: '专业度',
  objectionHandling: '异议处理',
  recommendation: '推荐力',
};

/** 完整对话数据 */
export const mockConversation: Conversation = {
  turns: [
    // 第1轮：开场（顾客发起，BA 无消息）
    {
      turn: 1,
      stage: 'opening',
      baMessage: null,
      customerMessage: '你好，我最近看到早C晚A很火，但我皮肤有点敏感，怕用了会刺痛烂脸，你能帮我看看吗？',
      coachMessage: null,
      coachType: null,
      requiresAction: false,
      radarData: {
        listening: 50,
        empathy: 50,
        professionalism: 45,
        objectionHandling: 45,
        recommendation: 40,
      },
      status: 'active',
    },
    // 第2轮：BA 跳过探询直接推荐，教练追问
    {
      turn: 2,
      stage: 'probing',
      baMessage: '我推荐你直接买这套早C晚A，很适合你',
      customerMessage: '我之前没用过A醇，换季的时候还挺容易泛红的。是不是不太适合我？',
      coachMessage: '等等，先别急着推荐。她刚刚说自己是敏感肌，你还需要了解她的使用史和耐受情况。试着先问一个问题。',
      coachType: 'probe',
      requiresAction: false,
      radarData: {
        listening: 56,
        empathy: 50,
        professionalism: 48,
        objectionHandling: 50,
        recommendation: 40,
      },
      status: 'active',
    },
    // 第3轮：BA 忽略顾虑，教练喊停
    {
      turn: 3,
      stage: 'probing',
      baMessage: '很多人都在用，效果也不错',
      customerMessage: null,
      coachMessage: '停一下——她已经不止一次提到怕刺痛，但你的回应还没有真正接住这个顾虑。先让她感到被理解，再给方案。',
      coachType: 'halt',
      requiresAction: true,
      radarData: {
        listening: 66,
        empathy: 55,
        professionalism: 52,
        objectionHandling: 50,
        recommendation: 42,
      },
      status: 'halted',
    },
    // 第4轮：BA 正确回应，教练即时反馈
    {
      turn: 4,
      stage: 'objection',
      baMessage: '你担心刺痛是很正常的，我们先从低浓度、低频率开始，搭配修护霜观察两周。',
      customerMessage: '这样听起来好像可以试试……我平时换季确实容易泛红，低浓度的应该会好一点吧？',
      coachMessage: '很好，你先接住了她对敏感和刺痛的担心，再把建议说成可控的小步骤。这样的回应会让顾客更愿意继续听你解释。',
      coachType: 'feedback',
      requiresAction: false,
      radarData: {
        listening: 73,
        empathy: 68,
        professionalism: 62,
        objectionHandling: 60,
        recommendation: 55,
      },
      status: 'active',
    },
    // 第5轮：结束训练（无对话消息，触发总结页）
    {
      turn: 5,
      stage: 'objection',
      baMessage: null,
      customerMessage: null,
      coachMessage: null,
      coachType: null,
      requiresAction: false,
      radarData: {
        listening: 80,
        empathy: 75,
        professionalism: 70,
        objectionHandling: 65,
        recommendation: 60,
      },
      status: 'active',
    },
  ],

  // 总结页数据
  summary: {
    overallScore: 79,
    finalDimensions: {
      listening: {
        score: 80,
        reasoning: '你主动询问了使用史和耐受情况，但可以更早地回应她的刺痛担忧。',
      },
      empathy: {
        score: 75,
        reasoning: '语气温和，能建立基本信任，但共情深度还可以加强。',
      },
      professionalism: {
        score: 70,
        reasoning: '给出了低浓度、低频率、修护霜打底的具体方案。',
      },
      objectionHandling: {
        score: 65,
        reasoning: '第3轮才真正接住顾虑，可以更早识别并回应。',
      },
      recommendation: {
        score: 60,
        reasoning: '推荐方向正确，但一开始跳过了探询阶段。',
      },
    },
    summaryText: '你很愿意倾听，也能用温和的语气建立信任。下一步，可以更早确认她对刺痛的担忧，并把建议说得更具体、可执行。',
    keyMoments: [
      {
        turn: 1,
        description: '主动询问使用史，没有急着推荐产品',
        type: 'good',
      },
      {
        turn: 2,
        description: '顾客再次提到刺痛，但回应还可以更具体',
        type: 'missed',
      },
      {
        turn: 3,
        description: '清晰的使用节奏降低了顾客的不确定感',
        type: 'good',
      },
    ],
    championComparison: {
      title: '优秀示范',
      comparisons: [
        {
          baReply: '我推荐你直接买这套早C晚A，很适合你',
          championReply: '我理解你的担心，敏感肌确实要小心。你先跟我说说——你平时容易泛红吗？之前用过A醇吗？',
          tags: ['先共情', '三连问', '不急着推荐'],
        },
      ],
    },
  },
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 获取所有消息按顺序排列的数组
 * 遍历每一轮，依次收集 BA、顾客、教练消息
 * @returns 消息数组
 */
export function getAllMessages(): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const turn of mockConversation.turns) {
    // BA 消息
    if (turn.baMessage !== null) {
      messages.push({
        turn: turn.turn,
        role: 'ba',
        content: turn.baMessage,
      });
    }

    // 顾客消息
    if (turn.customerMessage !== null) {
      messages.push({
        turn: turn.turn,
        role: 'customer',
        content: turn.customerMessage,
      });
    }

    // 教练消息
    if (turn.coachMessage !== null) {
      messages.push({
        turn: turn.turn,
        role: 'coach',
        content: turn.coachMessage,
        type: turn.coachType,
        requiresAction: turn.requiresAction,
      });
    }
  }

  return messages;
}

/**
 * 根据轮次获取雷达图数据
 * @param turn 轮次编号（1-5）
 * @returns 该轮的雷达图数据，轮次不存在时返回 null
 */
export function getDimensionsByTurn(turn: number): RadarData | null {
  const turnData = mockConversation.turns.find((t) => t.turn === turn);
  return turnData ? turnData.radarData : null;
}
