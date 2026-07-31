import type {
  AlternativesResult,
  AnalysisMode,
  AnalysisResultMap,
  AttentionTriage,
  DeescalateResult,
  ExperimentResult,
  InputProfile,
  LongformCheckResult,
  SplitAnalysisResult
} from "./types";

const MARKET_KEYWORDS = [
  "a股",
  "港股",
  "美股",
  "大盘",
  "指数",
  "沪指",
  "深成指",
  "创业板",
  "科创50",
  "北证50",
  "收盘",
  "领跌",
  "飘红",
  "涨停",
  "跌停",
  "仓位",
  "交易日",
  "etf",
  "股",
  "%"
];

const RUMOR_KEYWORDS = ["小道消息", "内部消息", "听说", "据说", "网传", "传闻", "爆料", "有人说", "消息称"];
const EMPLOYMENT_ANXIETY_KEYWORDS = ["裁员", "优化", "毕业", "缩编", "砍人", "人员调整"];
const WEALTH_FOMO_KEYWORDS = [
  "炒股",
  "收益",
  "本金",
  "账户",
  "赚",
  "翻倍",
  "牛人",
  "大神",
  "暴富",
  "千万",
  "百万",
  "抄作业",
  "上车",
  "财富自由",
  "战绩"
];
const EMOTIONAL_TERMS = [
  "暴跌",
  "崩",
  "顶不住",
  "太难",
  "快",
  "必须",
  "一定",
  "毫无疑问",
  "彻底",
  "小道消息",
  "内部消息"
];

export function detectInputProfile(inputText: string): InputProfile {
  const normalized = inputText.toLowerCase();
  if (
    WEALTH_FOMO_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase())) ||
    hasExtremeOutcomeCue(inputText)
  ) {
    return "wealth";
  }

  if (
    RUMOR_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase())) ||
    EMPLOYMENT_ANXIETY_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
  ) {
    return "rumor";
  }

  return MARKET_KEYWORDS.some((keyword) => normalized.includes(keyword.toLowerCase()))
    ? "market"
    : "generic";
}

export function enrichAnalysisResult<M extends AnalysisMode>(params: {
  mode: M;
  inputText: string;
  inputProfile: InputProfile;
  currentResult: AnalysisResultMap[M];
}): AnalysisResultMap[M] {
  switch (params.mode) {
    case "split":
      return enrichSplitResult(
        params.inputText,
        params.inputProfile,
        params.currentResult as SplitAnalysisResult
      ) as AnalysisResultMap[M];
    case "deescalate":
      return enrichDeescalateResult(
        params.inputText,
        params.inputProfile,
        params.currentResult as DeescalateResult
      ) as AnalysisResultMap[M];
    default:
      return params.currentResult;
  }
}

export function buildFallbackResult<M extends AnalysisMode>(params: {
  mode: M;
  inputText: string;
  inputProfile: InputProfile;
  currentResult: AnalysisResultMap[M];
}): AnalysisResultMap[M] {
  switch (params.mode) {
    case "split":
      return buildSplitFallback(
        params.inputText,
        params.inputProfile,
        params.currentResult as SplitAnalysisResult
      ) as AnalysisResultMap[M];
    case "deescalate":
      return buildDeescalateFallback(
        params.inputText,
        params.inputProfile,
        params.currentResult as DeescalateResult
      ) as AnalysisResultMap[M];
    case "alternatives":
      return buildAlternativesFallback(
        params.inputText,
        params.inputProfile,
        params.currentResult as AlternativesResult
      ) as AnalysisResultMap[M];
    case "experiment":
      return buildExperimentFallback(
        params.inputText,
        params.inputProfile,
        params.currentResult as ExperimentResult
      ) as AnalysisResultMap[M];
    case "longform":
      return buildLongformFallback(
        params.inputText,
        params.currentResult as LongformCheckResult
      ) as AnalysisResultMap[M];
    default:
      return params.currentResult;
  }
}

