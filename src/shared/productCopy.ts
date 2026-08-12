import type { QuickAnalysisMode } from "./types";

export const PRODUCT_COPY = {
  brand: "Reality Splitter",
  title: "现实分层器",
  modes: {
    quick: {
      title: "短文模式",
      meta: "快速拆解 / 刺激识别",
      description: "把短内容拆成更清晰的层次，快速识别它在用什么带节奏方式。"
    },
    longform: {
      title: "长文模式",
      meta: "事实 / 观点核查",
      description: "把较长内容捋成事实和观点，降低被长文叙事一路带走的概率。"
    }
  },
  input: {
    quickTitle: "当前短文文本",
    quickPlaceholder: "把复制的内容粘贴到这里，或通过右键菜单发送选中文字。",
    quickEmpty: "还没有可分析的文本。请直接粘贴内容，或通过右键菜单发送选中文字。",
    longformTitle: "待核查长文",
    longformPlaceholder: "把想捋一捋的长文贴进来。"
  },
  actions: [
    { mode: "split", label: "拆解" },
    { mode: "deescalate", label: "降低刺激" },
    { mode: "alternatives", label: "找替代解释" },
    { mode: "experiment", label: "转成小实验" }
  ] satisfies Array<{ mode: QuickAnalysisMode; label: string }>,
  quickFlow: {
    primaryAction: "开始综合拆解",
    primaryLoading: "综合拆解中...",
    progressBody: "四个步骤会依次完成，已经生成的结果会立即保留。",
    stepLabels: {
      split: "第 1 / 4 步：拆解现实层次",
      alternatives: "第 2 / 4 步：寻找替代解释",
      deescalate: "第 3 / 4 步：降低表达刺激",
      experiment: "第 4 / 4 步：生成小实验"
    } satisfies Record<QuickAnalysisMode, string>,
    followUpTitle: "换个视角继续拆",
    followUpDescription: "主结果会保留。选择一个方向重新生成，不满意可以继续换。",
    followUpActions: [
      { mode: "split", label: "再次拆解" },
      { mode: "alternatives", label: "换一组替代解释" },
      { mode: "deescalate", label: "再次降低刺激" },
      { mode: "experiment", label: "重做小实验" }
    ] satisfies Array<{ mode: QuickAnalysisMode; label: string }>
  },
  externalAssistants: {
    title: "发送到其他 AI",
    description: "选择目标 AI，一键打开新对话、填入拆解指令并发送。",
    badge: "16 个平台",
    methodLabel: "拆解方式",
    targetLabel: "目标 AI",
    copy: "仅复制指令",
    copied: "拆解指令已复制，可以粘贴到任意 AI 对话中。",
    copyFailed: "浏览器没有允许复制。可以刷新页面后重试。",
    privacy: "只有点击后才会向目标平台发送当前指令；插件不会读取对话历史，也不会保存这次 Prompt。"
  },
  status: {
    loadingTitle: "分析中",
    loadingBody: "正在拆解文本，稍等一下。",
    errorTitle: "这次没有成功",
    emptyQuickResult: "粘贴或通过右键发送文本后，开始综合拆解，这里会显示完整结果。",
    emptyLongformResult: "贴入长文并点击“开始长文核查”后，这里会显示事实 / 观点结果。"
  },
  results: {
    result: "结果",
    attentionTriage: "注意力分诊",
    nextStep: "下一步",
    quickLabels: "快速识别标签",
    facts: "现实 / 可观察事实",
    opinionsAndInferences: "观点与推断",
    authorOpinion: "作者观点",
    authorInference: "作者推断",
    predictions: "预测",
    anxietyBreakdown: "传播型焦虑拆解",
    anxietyThemes: "焦虑主题",
    viralityHooks: "传播钩子",
    stimulusSignals: "刺激与操纵信号",
    emotionalSignals: "情绪 / 传播刺激信号",
    manipulationSignals: "操纵性线索",
    sourceIssues: "来源可靠性问题",
    callsToAction: "行动号召",
    evidenceStrength: "证据强度",
    slowingSupport: "降速辅助",
    alternatives: "替代解释",
    deescalate: "降低刺激",
    smallExperiment: "转成小实验",
    cognitiveRisk: "认知风险提醒",
    neutralRewrite: "更中性的改写",
    verification: "低成本验证建议",
    removedStimulus: "降低了哪些刺激",
    uncertainty: "保留的不确定性",
    experiment: "建议的小实验",
    steps: "步骤",
    boundary: "边界",
    timeLimit: "时间限制",
    allInReplacement: "替代 all-in 的做法",
    longformFacts: "作者声称的事实",
    longformOpinions: "作者表达的观点"
  }
} as const;
