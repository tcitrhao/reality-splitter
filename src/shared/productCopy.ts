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
    quickPlaceholder: "选中文字，或把复制的内容粘贴到这里。",
    quickEmpty: "还没有可分析的文本。请先选中文字、使用右键菜单，或直接粘贴内容。",
    longformTitle: "待核查长文",
    longformPlaceholder: "把想捋一捋的长文贴进来。"
  },
  actions: [
    { mode: "split", label: "拆解" },
    { mode: "deescalate", label: "降低刺激" },
    { mode: "alternatives", label: "找替代解释" },
    { mode: "experiment", label: "转成小实验" }
  ] satisfies Array<{ mode: QuickAnalysisMode; label: string }>,
  status: {
    loadingTitle: "分析中",
    loadingBody: "正在拆解文本，稍等一下。",
    errorTitle: "这次没有成功",
    emptyQuickResult: "选中文本后，点击上方任一操作，这里会显示结构化结果。",
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