function buildSplitFallback(
  inputText: string,
  inputProfile: InputProfile,
  currentResult: SplitAnalysisResult
): SplitAnalysisResult {
  const facts = currentResult.observableFacts.length > 0 ? currentResult.observableFacts : extractFacts(inputText);
  const alternatives =
    currentResult.alternativeExplanations.length > 0
      ? currentResult.alternativeExplanations
      : buildAlternativeStrings(inputProfile);
  const verification =
    currentResult.lowCostVerification.length > 0
      ? currentResult.lowCostVerification
      : buildVerificationSteps(inputProfile);

  return {
    attentionTriage: resolveAttentionTriage(inputText, inputProfile, currentResult),
    observableFacts: facts,
    opinions: currentResult.opinions.length > 0 ? currentResult.opinions : extractOpinions(inputText),
    inferences: currentResult.inferences,
    predictions: currentResult.predictions,
    emotionalTriggers:
      currentResult.emotionalTriggers.length > 0
        ? currentResult.emotionalTriggers
        : detectEmotionalTriggers(inputText),
    propagationLabels:
      currentResult.propagationLabels.length > 0
        ? currentResult.propagationLabels
        : detectPropagationLabels(inputText, inputProfile),
    anxietyThemes:
      currentResult.anxietyThemes.length > 0 ? currentResult.anxietyThemes : detectAnxietyThemes(inputText),
    viralityHooks:
      currentResult.viralityHooks.length > 0 ? currentResult.viralityHooks : detectViralityHooks(inputText),
    manipulationSignals:
      currentResult.manipulationSignals.length > 0
        ? currentResult.manipulationSignals
        : detectManipulationSignals(inputText),
    sourceReliabilityIssues:
      currentResult.sourceReliabilityIssues.length > 0
        ? currentResult.sourceReliabilityIssues
        : detectSourceReliabilityIssues(inputText),
    callsToAction: currentResult.callsToAction,
    evidenceStrength: currentResult.evidenceStrength,
    alternativeExplanations: alternatives,
    cognitiveRiskNote:
      currentResult.cognitiveRiskNote ||
      (inputProfile === "market"
        ? "这类市场摘要更容易把单日波动误读成长期结论，适合先区分“当天表现”和“趋势判断”。"
        : inputProfile === "rumor"
          ? "这段内容更像高影响低证据的传闻式表达，容易让人把未经证实的说法当成近乎确定的信息。"
          : inputProfile === "wealth"
            ? "这段内容更像极端成功案例传播，容易把少数亮眼结果误读成普遍、稳定、可复制的路径。"
        : "这段内容里可能混合了事实、感受和推断，适合先拆开再决定是否行动。"),
    neutralRewrite: currentResult.neutralRewrite || softenText(inputText),
    lowCostVerification: verification
  };
}

function buildDeescalateFallback(
  inputText: string,
  inputProfile: InputProfile,
  currentResult: DeescalateResult
): DeescalateResult {
  return {
    neutralRewrite: currentResult.neutralRewrite || softenText(inputText),
    removedStimulusPatterns:
      currentResult.removedStimulusPatterns.length > 0
        ? currentResult.removedStimulusPatterns
        : detectStimulusPatterns(inputText),
    uncertaintyNotes:
      currentResult.uncertaintyNotes.length > 0
        ? currentResult.uncertaintyNotes
        : inputProfile === "market"
          ? ["单日数据不能自动推出后续趋势。", "摘要里的结论可能依赖未展示的时间窗口。"]
          : inputProfile === "rumor"
            ? ["原文没有给出可核对的原始出处。", "高影响结论目前更像传闻，不能直接当成确定事实。"]
            : inputProfile === "wealth"
              ? ["亮眼结果不等于稳定可复制的方法。", "原文没有展示完整周期、回撤或失败样本。"]
          : ["原文没有提供足够背景，结论仍有不确定性。"]
  };
}

