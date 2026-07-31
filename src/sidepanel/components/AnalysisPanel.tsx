import type {
  AIResponse,
  AlternativesResult,
  DeescalateResult,
  ExperimentResult,
  LongformCheckResult,
  SplitAnalysisResult
} from "../../shared/types";
import { PRODUCT_COPY } from "../../shared/productCopy";
import { ResultCard } from "./ResultCard";

interface AnalysisPanelProps {
  response: AIResponse | null;
  activeMode?: AIResponse["mode"] | "longform" | null;
}

export function AnalysisPanel({ response, activeMode }: AnalysisPanelProps) {
  if (!response || !response.result) {
    return (
      <ResultCard title={PRODUCT_COPY.results.result}>
        <p className="muted-text">
          {activeMode === "longform"
            ? PRODUCT_COPY.status.emptyLongformResult
            : PRODUCT_COPY.status.emptyQuickResult}
        </p>
      </ResultCard>
    );
  }

  switch (response.mode) {
    case "split":
      return <SplitView result={response.result as SplitAnalysisResult} />;
    case "deescalate":
      return <DeescalateView result={response.result as DeescalateResult} />;
    case "alternatives":
      return <AlternativesView result={response.result as AlternativesResult} />;
    case "experiment":
      return <ExperimentView result={response.result as ExperimentResult} />;
    case "longform":
      return <LongformView result={response.result as LongformCheckResult} />;
    default:
      return null;
  }
}

function SplitView({ result }: { result: SplitAnalysisResult }) {
  const safeResult: SplitAnalysisResult = {
    attentionTriage: result?.attentionTriage ?? {
      recommendedAction: "skim",
      attentionCost: "low",
      reason: "这次没有稳定返回注意力分诊，建议先低成本扫读。",
      nextStep: "如果和当前目标无关，可以直接跳过。"
    },
    observableFacts: Array.isArray(result?.observableFacts) ? result.observableFacts : [],
    opinions: Array.isArray(result?.opinions) ? result.opinions : [],
    inferences: Array.isArray(result?.inferences) ? result.inferences : [],
    predictions: Array.isArray(result?.predictions) ? result.predictions : [],
    emotionalTriggers: Array.isArray(result?.emotionalTriggers) ? result.emotionalTriggers : [],
    propagationLabels: Array.isArray(result?.propagationLabels) ? result.propagationLabels : [],
    anxietyThemes: Array.isArray(result?.anxietyThemes) ? result.anxietyThemes : [],
    viralityHooks: Array.isArray(result?.viralityHooks) ? result.viralityHooks : [],
    manipulationSignals: Array.isArray(result?.manipulationSignals) ? result.manipulationSignals : [],
    sourceReliabilityIssues: Array.isArray(result?.sourceReliabilityIssues) ? result.sourceReliabilityIssues : [],
    callsToAction: Array.isArray(result?.callsToAction) ? result.callsToAction : [],
    evidenceStrength: result?.evidenceStrength || "unclear",
    alternativeExplanations: Array.isArray(result?.alternativeExplanations)
      ? result.alternativeExplanations
      : [],
    cognitiveRiskNote: result?.cognitiveRiskNote || "",
    neutralRewrite: result?.neutralRewrite || "",
    lowCostVerification: Array.isArray(result?.lowCostVerification) ? result.lowCostVerification : []
  };

  return (
    <div className="stack">
      <ResultCard title={PRODUCT_COPY.results.attentionTriage}>
        <p>
          <strong>{mapAttentionAction(safeResult.attentionTriage.recommendedAction)}</strong>
          {" · "}
          注意力成本：{mapAttentionCost(safeResult.attentionTriage.attentionCost)}
        </p>
        <p className="muted-text">{safeResult.attentionTriage.reason || "这次没有返回分诊原因。"}</p>
        <SectionLabel title={PRODUCT_COPY.results.nextStep} />
        <p>{safeResult.attentionTriage.nextStep || "先不要立刻行动，保留一点判断空间。"}</p>
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.quickLabels}>
        <LabelChips items={safeResult.propagationLabels} />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.facts}>
        <StringList items={safeResult.observableFacts} emptyText="没有明显可观察事实。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.opinionsAndInferences}>
        <SectionLabel title={PRODUCT_COPY.results.authorOpinion} />
        <StringList items={safeResult.opinions} emptyText="没有明显观点表达。" />
        <SectionLabel title={PRODUCT_COPY.results.authorInference} />
        <StringList items={safeResult.inferences} emptyText="没有明显推断。" />
        <SectionLabel title={PRODUCT_COPY.results.predictions} />
        <StringList items={safeResult.predictions} emptyText="没有明确预测。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.anxietyBreakdown}>
        <SectionLabel title={PRODUCT_COPY.results.anxietyThemes} />
        <StringList items={safeResult.anxietyThemes} emptyText="没有明显焦虑主题。" />
        <SectionLabel title={PRODUCT_COPY.results.viralityHooks} />
        <StringList items={safeResult.viralityHooks} emptyText="没有明显传播钩子。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.stimulusSignals}>
        <SectionLabel title={PRODUCT_COPY.results.emotionalSignals} />
        <TriggerList items={safeResult.emotionalTriggers} />
        <SectionLabel title={PRODUCT_COPY.results.manipulationSignals} />
        <StringList items={safeResult.manipulationSignals} emptyText="没有明显操纵性线索。" />
        <SectionLabel title={PRODUCT_COPY.results.sourceIssues} />
        <StringList items={safeResult.sourceReliabilityIssues} emptyText="没有明显来源可靠性问题。" />
        <SectionLabel title={PRODUCT_COPY.results.callsToAction} />
        <StringList items={safeResult.callsToAction} emptyText="没有明显行动号召。" />
        <SectionLabel title={PRODUCT_COPY.results.evidenceStrength} />
        <p>{mapEvidenceStrength(safeResult.evidenceStrength)}</p>
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.slowingSupport}>
        <SectionLabel title={PRODUCT_COPY.results.alternatives} />
        <StringList items={safeResult.alternativeExplanations} emptyText="暂无更合适的替代解释。" />
        <SectionLabel title={PRODUCT_COPY.results.cognitiveRisk} />
        <p>{safeResult.cognitiveRiskNote || "这次没有返回额外提醒。"}</p>
        <SectionLabel title={PRODUCT_COPY.results.neutralRewrite} />
        <p>{safeResult.neutralRewrite || "这次没有返回改写内容。"}</p>
        <SectionLabel title={PRODUCT_COPY.results.verification} />
        <StringList items={safeResult.lowCostVerification} emptyText="暂无验证建议。" />
      </ResultCard>
    </div>
  );
}

