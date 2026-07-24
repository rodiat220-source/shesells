import type { Dimensions, Message } from "@/src/types";

export type DemoDifficulty = "beginner" | "intermediate" | "advanced";

export interface ChampionDemo {
  id: string;
  title: string;
  scenario: string;
  difficulty: DemoDifficulty;
  recommendedFor: string;
  skillTags: string[];
  persona: {
    name: string;
    skinType: string;
    concern: string;
    background: string;
  };
  messages: Message[];
  overallScore: number;
  dimensions: Dimensions;
  highlights: string[];
}

const timestamp = "2026-07-24T00:00:00.000Z";

export const championDemos: ChampionDemo[] = [
  {
    id: "sensitive-skin-fear",
    title: "敏感肌顾客怕刺痛",
    scenario: "顾客想改善暗沉和细纹，但因为换季泛红、过往刺痒体验，对尝试功效护肤非常犹豫。",
    difficulty: "beginner",
    recommendedFor: "适合想练习共情、风险安抚和耐受方案的新手 BA。",
    skillTags: ["共情倾听", "风险边界", "耐受方案", "轻决策"],
    persona: {
      name: "林小姐",
      skinType: "敏感肌",
      concern: "怕刺痛、怕烂脸、担心买回去浪费",
      background: "换季容易泛红，之前叠加清洁面膜后出现过刺痒，对功效护肤有兴趣但缺少安全感。",
    },
    overallScore: 92,
    dimensions: {
      listening: 94,
      professionalism: 91,
      recommendation: 90,
      objectionHandling: 92,
      warmth: 95,
    },
    highlights: [
      "先接住顾客害怕，再判断皮肤状态，没有急着推荐。",
      "把专业建议拆成低频、少量、单一变量，顾客听得懂也做得到。",
      "明确什么情况可以观察、什么情况需要停用，降低决策压力。",
    ],
    messages: [
      { id: "sensitive_customer_1", turn: 1, role: "customer", content: "我皮肤有点敏感，怕用了会刺痛、烂脸，你能帮我看看吗？", timestamp },
      { id: "sensitive_ba_1", turn: 1, role: "ba", content: "当然可以，你先担心这个很正常。敏感肌最重要的不是马上用什么，而是先判断皮肤现在能不能承受。我先问你两个问题：最近有没有泛红、刺痛，或者一换季就不稳定？", timestamp },
      { id: "sensitive_coach_1", turn: 1, role: "coach", coachType: "feedback", content: "先接住顾客的害怕，再进入判断。她没有急着推荐，而是把“买不买”先变成“适不适合现在用”。", timestamp },
      { id: "sensitive_customer_2", turn: 2, role: "customer", content: "最近换季会泛红，之前用过一个精华，第二天脸有点痒。", timestamp },
      { id: "sensitive_ba_2", turn: 2, role: "ba", content: "那我们今天先把安全感放第一位。你之前那次痒，是刚涂上就痒，还是第二天开始痒？有没有同时叠加别的功效产品？", timestamp },
      { id: "sensitive_customer_3", turn: 3, role: "customer", content: "好像是第二天，那个时候我还用了清洁面膜。", timestamp },
      { id: "sensitive_ba_3", turn: 3, role: "ba", content: "明白，那不一定是单个产品的问题，也可能是叠加太多导致屏障压力变大。你现在想改善的主要是暗沉、干燥，还是细纹？", timestamp },
      { id: "sensitive_coach_3", turn: 3, role: "coach", coachType: "feedback", content: "没有简单归因，也没有否定顾客体验，而是继续追问使用背景，体现专业判断。", timestamp },
      { id: "sensitive_customer_4", turn: 4, role: "customer", content: "主要是暗沉，还有一点细纹。", timestamp },
      { id: "sensitive_ba_4", turn: 4, role: "ba", content: "可以。你的目标是想让皮肤看起来更透亮、更细腻，但前提是不能把敏感状态激起来。所以我建议你不要一开始追求猛效果，而是先做低频、少量、单一变量。", timestamp },
      { id: "sensitive_customer_5", turn: 5, role: "customer", content: "低频是什么意思？", timestamp },
      { id: "sensitive_ba_5", turn: 5, role: "ba", content: "就是先不要每天用，也不要一次叠很多。比如先从一周两到三次开始，每次薄涂，其他步骤保持简单。这样如果皮肤有反应，我们也知道问题出在哪里。", timestamp },
      { id: "sensitive_coach_5", turn: 5, role: "coach", coachType: "feedback", content: "把专业建议拆成顾客听得懂、做得到的步骤，新手 BA 可以直接学习这种表达。", timestamp },
      { id: "sensitive_customer_6", turn: 6, role: "customer", content: "如果用了还是刺痛怎么办？", timestamp },
      { id: "sensitive_ba_6", turn: 6, role: "ba", content: "如果是刚上脸几十秒的轻微刺感，可以先观察；但如果持续刺痛、泛红加重、发热或者第二天明显不舒服，就马上停，先回到修护保湿。你不用硬扛，护肤一定是跟着皮肤状态走。", timestamp },
      { id: "sensitive_customer_7", turn: 7, role: "customer", content: "这样说我放心一点，但我还是怕买回去浪费。", timestamp },
      { id: "sensitive_ba_7", turn: 7, role: "ba", content: "可以理解。那我们今天先不让你做重决定。你可以先从最小负担的方式开始试，先确认皮肤接受，再考虑完整搭配。对敏感肌来说，买得安心比买得多更重要。", timestamp },
      { id: "sensitive_coach_7", turn: 7, role: "coach", coachType: "feedback", content: "这里没有强压成交，而是降低顾客决策压力，反而更容易建立信任。", timestamp },
      { id: "sensitive_customer_8", turn: 8, role: "customer", content: "那我先按你说的试。", timestamp },
      { id: "sensitive_ba_8", turn: 8, role: "ba", content: "好，我帮你记一下用法：先局部试，再隔天薄涂；这几天不要叠清洁面膜和强功效产品。你下次来只要告诉我三个感受：有没有刺痛、有没有泛红、第二天皮肤稳不稳，我们再帮你调。", timestamp },
    ],
  },
  {
    id: "need-more-time",
    title: "顾客说“我再看看”",
    scenario: "顾客认可问题存在，但觉得预算偏高，也不确定是否真的有必要当下购买。",
    difficulty: "intermediate",
    recommendedFor: "适合想练习异议拆解、价值重构和轻促单的 BA。",
    skillTags: ["异议拆解", "不逼单", "价值重构", "轻促单"],
    persona: {
      name: "周小姐",
      skinType: "混合偏干",
      concern: "上妆卡粉、下午暗沉、担心预算超出",
      background: "经常带妆上班，底妆容易斑驳，对改善妆面状态有需求，但不想被推整套。",
    },
    overallScore: 90,
    dimensions: {
      listening: 91,
      professionalism: 88,
      recommendation: 90,
      objectionHandling: 93,
      warmth: 89,
    },
    highlights: [
      "允许顾客犹豫，再温和拆解“再看看”背后的真实原因。",
      "把价格问题转回顾客最在意的使用场景和可观察指标。",
      "用小规格、试用和 7 天观察降低首次购买压力。",
    ],
    messages: [
      { id: "time_customer_1", turn: 1, role: "customer", content: "我再看看吧。", timestamp },
      { id: "time_ba_1", turn: 1, role: "ba", content: "可以的，不着急决定。我想确认一下，你说再看看，是想再对比一下价格，还是担心买回去不一定适合？", timestamp },
      { id: "time_coach_1", turn: 1, role: "coach", coachType: "feedback", content: "“再看看”不是结束语，而是信息入口。销冠先允许顾客犹豫，再温和拆原因。", timestamp },
      { id: "time_customer_2", turn: 2, role: "customer", content: "主要是觉得有点贵，而且我也不知道有没有必要。", timestamp },
      { id: "time_ba_2", turn: 2, role: "ba", content: "理解。如果只是随便补个保湿，确实不一定要选现在这个方案。我们先回到你的问题本身，你刚才说最困扰的是上妆卡粉和下午暗沉，对吗？", timestamp },
      { id: "time_customer_3", turn: 3, role: "customer", content: "对，我底妆很容易斑驳。", timestamp },
      { id: "time_ba_3", turn: 3, role: "ba", content: "那你买它的目的就不是“多一个护肤品”，而是想让妆面更服帖、下午状态更稳。我们可以先不看整套，只看最关键的一步有没有必要。", timestamp },
      { id: "time_coach_3", turn: 3, role: "coach", coachType: "feedback", content: "把价格异议转回具体问题，避免陷入“贵不贵”的拉扯。", timestamp },
      { id: "time_customer_4", turn: 4, role: "customer", content: "所以不是一定要买一整套？", timestamp },
      { id: "time_ba_4", turn: 4, role: "ba", content: "不用。第一次我反而不建议你一下子买太多。先解决最影响你体验的那个点，如果 7 天后你觉得妆面确实稳定，再考虑要不要补其他步骤。", timestamp },
      { id: "time_customer_5", turn: 5, role: "customer", content: "但我还是怕没效果。", timestamp },
      { id: "time_ba_5", turn: 5, role: "ba", content: "这个担心很合理。我们不把话说满，你回去重点看两个指标：早上上妆会不会更服帖，下午鼻翼和脸颊有没有少一点卡粉。只要这两个点有改善，它对你就是有效的。", timestamp },
      { id: "time_coach_5", turn: 5, role: "coach", coachType: "feedback", content: "优秀 BA 不用空泛保证效果，而是帮顾客建立可观察的判断标准。", timestamp },
      { id: "time_customer_6", turn: 6, role: "customer", content: "那如果没改善呢？", timestamp },
      { id: "time_ba_6", turn: 6, role: "ba", content: "如果没改善，我们下次就不往这个方向加钱，可能要重新看你的清洁、妆前或者底妆搭配。你不用靠猜，我会帮你一起排原因。", timestamp },
      { id: "time_customer_7", turn: 7, role: "customer", content: "听起来还行，就是今天预算有点紧。", timestamp },
      { id: "time_ba_7", turn: 7, role: "ba", content: "明白。那我给你两个轻一点的选择：今天先带小规格，压力低；或者你先试用感受质地，确认不排斥再决定。你选让自己最舒服的方式就好。", timestamp },
      { id: "time_coach_7", turn: 7, role: "coach", coachType: "feedback", content: "给选择，而不是给压力。顾客觉得自己仍有控制权，成交阻力会下降。", timestamp },
      { id: "time_customer_8", turn: 8, role: "customer", content: "那我先拿小规格吧。", timestamp },
      { id: "time_ba_8", turn: 8, role: "ba", content: "可以，这样最稳。我再帮你写一下用法：早上薄涂，等一分钟再上底妆；连续观察 7 天。你下次来直接告诉我卡粉有没有改善，我们再决定后面要不要升级。", timestamp },
    ],
  },
  {
    id: "competitor-comparison",
    title: "顾客问“比某某品牌好吗”",
    scenario: "顾客被朋友种草竞品，来到柜台后要求 BA 直接比较两个品牌谁更好。",
    difficulty: "intermediate",
    recommendedFor: "适合想练习竞品对比、需求匹配和专业收口的 BA。",
    skillTags: ["竞品对比", "需求匹配", "不贬低", "场景收口"],
    persona: {
      name: "陈小姐",
      skinType: "偏油易闷",
      concern: "怕黏、怕刺激、想知道和朋友推荐品牌的区别",
      background: "白天带妆时间长，容易觉得护肤品有负担，希望找到更适合妆前和日常使用的方案。",
    },
    overallScore: 91,
    dimensions: {
      listening: 90,
      professionalism: 94,
      recommendation: 91,
      objectionHandling: 92,
      warmth: 88,
    },
    highlights: [
      "不贬低竞品，也不急着证明自己，而是先拆比较维度。",
      "承认不同产品适合不同人，把判断拉回顾客肤质和场景。",
      "用白天带妆、怕黏、怕刺激等具体条件完成推荐收口。",
    ],
    messages: [
      { id: "competitor_customer_1", turn: 1, role: "customer", content: "这个比某某品牌好吗？我朋友说那个也不错。", timestamp },
      { id: "competitor_ba_1", turn: 1, role: "ba", content: "那个品牌确实很多人喜欢，我不会简单说谁一定更好。更准确的是看你更在意什么：肤感、温和度、见效速度，还是价格？", timestamp },
      { id: "competitor_coach_1", turn: 1, role: "coach", coachType: "feedback", content: "不踩竞品，也不急着证明自己。先把“谁更好”转成“谁更适合你”。", timestamp },
      { id: "competitor_customer_2", turn: 2, role: "customer", content: "我比较怕黏，也怕刺激。", timestamp },
      { id: "competitor_ba_2", turn: 2, role: "ba", content: "那你的关键词就是清爽、稳定、低负担。我们先按这三个点来比，不按品牌名来比，这样会更接近你的真实使用感受。", timestamp },
      { id: "competitor_customer_3", turn: 3, role: "customer", content: "可是我朋友说那个效果很好。", timestamp },
      { id: "competitor_ba_3", turn: 3, role: "ba", content: "她觉得好，可能是因为她的肤质和需求刚好匹配。你如果皮肤稳定、能接受滋润感，那个方向可以考虑；但你刚才说怕黏、怕刺激，那我们就要更谨慎。", timestamp },
      { id: "competitor_coach_3", turn: 3, role: "coach", coachType: "feedback", content: "承认别人推荐的合理性，同时把判断拉回顾客自身条件，避免争辩。", timestamp },
      { id: "competitor_customer_4", turn: 4, role: "customer", content: "那这个会不会效果没那么明显？", timestamp },
      { id: "competitor_ba_4", turn: 4, role: "ba", content: "如果你追求很强的即时感，它不一定是最猛的选择。但如果你想降低踩雷概率，让皮肤稳定地变好，它会更适合你现在的状态。", timestamp },
      { id: "competitor_customer_5", turn: 5, role: "customer", content: "我最近确实有点不稳定。", timestamp },
      { id: "competitor_ba_5", turn: 5, role: "ba", content: "那我不建议你现在走太激进的路线。皮肤不稳定的时候，先让它舒服、稳定，再去追更明显的功效，这样反而更容易坚持。", timestamp },
      { id: "competitor_coach_5", turn: 5, role: "coach", coachType: "feedback", content: "专业推进不是强推，而是给出清晰取舍：现在先稳，再谈强。", timestamp },
      { id: "competitor_customer_6", turn: 6, role: "customer", content: "那和那个品牌最大区别是什么？", timestamp },
      { id: "competitor_ba_6", turn: 6, role: "ba", content: "简单说，那个更适合喜欢滋润包裹感、晚上慢慢养的人；这个更适合白天也想用、怕负担、还要上妆的人。你不是不能用那个，只是按你现在的需求，这个匹配度更高。", timestamp },
      { id: "competitor_customer_7", turn: 7, role: "customer", content: "我确实白天用比较多，还要化妆。", timestamp },
      { id: "competitor_ba_7", turn: 7, role: "ba", content: "那这个逻辑就比较清楚了。你买它不是因为它“打败”谁，而是因为它更符合你的白天场景：清爽、好叠加、不增加妆面负担。", timestamp },
      { id: "competitor_coach_7", turn: 7, role: "coach", coachType: "feedback", content: "把竞品比较落到使用场景，顾客更容易接受，也更不容易反悔。", timestamp },
      { id: "competitor_customer_8", turn: 8, role: "customer", content: "那我先试这个吧。", timestamp },
      { id: "competitor_ba_8", turn: 8, role: "ba", content: "可以。你回去先连续用三天，重点观察会不会黏、会不会搓泥、下午有没有紧绷。如果这三个点都舒服，我们再看后续要不要加强功效。", timestamp },
    ],
  },
];

export function getChampionDemo(id: string) {
  return championDemos.find((demo) => demo.id === id);
}