function buildAlternativesFallback(
  _inputText: string,
  inputProfile: InputProfile,
  currentResult: AlternativesResult
): AlternativesResult {
  const seed = currentResult.alternatives.filter((item) => item.explanation || item.whyPossible);
  const supplements = buildAlternativeObjects(inputProfile);

  return {
    alternatives: [...seed, ...supplements].slice(0, 4)
  };
}

function buildExperimentFallback(
  _inputText: string,
  inputProfile: InputProfile,
  currentResult: ExperimentResult
): ExperimentResult {
  if (inputProfile === "market") {
    return {
      suggestedExperiment:
        currentResult.suggestedExperiment || "先验证这条市场结论只是单日波动，还是更稳定的趋势信号。",
      steps:
        currentResult.steps.length > 0
          ? currentResult.steps
          : [
              "查 3 个独立来源，确认指数和涨跌幅数据是否一致。",
              "把时间窗口拉长到近 5 个交易日，看原文结论是否仍成立。",
              "找 1 个与原文结论相反的板块或指数，避免只看支持性样本。",
              "如果要行动，只做小仓位试探，不用一次性满仓。"
            ],
      timeLimit: currentResult.timeLimit || "先用 30 分钟做验证，再决定是否继续投入时间或资金。",
      allInReplacement: currentResult.allInReplacement || "把 100% 的冲动动作替换成 10% 以内的小步试探。"
    };
  }

  if (inputProfile === "rumor") {
    return {
      suggestedExperiment:
        currentResult.suggestedExperiment || "先验证这条高影响说法有没有原始出处，再决定是否相信或转发。",
      steps:
        currentResult.steps.length > 0
          ? currentResult.steps
          : [
              "先找这条消息的原始出处，而不是只看二手转述。",
              "确认是否有正式公告、文件、邮件截图或当事人公开说明。",
              "区分“某公司内部讨论”与“正式决定已经落地”。",
              "在没有更多证据前，先不转发、不下结论。"
            ],
      timeLimit: currentResult.timeLimit || "先用 15 到 30 分钟做出处核对，再决定是否继续传播或采取行动。",
      allInReplacement: currentResult.allInReplacement || "把立刻相信或转发，替换成先存疑、先核对原始出处。"
    };
  }

  if (inputProfile === "wealth") {
    return {
      suggestedExperiment:
        currentResult.suggestedExperiment || "先验证这是不是少数极端结果，而不是可稳定复制的方法。",
      steps:
        currentResult.steps.length > 0
          ? currentResult.steps
          : [
              "找完整周期记录，而不是只看单张收益截图。",
              "确认是否展示了回撤、亏损阶段、手续费和时间跨度。",
              "找 2 到 3 个失败样本，避免只看成功案例。",
              "在没有验证前，不把这类内容当成可直接抄作业的依据。"
            ],
      timeLimit: currentResult.timeLimit || "先用 20 到 30 分钟核对完整记录，再决定是否继续投入注意力或资金。",
      allInReplacement: currentResult.allInReplacement || "把“立刻上车”替换成先做纸面记录、再用极小规模验证。"
    };
  }

  return {
    suggestedExperiment: currentResult.suggestedExperiment || "先用一个低成本现实反馈，验证原文结论是否站得住。",
    steps:
      currentResult.steps.length > 0
        ? currentResult.steps
        : [
            "查 3 个独立来源，看原文说法是否一致。",
            "找 1 个反例，测试自己是否只看到了单一解释。",
            "等 24 小时后再决定是否采取更大的行动。"
          ],
    timeLimit: currentResult.timeLimit || "先给自己 24 小时观察窗口。",
    allInReplacement: currentResult.allInReplacement || "先做一个可撤回的小动作，而不是一次性投入全部。"
  };
}