function DeescalateView({ result }: { result: DeescalateResult }) {
  const safeResult: DeescalateResult = {
    neutralRewrite: result?.neutralRewrite || "",
    removedStimulusPatterns: Array.isArray(result?.removedStimulusPatterns)
      ? result.removedStimulusPatterns
      : [],
    uncertaintyNotes: Array.isArray(result?.uncertaintyNotes) ? result.uncertaintyNotes : []
  };

  return (
    <div className="stack">
      <ResultCard title={PRODUCT_COPY.results.neutralRewrite}>
        <p>{safeResult.neutralRewrite || "这次没有返回改写内容。"}</p>
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.removedStimulus}>
        <StringList items={safeResult.removedStimulusPatterns} emptyText="没有明确标出刺激模式。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.uncertainty}>
        <StringList items={safeResult.uncertaintyNotes} emptyText="没有额外不确定性提示。" />
      </ResultCard>
    </div>
  );
}

function AlternativesView({ result }: { result: AlternativesResult }) {
  const alternatives = Array.isArray(result?.alternatives) ? result.alternatives : [];

  return (
    <ResultCard title={PRODUCT_COPY.results.alternatives}>
      {alternatives.length === 0 ? (
        <p className="muted-text">这次没有返回可用的替代解释。</p>
      ) : (
        <ol className="numbered-list">
          {alternatives.map((item, index) => (
            <li key={`${item?.explanation || "alternative"}-${index}`}>
              <strong>{item?.explanation || "替代解释"}</strong>
              <p className="muted-text">{item?.whyPossible || "这次没有返回额外说明。"}</p>
            </li>
          ))}
        </ol>
      )}
    </ResultCard>
  );
}

