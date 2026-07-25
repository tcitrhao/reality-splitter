import type { AIResponse, LongformCheckInput, QuickAnalysisMode, TweetInput } from "./types";

export const MESSAGE_TYPES = {
  CAPTURE_INPUT: "CAPTURE_INPUT",
  RUN_ANALYSIS: "RUN_ANALYSIS",
  RUN_LONGFORM_CHECK: "RUN_LONGFORM_CHECK",
  RUN_INLINE_ANALYSIS: "RUN_INLINE_ANALYSIS",
  RUN_INLINE_LONGFORM_CHECK: "RUN_INLINE_LONGFORM_CHECK"
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
  };
}

export interface RunInlineLongformCheckMessage {
  type: typeof MESSAGE_TYPES.RUN_INLINE_LONGFORM_CHECK;
  payload: LongformCheckInput;
}

export type RuntimeMessage =
  | CaptureInputMessage
  | RunAnalysisMessage
  | RunLongformCheckMessage
  | RunInlineAnalysisMessage
  | RunInlineLongformCheckMessage;

export interface RuntimeResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export type AnalysisResponse = RuntimeResponse<AIResponse>;