function buildLongformFallback(
  inputText: string,
  currentResult: LongformCheckResult
): LongformCheckResult {
  const extracted = extractLongformClaims(inputText);

  return {
    ...(currentResult.webSearch ? { webSearch: currentResult.webSearch } : {}),
    facts:
      currentResult.facts.length > 0
        ? currentResult.facts
        : extracted.facts.map((claim) => ({
            claim,
            verdict: "unsupported",
            evidenceNote: "当前结果里还没有稳定的核查依据说明。",
            sourceHint: "未补充参考来源",
            sourceUrl: ""
          })),
    opinions:
      currentResult.opinions.length > 0
        ? currentResult.opinions
        : extracted.opinions.map((claim) => ({
            claim,
            verdict: "unsupported",
            evidenceNote: "当前结果里还没有稳定的支撑依据说明。",
            sourceHint: "未补充参考来源",
            sourceUrl: ""
          }))
  };
}

function enrichSplitResult(
  inputText: string,
  inputProfile: InputProfile,
  currentResult: SplitAnalysisResult
): SplitAnalysisResult {
  return {
    ...currentResult,
    attentionTriage: resolveAttentionTriage(inputText, inputProfile, currentResult),
    emotionalTriggers: mergeTriggers(currentResult.emotionalTriggers, detectEmotionalTriggers(inputText)),
    propagationLabels: mergeUniqueStrings(
      currentResult.propagationLabels,
      detectPropagationLabels(inputText, inputProfile)
    ),
    anxietyThemes: mergeUniqueStrings(currentResult.anxietyThemes, detectAnxietyThemes(inputText)),
    viralityHooks: mergeUniqueStrings(currentResult.viralityHooks, detectViralityHooks(inputText)),
    manipulationSignals: mergeUniqueStrings(currentResult.manipulationSignals, detectManipulationSignals(inputText)),
    sourceReliabilityIssues: mergeUniqueStrings(
      currentResult.sourceReliabilityIssues,
      detectSourceReliabilityIssues(inputText)
    ),
    lowCostVerification: mergeUniqueStrings(
      currentResult.lowCostVerification,
      inputProfile === "rumor" ? buildVerificationSteps(inputProfile).slice(0, 2) : []
    )
  };
}

function resolveAttentionTriage(
  inputText: string,
  inputProfile: InputProfile,
  currentResult: SplitAnalysisResult
): AttentionTriage {
  const current = currentResult.attentionTriage;
  if (current?.reason && current?.nextStep) {
    return current;
  }

  if (inputProfile === "rumor") {
    return {
      recommendedAction: "verify",
      attentionCost: "high",
      reason: "这类内容通常是高影响低证据，容易让未经证实的信息占用过多注意力。",
      nextStep: "先找原始出处或正式公告；找不到前，不转发、不据此行动。"
    };
  }

  if (inputProfile === "wealth") {
    return {
      recommendedAction: "delay",
      attentionCost: "high",
      reason: "这类内容容易通过极端成功案例制造错失感，让人高估可复制性。",
      nextStep: "先等 24 小时，再核对完整周期、回撤和失败样本。"
    };
  }

  if (inputProfile === "market") {
    return {
      recommendedAction: "skim",
      attentionCost: "medium",
      reason: "这更像行情或市场摘要，适合先当作短时间窗口的信息，而不是直接行动依据。",
      nextStep: "只保留关键数字；若要决策，再拉长时间窗口核对。"
    };
  }

  if (hasUrgencyCue(inputText) || hasHighImpactCue(inputText)) {
    return {
      recommendedAction: "delay",
      attentionCost: "medium",
      reason: "原文带有紧迫感或高影响暗示，适合先降速再判断。",
      nextStep: "先把事实和推断拆开，晚一点再决定是否需要继续跟进。"
    };
  }

  return {
    recommendedAction: "skim",
    attentionCost: "low",
    reason: "这段内容暂时没有明显必须深挖的信号，可以低成本扫读。",
    nextStep: "如果它和当前目标无关，可以直接跳过。"
  };
}

function enrichDeescalateResult(
  inputText: string,
  _inputProfile: InputProfile,
  currentResult: DeescalateResult
): DeescalateResult {
  return {
    ...currentResult,
    removedStimulusPatterns: mergeUniqueStrings(
      currentResult.removedStimulusPatterns,
      detectStimulusPatterns(inputText)
    )
  };
}