function ExperimentView({ result }: { result: ExperimentResult }) {
  const safeResult: ExperimentResult = {
    suggestedExperiment: result?.suggestedExperiment || "",
    steps: Array.isArray(result?.steps) ? result.steps : [],
    timeLimit: result?.timeLimit || "",
    allInReplacement: result?.allInReplacement || ""
  };

  return (
    <div className="stack">
      <ResultCard title={PRODUCT_COPY.results.experiment}>
        <p>{safeResult.suggestedExperiment || "这次没有返回实验建议。"}</p>
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.steps}>
        <StringList items={safeResult.steps} emptyText="没有返回步骤。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.boundary}>
        <SectionLabel title={PRODUCT_COPY.results.timeLimit} />
        <p>{safeResult.timeLimit || "这次没有返回时间限制。"}</p>
        <SectionLabel title={PRODUCT_COPY.results.allInReplacement} />
        <p>{safeResult.allInReplacement || "这次没有返回替代方案。"}</p>
      </ResultCard>
    </div>
  );
}

function LongformView({ result }: { result: LongformCheckResult }) {
  const facts = Array.isArray(result?.facts) ? result.facts : [];
  const opinions = Array.isArray(result?.opinions) ? result.opinions : [];

  return (
    <div className="stack">
      <ResultCard title={PRODUCT_COPY.results.longformFacts}>
        <EvidenceList items={facts} emptyText="这次没有稳定提取出可核查事实。" />
      </ResultCard>
      <ResultCard title={PRODUCT_COPY.results.longformOpinions}>
        <EvidenceList items={opinions} emptyText="这次没有稳定提取出明确观点。" />
      </ResultCard>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <h4 className="section-label">{title}</h4>;
}

function StringList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="muted-text">{emptyText}</p>;
  }

  return (
    <ul className="bullet-list">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function TriggerList({ items }: { items: SplitAnalysisResult["emotionalTriggers"] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="muted-text">没有明显刺激信号。</p>;
  }

  return (
    <ul className="bullet-list">
      {items.map((item, index) => (
        <li key={`${item.text}-${index}`}>
          {item.text} · {item.type} · {mapIntensity(item.intensity)}
        </li>
      ))}
    </ul>
  );
}

function mapEvidenceStrength(value: SplitAnalysisResult["evidenceStrength"]) {
  const labels = {
    strong: "强",
    medium: "中",
    weak: "弱",
    unclear: "无法判断"
  };

  return labels[value] || "无法判断";
}

function mapIntensity(value: SplitAnalysisResult["emotionalTriggers"][number]["intensity"]) {
  const labels = {
    low: "低",
    medium: "中",
    high: "高"
  };

  return labels[value] || "低";
}

function mapAttentionAction(value: SplitAnalysisResult["attentionTriage"]["recommendedAction"]) {
  const labels = {
    skip: "建议跳过",
    skim: "低成本扫读",
    verify: "先验证",
    save: "值得保存",
    delay: "延迟行动"
  };

  return labels[value] || "低成本扫读";
}

function mapAttentionCost(value: SplitAnalysisResult["attentionTriage"]["attentionCost"]) {
  const labels = {
    low: "低",
    medium: "中",
    high: "高"
  };

  return labels[value] || "低";
}

function EvidenceList({
  items,
  emptyText
}: {
  items: LongformCheckResult["facts"];
  emptyText: string;
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="muted-text">{emptyText}</p>;
  }

  return (
    <ul className="bullet-list evidence-list">
      {items.map((item, index) => (
        <li key={`${item.claim}-${index}`} className="evidence-item">
          <p className="evidence-item__claim">
            {item.claim} <strong>（{item.verdict === "supported" ? "有证据" : "无证据"}）</strong>
          </p>
          <p className="evidence-item__note">{item.evidenceNote || "这次没有返回更具体的核查说明。"}</p>
          <p className="evidence-item__source">
            参考依据：{item.sourceHint || "未明确说明来源"}
            {item.sourceUrl ? (
              <a
                className="evidence-item__source-link"
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                查看来源
              </a>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}

function LabelChips({ items }: { items: string[] }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="muted-text">这次还没有稳定识别出明显传播机制标签。</p>;
  }

  return (
    <div className="label-chip-row">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="label-chip">
          {item}
        </span>
      ))}
    </div>
  );
}
