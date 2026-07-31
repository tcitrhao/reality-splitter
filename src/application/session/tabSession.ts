import type {
  AIResponse,
  LongformCheckInput,
  QuickAnalysisMode,
  TweetInput,
  WorkspaceMode
} from "../../shared/types";

export interface QuickWorkspaceSession {
  input: TweetInput | null;
  response: AIResponse | null;
  error: string;
  loading: boolean;
  activeMode: QuickAnalysisMode | null;
  requestId: number;
}

export interface LongformWorkspaceSession {
  input: LongformCheckInput;
  sourceUrl?: string;
  response: AIResponse | null;
  error: string;
  loading: boolean;
  requestId: number;
}

export interface TabSessionSnapshot {
  open: boolean;
  workspaceMode: WorkspaceMode;
  quick: QuickWorkspaceSession;
  longform: LongformWorkspaceSession;
}

export interface PendingQuickRequest {
  requestId: number;
  mode: QuickAnalysisMode;
  input: TweetInput;
}

export interface PendingLongformRequest {
  requestId: number;
  input: LongformCheckInput;
}

export interface TabSessionStore {
  getSnapshot: () => TabSessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  open: (input: TweetInput, workspaceMode: WorkspaceMode) => void;
  close: () => void;
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void;
  updateCurrentSelection: (input: TweetInput) => boolean;
  updateQuickText: (text: string) => void;
  updateLongformText: (text: string) => void;
  beginQuickRequest: (mode: QuickAnalysisMode) => PendingQuickRequest | null;
  resolveQuickRequest: (
    requestId: number,
    result: { response?: AIResponse; error?: string }
  ) => void;
  beginLongformRequest: () => PendingLongformRequest | null;
  resolveLongformRequest: (
    requestId: number,
    result: { response?: AIResponse; error?: string }
  ) => void;
}

const EMPTY_LONGFORM_INPUT: LongformCheckInput = {
  articleText: "",
  referenceLinks: [],
  referenceNotes: ""
};