function extractFacts(inputText: string): string[] {
  const lines = inputText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const numberLines = lines.filter((line) => /\d/.test(line));
  const candidates = numberLines.length > 0 ? numberLines : lines;

  return candidates.slice(0, 4);
}

function extractOpinions(inputText: string): string[] {
  const opinionTerms = ["暴跌", "逆势飘红", "领跌", "太难", "顶不住", "很差", "很强"];
  const hits = opinionTerms.filter((term) => inputText.includes(term)).map((term) => `原文使用了“${term}”这类带判断色彩的表达。`);
  return hits.slice(0, 3);
}

function detectEmotionalTriggers(inputText: string): SplitAnalysisResult["emotionalTriggers"] {
  const triggers: SplitAnalysisResult["emotionalTriggers"] = [];

  for (const term of EMOTIONAL_TERMS) {
    if (!inputText.includes(term)) {
      continue;
    }

    if (RUMOR_KEYWORDS.includes(term)) {
      triggers.push({
        type: "传闻式来源",
        text: term,
        intensity: "high"
      });
      continue;
    }

    triggers.push({
      type: "情绪化措辞",
      text: term,
      intensity: term === "暴跌" || term === "顶不住" ? "medium" : "low"
    });
  }

  if (hasUrgencyCue(inputText)) {
    triggers.push({
      type: "时间压迫",
      text: extractFirstMatch(inputText, /(月底|本周|今天|今晚|明天|马上|即将)/),
      intensity: "medium"
    });
  }

  if (hasPrecisionClaimCue(inputText) && hasHighImpactCue(inputText)) {
    triggers.push({
      type: "高影响数字暗示",
      text: extractFirstMatch(inputText, /(\d+\s*%-\s*\d+%|\d+\s*%)/),
      intensity: "high"
    });
  }

  if (hasExtremeOutcomeCue(inputText)) {
    triggers.push({
      type: "极端收益暗示",
      text: extractFirstMatch(inputText, /(\d+\s*万.*\d+\s*万|\d+\s*万.*\d+\s*千?万|翻\d+倍|收益率?\s*\d+%)/),
      intensity: "high"
    });
  }

  return dedupeTriggers(triggers);
}

function detectStimulusPatterns(inputText: string): string[] {
  const patterns = EMOTIONAL_TERMS.filter((term) => inputText.includes(term)).map(
    (term) => `弱化了“${term}”这类高刺激表达。`
  );

  if (RUMOR_KEYWORDS.some((term) => inputText.includes(term))) {
    patterns.push("弱化了“传闻/小道消息”带来的来源权威错觉。");
  }

  if (hasPrecisionClaimCue(inputText) && hasHighImpactCue(inputText)) {
    patterns.push("弱化了“具体比例 + 高影响事件”制造确定感的表达。");
  }

  if (hasUrgencyCue(inputText)) {
    patterns.push("弱化了“月底/马上”等时间压迫感。");
  }

  if (hasExtremeOutcomeCue(inputText)) {
    patterns.push("弱化了“极端收益案例”带来的错失焦虑和攀比感。");
  }

  return dedupeStrings(patterns);
}

function softenText(inputText: string): string {
  const replacements: Array<[RegExp, string]> = [
    [/暴跌/g, "明显下跌"],
    [/崩盘/g, "出现较大波动"],
    [/顶不住/g, "承受压力较大"],
    [/太难了/g, "压力较大"],
    [/小道消息/g, "未经证实的说法"],
    [/内部消息/g, "未核实的内部说法"],
    [/牛人/g, "高收益案例"],
    [/大神/g, "高收益案例"],
    [/必须/g, "可以考虑"],
    [/一定/g, "未必"]
  ];

  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), inputText).trim();
}

function buildAlternativeStrings(inputProfile: InputProfile): string[] {
  return buildAlternativeObjects(inputProfile).map((item) => item.explanation);
}

