export type AnalysisMode = "split" | "deescalate" | "alternatives" | "experiment" | "longform";
export type QuickAnalysisMode = Exclude<AnalysisMode, "longform">;
export type WorkspaceMode = "quick" | "longform";
export type AIProvider = "openai" | "openai-compatible";
export type InputProfile = "generic" | "market" | "rumor" | "wealth";

export interface ModelRuntimeSettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface TweetInput {
  text: string;
  url?: string;
  author?: string;
  timestamp?: string;
}

export interface EmotionalTrigger {
  type: string;
  text: string;
  intensity: "low" | "medium" | "high";
}

export type AttentionAction = "skip" | "skim" | "verify" | "save" | "delay";

export interface AttentionTriage {
  recommendedAction: AttentionAction;
  attentionCost: "low" | "medium" | "high";
  reason: string;
  nextStep: string;
}

export interface SplitAnalysisResult {
  attentionTriage: AttentionTriage;
  observableFacts: string[];
  opinions: string[];
  inferences: string[];
  predictions: string[];
  emotionalTriggers: EmotionalTrigger[];
  propagationLabels: string[];
  anxietyThemes: string[];
  viralityHooks: string[];
  manipulationSignals: string[];
  sourceReliabilityIssues: string[];
  callsToAction: string[];
  evidenceStrength: "strong" | "medium" | "weak" | "unclear";
  alternativeExplanations: string[];
  cognitiveRiskNote: string;
  neutralRewrite: string;
  lowCostVerification: string[];
}

export interface DeescalateResult {
  neutralRewrite: string;
  removedStimulusPatterns: string[];
  uncertaintyNotes: string[];
}

export interface AlternativesResult {
  alternatives: {
    explanation: string;
    whyPossible: string;
  }[];
}

export interface ExperimentResult {
  suggestedExperiment: string;
  steps: string[];
  timeLimit: string;
  allInReplacement: string;
}

export interface LongformEvidenceItem {
  claim: string;
  verdict: "supported" | "unsupported";
  evidenceNote: string;
  sourceHint: string;
}

export interface LongformCheckResult {
  facts: LongformEvidenceItem[];
  opinions: LongformEvidenceItem[];
}

export interface AnalysisResultMap {
  split: SplitAnalysisResult;
  deescalate: DeescalateResult;
  alternatives: AlternativesResult;
  experiment: ExperimentResult;
  longform: LongformCheckResult;
}

export type AnalysisResult = AnalysisResultMap[AnalysisMode];

export interface AIResponse<M extends AnalysisMode = AnalysisMode> {
  mode: M;
  result: AnalysisResultMap[M];
}

export interface StoredSettings {
  quick: ModelRuntimeSettings;
  longform: ModelRuntimeSettings;
}

export interface ModelConnectionTestResult {
  mode: WorkspaceMode;
  model: string;
  providerProfile: "deepseek" | "kimi" | "generic";
  latencyMs: number;
}

export interface StoredAppState {
  currentInput: TweetInput | null;
  uiError: string | null;
}

export interface LongformCheckInput {
  articleText: string;
  referenceLinks: string[];
  referenceNotes: string;
}
