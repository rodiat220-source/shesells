# 提示词模板文件 - 存放所有 LLM Prompt 模板（待填充）


# 顾客模拟器 Prompt
# 用途：让 LLM 扮演敏感肌顾客，根据 BA 的消息生成顾客回复
# 占位符：{trust} 信任度, {intent} 购买意图, {fear} 核心顾虑, {ba_message} BA 最新消息
CUSTOMER_SIMULATOR_PROMPT = ""


# 评估教练 Prompt
# 用途：让 LLM 评估 BA 表现，输出五维评分和教练决策
# 占位符：{ba_message} BA 最新消息, {concerns} 顾客顾虑, {stage} 当前对话阶段
# 输出：JSON 格式，包含 dimensions(五维评分)、decision(probe/halt/feedback/none)、coach_message、error_type
EVALUATOR_COACH_PROMPT = ""


# 总结评估 Prompt
# 用途：对话结束后生成总结报告
# 占位符：{conversation_history} 完整对话历史
# 输出：JSON 格式，包含 summary、total_score、dimensions(含推理链)、key_moments、champion_replay
SUMMARY_PROMPT = ""