function buildAlternativeObjects(inputProfile: InputProfile): AlternativesResult["alternatives"] {
  if (inputProfile === "market") {
    return [
      {
        explanation: "这可能主要反映的是单日时间窗口，而不是更长趋势。",
        whyPossible: "市场摘要常把当天收盘表现压缩成一句话，但更长周期里结论可能不同。"
      },
      {
        explanation: "原文可能强调了最醒目的指数或板块，忽略了其他并不一致的样本。",
        whyPossible: "市场叙述很容易围绕领跌或领涨项展开，从而形成选择性观察。"
      },
      {
        explanation: "一些结论可能来自表达风格，而不是足够完整的数据支持。",
        whyPossible: "像“暴跌”“逆势飘红”这类词会放大感受，但不一定等于可操作判断。"
      }
    ];
  }

  if (inputProfile === "rumor") {
    return [
      {
        explanation: "这可能只是二手转述或误传，还不是正式决定。",
        whyPossible: "原文使用了“小道消息”一类说法，但没有给出可核对的正式出处。"
      },
      {
        explanation: "比例或时间点可能被夸大，以制造更强的确定感和紧迫感。",
        whyPossible: "传闻文本常用具体百分比和时间点来提升可信感，但未必有对应原始证据。"
      },
      {
        explanation: "原文可能把内部讨论、预案或局部调整，表述成了全面落地的结果。",
        whyPossible: "高影响结论在传播中容易被简化成一句“要裁员了”，细节和范围却被省略。"
      }
    ];
  }

  if (inputProfile === "wealth") {
    return [
      {
        explanation: "这可能是少数极端成功案例，并不代表大多数人都能复制。",
        whyPossible: "社交媒体更容易传播亮眼结果，失败样本和回撤过程往往不会被同样展示。"
      },
      {
        explanation: "原文展示的可能只是某个时间点的结果，而不是完整周期表现。",
        whyPossible: "单张截图或阶段性收益很容易掩盖之前的亏损、风险暴露和后续波动。"
      },
      {
        explanation: "“牛人”标签可能在放大权威感，但没有自动说明方法稳定或适合他人。",
        whyPossible: "结果展示和可复制方法之间仍然隔着风险承受能力、时点、策略细节等变量。"
      }
    ];
  }

  return [
    {
      explanation: "原文可能只是在表达当下感受，不一定是在给出完整结论。",
      whyPossible: "社交媒体文本常混合情绪和判断，字面强度不等于事实强度。"
    },
    {
      explanation: "原文结论可能依赖未说出的背景条件。",
      whyPossible: "缺少时间、对象或上下文时，同一句话可以有不止一种解释。"
    },
    {
      explanation: "这可能只是众多解释中的一种，而不是唯一解释。",
      whyPossible: "当前文本并没有充分排除其他可能性。"
    }
  ];
}

function buildVerificationSteps(inputProfile: InputProfile): string[] {
  if (inputProfile === "market") {
    return [
      "核对 3 个独立来源的行情数据是否一致。",
      "把观察窗口拉长到近 5 个交易日再看结论是否仍成立。",
      "找 1 个与原文结论不一致的板块或指数作对照。"
    ];
  }

  if (inputProfile === "rumor") {
    return [
      "找原始出处，确认这条说法是不是正式公告而不是转述。",
      "核对是否有公司、当事人或主流媒体给出一致表述。",
      "区分“有人讨论”与“正式决定已经执行”。"
    ];
  }

  if (inputProfile === "wealth") {
    return [
      "先找完整周期记录，而不是只看单次高收益截图。",
      "确认是否披露了回撤、失败交易、时间跨度和交易成本。",
      "找 1 到 2 个失败样本，避免把幸存者故事当成普遍路径。"
    ];
  }

  return [
    "查 3 个独立来源确认关键信息。",
    "找 1 个反例测试是否存在其他解释。",
    "等 24 小时后再决定是否采取更大的行动。"
  ];
}