export function createTabSessionStore(currentUrl: () => string): TabSessionStore {
  let snapshot: TabSessionSnapshot = {
    open: false,
    workspaceMode: "quick",
    quick: createQuickWorkspace(),
    longform: createLongformWorkspace()
  };
  const listeners = new Set<() => void>();

  const publish = (next: TabSessionSnapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const updateQuickInput = (input: TweetInput) => {
    if (isSameTweetInput(snapshot.quick.input, input)) {
      return snapshot.quick;
    }

    return {
      ...createQuickWorkspace(),
      input: normalizeTweetInput(input),
      requestId: snapshot.quick.requestId + 1
    };
  };

  const updateLongformInput = (input: TweetInput) => {
    if (
      snapshot.longform.input.articleText === input.text &&
      snapshot.longform.sourceUrl === input.url
    ) {
      return snapshot.longform;
    }

    return {
      ...createLongformWorkspace(),
      input: {
        ...EMPTY_LONGFORM_INPUT,
        articleText: input.text
      },
      sourceUrl: input.url,
      requestId: snapshot.longform.requestId + 1
    };
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open(input, workspaceMode) {
      const next =
        workspaceMode === "longform"
          ? { ...snapshot, longform: updateLongformInput(input) }
          : { ...snapshot, quick: updateQuickInput(input) };

      publish({
        ...next,
        open: true,
        workspaceMode
      });
    },
    close() {
      if (snapshot.open) {
        publish({ ...snapshot, open: false });
      }
    },
    setWorkspaceMode(workspaceMode) {
      let quick = snapshot.quick;
      let longform = snapshot.longform;

      if (workspaceMode === "quick" && !quick.input && longform.input.articleText) {
        quick = updateQuickInput({
          text: longform.input.articleText,
          url: longform.sourceUrl || currentUrl()
        });
      }

      if (workspaceMode === "longform" && !longform.input.articleText && quick.input) {
        longform = updateLongformInput(quick.input);
      }

      publish({
        ...snapshot,
        workspaceMode,
        quick,
        longform
      });
    },
    updateCurrentSelection(input) {
      if (!snapshot.open) {
        return false;
      }

      const activeWorkspace =
        snapshot.workspaceMode === "longform" ? snapshot.longform : snapshot.quick;
      if (activeWorkspace.loading) {
        return false;
      }

      publish(
        snapshot.workspaceMode === "longform"
          ? { ...snapshot, longform: updateLongformInput(input) }
          : { ...snapshot, quick: updateQuickInput(input) }
      );
      return true;
    },
    updateQuickText(text) {
      const nextInput = {
        ...(snapshot.quick.input ?? { url: currentUrl() }),
        text,
        url: snapshot.quick.input?.url || currentUrl()
      };

      publish({
        ...snapshot,
        quick: {
          ...snapshot.quick,
          input: nextInput,
          response: null,
          error: "",
          activeMode: null,
          requestId: snapshot.quick.requestId + 1,
          loading: false
        }
      });
    },
    updateLongformText(text) {
      publish({
        ...snapshot,
        longform: {
          ...snapshot.longform,
          input: {
            ...EMPTY_LONGFORM_INPUT,
            articleText: text
          },
          response: null,
          error: "",
          requestId: snapshot.longform.requestId + 1,
          loading: false
        }
      });
    },
    beginQuickRequest(mode) {
      const input = snapshot.quick.input;
      if (!input?.text.trim()) {
        publish({
          ...snapshot,
          quick: {
            ...snapshot.quick,
            error: "还没有可分析的文本，请先选中一段内容。"
          }
        });
        return null;
      }

      const requestId = snapshot.quick.requestId + 1;
      publish({
        ...snapshot,
        workspaceMode: "quick",
        quick: {
          ...snapshot.quick,
          loading: true,
          error: "",
          activeMode: mode,
          requestId
        }
      });

      return {
        requestId,
        mode,
        input: { ...input }
      };
    },
    resolveQuickRequest(requestId, result) {
      if (requestId !== snapshot.quick.requestId) {
        return;
      }

      publish({
        ...snapshot,
        quick: {
          ...snapshot.quick,
          loading: false,
          response: result.response ?? snapshot.quick.response,
          error: result.error ?? ""
        }
      });
    },
    beginLongformRequest() {
      if (!snapshot.longform.input.articleText.trim()) {
        publish({
          ...snapshot,
          longform: {
            ...snapshot.longform,
            error: "先贴一段想拆解的长文内容，再开始核查。"
          }
        });
        return null;
      }

      const requestId = snapshot.longform.requestId + 1;
      publish({
        ...snapshot,
        workspaceMode: "longform",
        longform: {
          ...snapshot.longform,
          loading: true,
          error: "",
          requestId
        }
      });

      return {
        requestId,
        input: {
          ...snapshot.longform.input,
          referenceLinks: [],
          referenceNotes: ""
        }
      };
    },
    resolveLongformRequest(requestId, result) {
      if (requestId !== snapshot.longform.requestId) {
        return;
      }

      publish({
        ...snapshot,
        longform: {
          ...snapshot.longform,
          loading: false,
          response: result.response ?? snapshot.longform.response,
          error: result.error ?? ""
        }
      });
    }
  };
}

function createQuickWorkspace(): QuickWorkspaceSession {
  return {
    input: null,
    response: null,
    error: "",
    loading: false,
    activeMode: null,
    requestId: 0
  };
}

function createLongformWorkspace(): LongformWorkspaceSession {
  return {
    input: { ...EMPTY_LONGFORM_INPUT },
    response: null,
    error: "",
    loading: false,
    requestId: 0
  };
}

function normalizeTweetInput(input: TweetInput): TweetInput {
  return {
    ...input,
    text: input.text || ""
  };
}

function isSameTweetInput(current: TweetInput | null, next: TweetInput): boolean {
  return current?.text === next.text && current?.url === next.url;
}
