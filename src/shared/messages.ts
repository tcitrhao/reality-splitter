import type {
  AIResponse,
  ExternalAssistantLaunchResult,
  ExternalAssistantTarget,
  LongformCheckInput,
  ModelConnectionTestResult,
  ModelRuntimeSettings,
  QuickAnalysisMode,
  TweetInput,
  WorkspaceMode
} from "./types";

export const MESSAGE_TYPES = {
  CAPTURE_INPUT: "CAPTURE_INPUT",
  RUN_ANALYSIS: "RUN_ANALYSIS",
  RUN_LONGFORM_CHECK: "RUN_LONGFORM_CHECK",
  RUN_INLINE_ANALYSIS: "RUN_INLINE_ANALYSIS",
  RUN_INLINE_LONGFORM_CHECK: "RUN_INLINE_LONGFORM_CHECK",
  OPEN_MODEL_ADMIN: "OPEN_MODEL_ADMIN",
  OPEN_EXTERNAL_ASSISTANT: "OPEN_EXTERNAL_ASSISTANT",
  TEST_MODEL_CONNECTION: "TEST_MODEL_CONNECTION"
} as const;

export interface CaptureInputMessage {
  type: typeof MESSAGE_TYPES.CAPTURE_INPUT;
  payload: {
    input: TweetInput;
    openPanel?: boolean;
    source: "selection" | "tweet_button" | "toolbar_action";
  };
}

export interface RunAnalysisMessage {
  type: typeof MESSAGE_TYPES.RUN_ANALYSIS;
  payload: {
    mode: QuickAnalysisMode;
    freshPerspective?: boolean;
    focusedSplit?: boolean;
    analysisContext?: string;
  };
}

export interface RunLongformCheckMessage {
  type: typeof MESSAGE_TYPES.RUN_LONGFORM_CHECK;
  payload: LongformCheckInput;
}

export interface RunInlineAnalysisMessage {
  type: typeof MESSAGE_TYPES.RUN_INLINE_ANALYSIS;
  payload: {
    mode: QuickAnalysisMode;
    input: TweetInput;
    freshPerspective?: boolean;
    focusedSplit?: boolean;
    analysisContext?: string;
  };
}

export interface RunInlineLongformCheckMessage {
  type: typeof MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK;
  payload: LongformCheckInput;
}

export interface OpenModelAdminMessage {
  type: typeof MESSAGE_TYPES.OPEN_MODEL_ADMIN;
}

export interface OpenExternalAssistantMessage {
  type: typeof MESSAGE_TYPES.OPEN_EXTERNAL_ASSISTANT;
  payload: {
    target: ExternalAssistantTarget;
    prompt: string;
    requireWebSearch: boolean;
  };
}

export interface TestModelConnectionMessage {
  type: typeof MESSAGE_TYPES.TEST_MODEL_CONNECTION;
  payload: {
    mode: WorkspaceMode;
    settings: ModelRuntimeSettings;
  };
}

export type RuntimeMessage =
  | CaptureInputMessage
  | RunAnalysisMessage
  | RunLongformCheckMessage
  | RunInlineAnalysisMessage
  | RunInlineLongformCheckMessage
  | OpenModelAdminMessage
  | OpenExternalAssistantMessage
  | TestModelConnectionMessage;

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type AnalysisResponse = RuntimeResponse<AIResponse>;
export type ModelConnectionTestResponse = RuntimeResponse<ModelConnectionTestResult>;
export type ExternalAssistantResponse = RuntimeResponse<ExternalAssistantLaunchResult>;