function extractLongformClaims(inputText: string): { facts: string[]; opinions: string[] } {
  const segments = inputText
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？!?])/))
    .map((item) => item.trim())
    .filter(Boolean);

  const facts: string[] = [];
  const opinions: string[] = [];

  for (const segment of segments) {
    if (facts.length >= 4 && opinions.length >= 4) {
      break;
    }

    if (looksLikeOpinionClaim(segment)) {
      if (opinions.length < 4) {
        opinions.push(segment);
      }
      continue;
    }

    if (looksLikeFactClaim(segment)) {
      if (facts.length < 4) {
        facts.push(segment);
      }
    }
  }

  if (facts.length === 0) {
    facts.push(...segments.slice(0, 2));
  }

  if (opinions.length === 0) {
    opinions.push(...segments.slice(Math.max(0, segments.length - 2)));
  }

  return {
    facts: dedupeStrings(facts).slice(0, 4),
    opinions: dedupeStrings(opinions).slice(0, 4)
  };
}

function looksLikeFactClaim(text: string): boolean {
  return /\d/.test(text) || /(发布|发生|表示|提到|宣布|指出|显示|称|引用)/.test(text);
}

function looksLikeOpinionClaim(text: string): boolean {
  return /(认为|说明|意味着|可能|应该|值得|其实|显然|我看|我觉得|牛人|厉害|可见)/.test(text);
}

function detectManipulationSignals(inputText: string): string[] {
  const signals: string[] = [];

  if (RUMOR_KEYWORDS.some((term) => inputText.includes(term))) {
    signals.push("使用“传闻/小道消息/内部消息”这类模糊来源，容易降低读者的核对门槛。");
  }

  if (hasUnnamedSubjectCue(inputText)) {
    signals.push("主体表述模糊，例如“某大厂/某公司”，让高影响结论难以被直接核实。");
  }

  if (hasPrecisionClaimCue(inputText) && hasHighImpactCue(inputText)) {
    signals.push("用具体比例或数字包装高影响结论，容易制造“消息很准”的感觉。");
  }

  if (hasUrgencyCue(inputText)) {
    signals.push("带有明确时间节点，容易制造“要立刻相信或反应”的压力。");
  }

  if (hasHighImpactCue(inputText)) {
    signals.push("聚焦裁员、优化等高影响后果，本身就容易放大职业焦虑。");
  }

  if (hasExtremeOutcomeCue(inputText)) {
    signals.push("用极端收益或财富跃迁案例制造“别人做到了、我会不会错过”的错失焦虑。");
  }

  if (hasStatusAuthorityCue(inputText)) {
    signals.push("使用“牛人/大神/发现一个”这类包装，容易把好奇心转成权威感或跟随冲动。");
  }

  return dedupeStrings(signals);
}

function detectPropagationLabels(inputText: string, inputProfile: InputProfile): string[] {
  const labels: string[] = [];

  if (inputProfile === "rumor" || hasHighImpactCue(inputText)) {
    labels.push("职业恐慌");
  }

  if (inputProfile === "wealth" || hasExtremeOutcomeCue(inputText)) {
    labels.push("财富 FOMO");
  }

  if (hasStatusAuthorityCue(inputText)) {
    labels.push("身份攀比");
  }

  if (
    RUMOR_KEYWORDS.some((term) => inputText.includes(term)) ||
    hasUnnamedSubjectCue(inputText) ||
    /(牛人|大神|大佬)/.test(inputText)
  ) {
    labels.push("模糊权威");
  }

  if (hasPrecisionClaimCue(inputText) || hasExtremeOutcomeCue(inputText)) {
    labels.push("精确数字诱导");
  }

  if (hasUrgencyCue(inputText)) {
    labels.push("时间压迫");
  }

  return dedupeStrings(labels).slice(0, 4);
}

