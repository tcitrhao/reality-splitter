import type { WebsiteContent } from "../website/content";

const DRAFT_STORAGE_KEY = "reality-splitter-studio-draft-v1";

export interface StudioDraft {
  baseContent: WebsiteContent;
  baseSha: string;
  content: WebsiteContent;
  savedAt: string;
}

export function readStudioDraft(): StudioDraft | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const draft = JSON.parse(raw) as Partial<StudioDraft>;
    if (!draft.baseContent || !draft.content || !draft.baseSha || !draft.savedAt) {
      clearStudioDraft();
      return undefined;
    }
    return draft as StudioDraft;
  } catch {
    clearStudioDraft();
    return undefined;
  }
}

export function saveStudioDraft(draft: Omit<StudioDraft, "savedAt">): StudioDraft {
  const savedDraft: StudioDraft = {
    ...draft,
    savedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(savedDraft));
  } catch {
    throw new Error("浏览器无法保存草稿，请检查隐私模式或本地存储空间。");
  }
  return savedDraft;
}

export function clearStudioDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Clearing a draft should never block signing out or publishing.
  }
}