function detectSourceReliabilityIssues(inputText: string): string[] {
  const issues: string[] = [];

  if (RUMOR_KEYWORDS.some((term) => inputText.includes(term))) {
    issues.push("原文引用的是传闻式来源，但没有给出可核对的原始出处。");
  }

  if (hasUnnamedSubjectCue(inputText)) {
    issues.push("主体名称被模糊化，降低了读者独立核实的可能性。");
  }

  if (hasPrecisionClaimCue(inputText)) {
    issues.push("给出了具体比例或数字，但没有说明这些数字来自什么文件、样本或口径。");
  }

  if (hasUrgencyCue(inputText)) {
    issues.push("给出了时间点，但没有提供对应公告、邮件、会议纪要等证据。");
  }

  if (hasExtremeOutcomeCue(inputText)) {
    issues.push("展示了亮眼结果，但看不到完整周期、回撤或失败样本，难以判断是否可复制。");
  }

  return dedupeStrings(issues);
}

function detectAnxietyThemes(inputText: string): string[] {
  const themes: string[] = [];

  if (hasHighImpactCue(inputText)) {
    themes.push("职业安全 / 裁员焦虑");
  }

  if (hasExtremeOutcomeCue(inputText) || WEALTH_FOMO_KEYWORDS.some((term) => inputText.includes(term))) {
    themes.push("财富差距 / 错失机会焦虑");
  }

  if (hasStatusAuthorityCue(inputText)) {
    themes.push("能力攀比 / 身份比较焦虑");
  }

  return dedupeStrings(themes);
}

function detectViralityHooks(inputText: string): string[] {
  const hooks: string[] = [];

  if (/发现一个/.test(inputText)) {
    hooks.push("用“发现一个”制造好奇入口，提升停留和点开意愿。");
  }

  if (hasStatusAuthorityCue(inputText)) {
    hooks.push("用“牛人/大神”标签快速建立人物光环。");
  }

  if (hasExtremeOutcomeCue(inputText)) {
    hooks.push("用极端收益或财富跃迁案例做传播钩子。");
  }

  if (hasPrecisionClaimCue(inputText)) {
    hooks.push("用具体数字提高表面可信度和讨论度。");
  }

  return dedupeStrings(hooks);
}

function mergeUniqueStrings(primary: string[], secondary: string[]): string[] {
  return dedupeStrings([...primary, ...secondary]);
}

function mergeTriggers(
  primary: SplitAnalysisResult["emotionalTriggers"],
  secondary: SplitAnalysisResult["emotionalTriggers"]
): SplitAnalysisResult["emotionalTriggers"] {
  return dedupeTriggers([...primary, ...secondary]);
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeTriggers(
  items: SplitAnalysisResult["emotionalTriggers"]
): SplitAnalysisResult["emotionalTriggers"] {
  const seen = new Set<string>();
  const result: SplitAnalysisResult["emotionalTriggers"] = [];

  for (const item of items) {
    const key = `${item.type}::${item.text}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return result;
}

function hasUrgencyCue(inputText: string): boolean {
  return /(月底|本周|今天|今晚|明天|马上|即将)/.test(inputText);
}

function hasPrecisionClaimCue(inputText: string): boolean {
  return /(\d+\s*%-\s*\d+%|\d+\s*%|\d+\s*成)/.test(inputText);
}

function hasHighImpactCue(inputText: string): boolean {
  return EMPLOYMENT_ANXIETY_KEYWORDS.some((term) => inputText.includes(term));
}

function hasUnnamedSubjectCue(inputText: string): boolean {
  return /(某大厂|某公司|某厂|某开水厂|某平台|某互联网公司)/.test(inputText);
}

function hasExtremeOutcomeCue(inputText: string): boolean {
  return /(\d+\s*万.*\d+\s*万|\d+\s*万.*\d+\s*千?万|翻\d+倍|收益率?\s*\d+%)/.test(inputText);
}

function hasStatusAuthorityCue(inputText: string): boolean {
  return /(牛人|大神|发现一个|高手|大佬)/.test(inputText);
}

function extractFirstMatch(inputText: string, pattern: RegExp): string {
  const match = inputText.match(pattern);
  return match?.[0] || "相关表述";
}
