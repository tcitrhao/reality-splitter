import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { websiteContent as defaultContent, type WebsiteContent } from "../website/content";
import {
  authenticateGitHub,
  clearSessionToken,
  loadGitHubContent,
  mergeWebsiteContent,
  publishGitHubContentSafely,
  readSessionToken,
  storeSessionToken,
  tokenSettingsUrl,
  type GitHubIdentity,
  verifyGitHubWriteAccess
} from "./githubContent";
import {
  clearStudioDraft,
  readStudioDraft,
  saveStudioDraft
} from "./draftStorage";

type StudioSection = "iterations" | "meditations";
type StudioState = "checking" | "signed-out" | "ready";
type Iteration = WebsiteContent["iterations"][number];
type Meditation = WebsiteContent["meditations"][number];

const isLocalStudio =
  import.meta.env?.VITE_STUDIO_MODE !== "remote" &&
  ["127.0.0.1", "localhost"].includes(window.location.hostname);

export default function App() {
  const [content, setContent] = useState<WebsiteContent>(() => structuredClone(defaultContent));
  const [savedContent, setSavedContent] = useState(() => JSON.stringify(defaultContent));
  const [activeSection, setActiveSection] = useState<StudioSection>("iterations");
  const [selectedIteration, setSelectedIteration] = useState(0);
  const [selectedMeditation, setSelectedMeditation] = useState(0);
  const [studioState, setStudioState] = useState<StudioState>("checking");
  const [identity, setIdentity] = useState<GitHubIdentity>();
  const [contentSha, setContentSha] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const [message, setMessage] = useState("正在读取官网内容...");
  const hasChanges = JSON.stringify(content) !== savedContent;

  useEffect(() => {
    void initializeStudio();
  }, []);

  useEffect(() => {
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      if (!hasChanges) {
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasChanges]);

  useEffect(() => {
    if (isLocalStudio || studioState !== "ready" || !hasChanges || !contentSha) {
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const draft = saveStudioDraft({
          baseContent: JSON.parse(savedContent) as WebsiteContent,
          baseSha: contentSha,
          content
        });
        setDraftSavedAt(draft.savedAt);
      } catch (error) {
        setMessage(errorMessage(error));
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [content, contentSha, hasChanges, savedContent, studioState]);

  const initializeStudio = async () => {
    if (isLocalStudio) {
      await loadLocalContent();
      return;
    }

    const token = readSessionToken();
    if (!token) {
      setStudioState("signed-out");
      setMessage("使用 GitHub 凭证登录后即可在线编辑和发布。");
      return;
    }

    try {
      await loadRemoteSession(token);
    } catch (error) {
      clearSessionToken();
      setStudioState("signed-out");
      setMessage(errorMessage(error));
    }
  };

  const applyContent = (nextContent: WebsiteContent, sha = "") => {
    setContent(nextContent);
    setSavedContent(JSON.stringify(nextContent));
    setContentSha(sha);
    setSelectedIteration(0);
    setSelectedMeditation(0);
    setStudioState("ready");
  };

  const loadLocalContent = async () => {
    setMessage("正在连接本地内容服务...");
    const response = await fetch("/api/content", { cache: "no-store" });
    if (!response.ok) {
      setStudioState("signed-out");
      setMessage("本地内容服务不可用，请通过 npm run studio 打开后台。");
      return;
    }

    applyContent((await response.json()) as WebsiteContent);
    setMessage("本地模式 · 内容会写入工作区文件");
  };

  const loadRemoteSession = async (token: string) => {
    setStudioState("checking");
    setMessage("正在验证 GitHub 账号并读取官网内容...");
    const [nextIdentity, snapshot] = await Promise.all([
      authenticateGitHub(token),
      loadGitHubContent(token),
      verifyGitHubWriteAccess(token)
    ]);
    setIdentity(nextIdentity);
    const draft = readStudioDraft();
    if (draft) {
      const restoredContent = mergeWebsiteContent(
        draft.baseContent,
        draft.content,
        snapshot.content
      );
      setContent(restoredContent);
      setSavedContent(JSON.stringify(snapshot.content));
      setContentSha(snapshot.sha);
      setDraftSavedAt(draft.savedAt);
      setSelectedIteration(0);
      setSelectedMeditation(0);
      setStudioState("ready");
      setMessage(`已连接 GitHub · ${nextIdentity.login} · 已恢复浏览器草稿`);
      return;
    }

    applyContent(snapshot.content, snapshot.sha);
    setDraftSavedAt("");
    setMessage(`已连接 GitHub · ${nextIdentity.login} · 已确认发布权限`);
  };

  const signIn = async (token: string) => {
    await loadRemoteSession(token);
    storeSessionToken(token);
  };

  const signOut = () => {
    clearSessionToken();
    setIdentity(undefined);
    setStudioState("signed-out");
    setMessage("已退出，当前标签页中的凭证已经清除；未发布草稿仍保留在本机。");
  };

  const reloadContent = async () => {
    if (hasChanges && !window.confirm("重新载入会丢弃尚未发布的修改，继续吗？")) {
      return;
    }

    try {
      if (isLocalStudio) {
        await loadLocalContent();
      } else {
        clearStudioDraft();
        setDraftSavedAt("");
        const token = readSessionToken();
        if (!token) {
          signOut();
          return;
        }
        await loadRemoteSession(token);
      }
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const saveDraft = () => {
    if (isLocalStudio || !hasChanges || !contentSha) {
      return;
    }
    try {
      const draft = saveStudioDraft({
        baseContent: JSON.parse(savedContent) as WebsiteContent,
        baseSha: contentSha,
        content
      });
      setDraftSavedAt(draft.savedAt);
      setMessage("草稿已保存到当前浏览器；确认无误后可继续发布到官网。");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  };

  const publishContent = async () => {
    setPublishing(true);
    setMessage(isLocalStudio ? "正在写入本地内容..." : "正在提交到 GitHub...");

    try {
      validateEditableContent(content);

      if (isLocalStudio) {
        const response = await fetch("/api/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(content)
        });
        const result = (await response.json()) as { ok?: boolean; error?: string };
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "本地发布失败。");
        }
        setSavedContent(JSON.stringify(content));
        setMessage("已写入工作区。继续通过 Git 提交即可更新公网网站。");
      } else {
        const token = readSessionToken();
        if (!token || !contentSha) {
          throw new Error("登录状态已经失效，请重新登录。");
        }
        const result = await publishGitHubContentSafely({
          baseContent: JSON.parse(savedContent) as WebsiteContent,
          content,
          sha: contentSha,
          token
        });
        const mergedRemoteChanges = JSON.stringify(result.content) !== JSON.stringify(content);
        setContent(result.content);
        setContentSha(result.sha);
        setSavedContent(JSON.stringify(result.content));
        clearStudioDraft();
        setDraftSavedAt("");
        setMessage(
          mergedRemoteChanges
            ? "已合并远程更新并提交，GitHub Pages 正在自动部署。"
            : "内容已提交，GitHub Pages 正在自动部署，通常几分钟内生效。"
        );
      }
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  if (!isLocalStudio && studioState !== "ready") {
    return (
      <LoginScreen
        checking={studioState === "checking"}
        message={message}
        onSignIn={signIn}
      />
    );
  }

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <a className="studio-brand" href="./index.html" target="_blank" rel="noreferrer">
          <span>R</span>
          <div>
            <strong>Reality Splitter</strong>
            <small>内容后台</small>
          </div>
        </a>
        <div className="studio-actions">
          {identity ? (
            <a className="account-chip" href={identity.profileUrl} target="_blank" rel="noreferrer">
              <img src={identity.avatarUrl} alt="" />
              {identity.login}
            </a>
          ) : (
            <span className="account-chip account-chip--local">本地模式</span>
          )}
          <button type="button" onClick={() => void reloadContent()} disabled={publishing}>
            重新载入
          </button>
          {!isLocalStudio ? (
            <button type="button" onClick={signOut} disabled={publishing}>
              退出
            </button>
          ) : null}
        </div>
      </header>

      <div className="studio-status" data-ready={studioState === "ready"}>
        <span />
        <p>{message}</p>
        {hasChanges ? <strong>有未发布修改</strong> : null}
        {hasChanges && draftSavedAt ? <small>浏览器草稿已保存</small> : null}
      </div>

      <nav className="studio-tabs" aria-label="内容分类">
        <button
          type="button"
          className={activeSection === "iterations" ? "is-active" : ""}
          onClick={() => setActiveSection("iterations")}
        >
          <span>01</span>
          迭代
          <small>{content.iterations.length} 条</small>
        </button>
        <button
          type="button"
          className={activeSection === "meditations" ? "is-active" : ""}
          onClick={() => setActiveSection("meditations")}
        >
          <span>02</span>
          AI 沉思录
          <small>{content.meditations.length} 篇</small>
        </button>
      </nav>

      <main className="studio-main">
        {activeSection === "iterations" ? (
          <IterationsEditor
            content={content}
            onChange={setContent}
            selectedIndex={selectedIteration}
            onSelect={setSelectedIteration}
            actions={{
              onSaveDraft: saveDraft,
              onPublish: () => void publishContent(),
              canSaveDraft: !isLocalStudio && hasChanges && !publishing,
              canPublish: hasChanges && !publishing,
              publishing,
              localMode: isLocalStudio
            }}
          />
        ) : (
          <MeditationsEditor
            content={content}
            onChange={setContent}
            selectedIndex={selectedMeditation}
            onSelect={setSelectedMeditation}
            actions={{
              onSaveDraft: saveDraft,
              onPublish: () => void publishContent(),
              canSaveDraft: !isLocalStudio && hasChanges && !publishing,
              canPublish: hasChanges && !publishing,
              publishing,
              localMode: isLocalStudio
            }}
          />
        )}
      </main>
    </div>
  );
}

function LoginScreen({
  checking,
  message,
  onSignIn
}: {
  checking: boolean;
  message: string;
  onSignIn: (token: string) => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await onSignIn(token);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-intro">
        <a className="studio-brand" href="./index.html">
          <span>R</span>
          <div>
            <strong>Reality Splitter</strong>
            <small>把信息重新分层</small>
          </div>
        </a>
        <div className="login-statement">
          <p>PRIVATE CONTENT STUDIO</p>
          <h1>把产品更新和思考，写回同一个网站。</h1>
          <span>编辑迭代与 AI 沉思录。Markdown 写作，保存后自动部署。</span>
        </div>
        <ol className="login-steps">
          <li><span>01</span>创建只授权本仓库的 Fine-grained Token</li>
          <li><span>02</span>Repository permissions 选择 Contents: Read and write</li>
          <li><span>03</span>令牌只保留在当前标签页，未发布草稿保存在当前浏览器</li>
        </ol>
      </section>

      <section className="login-card">
        <div>
          <span className="login-card__eyebrow">安全登录</span>
          <h2>连接 GitHub</h2>
          <p>后台不会保存 GitHub 密码，也不会把令牌写入网站或仓库。</p>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            <span>Fine-grained access token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="github_pat_..."
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <button type="submit" disabled={checking || submitting || !token.trim()}>
            {checking || submitting ? "正在验证..." : "登录内容后台"}
          </button>
        </form>
        <a className="token-link" href={tokenSettingsUrl} target="_blank" rel="noreferrer">
          创建 GitHub 访问令牌 ↗
        </a>
        <p className={error ? "login-feedback is-error" : "login-feedback"}>
          {error || message}
        </p>
      </section>
    </main>
  );
}

function IterationsEditor({
  content,
  onChange,
  selectedIndex,
  onSelect,
  actions
}: EditorProps) {
  const item = content.iterations[selectedIndex];

  const updatePage = (field: keyof WebsiteContent["iterationsPage"], value: string) => {
    onChange({ ...content, iterationsPage: { ...content.iterationsPage, [field]: value } });
  };
  const updateItem = (field: keyof Iteration, value: string) => {
    const iterations = content.iterations.map((entry, index) =>
      index === selectedIndex ? { ...entry, [field]: value } : entry
    );
    onChange({ ...content, iterations });
  };
  const addItem = () => {
    const next: Iteration = {
      state: new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date()).replaceAll("/", "."),
      version: "v0.0.0",
      title: "新的产品迭代",
      body: "用 **Markdown** 记录这次更新。",
      learning: "这次真正学到了什么？"
    };
    onChange({ ...content, iterations: [next, ...content.iterations] });
    onSelect(0);
  };
  const removeItem = () => {
    if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) {
      return;
    }
    const iterations = content.iterations.filter((_, index) => index !== selectedIndex);
    onChange({ ...content, iterations });
    onSelect(Math.max(0, Math.min(selectedIndex, iterations.length - 1)));
  };

  return (
    <ContentEditorLayout
      title="迭代"
      description="最新记录排在最前。正文与阶段学习均支持 Markdown。"
      items={content.iterations.map((entry) => ({ meta: entry.version, title: entry.title }))}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onAdd={addItem}
      addLabel="新增迭代"
      actions={actions}
    >
      <PageSettings title="迭代页设置">
        <Field label="页面标题" value={content.iterationsPage.title} onChange={(value) => updatePage("title", value)} />
        <Field label="页面说明" value={content.iterationsPage.description} onChange={(value) => updatePage("description", value)} />
        <Field label="下一步" value={content.iterationsPage.nextText} onChange={(value) => updatePage("nextText", value)} />
      </PageSettings>
      {item ? (
        <section className="entry-canvas">
          <EditorHeading title={item.title || "未命名迭代"} onDelete={removeItem} />
          <div className="field-grid field-grid--two">
            <Field label="日期 / 阶段" value={item.state} onChange={(value) => updateItem("state", value)} />
            <Field label="版本" value={item.version} onChange={(value) => updateItem("version", value)} />
          </div>
          <Field label="标题" value={item.title} onChange={(value) => updateItem("title", value)} />
          <MarkdownField label="更新内容" value={item.body} onChange={(value) => updateItem("body", value)} rows={10} />
          <MarkdownField label="这一阶段的学习" value={item.learning} onChange={(value) => updateItem("learning", value)} rows={7} />
        </section>
      ) : <EmptyEditor onAdd={addItem} label="新增第一条迭代" />}
    </ContentEditorLayout>
  );
}

function MeditationsEditor({
  content,
  onChange,
  selectedIndex,
  onSelect,
  actions
}: EditorProps) {
  const item = content.meditations[selectedIndex];

  const updatePage = (field: keyof WebsiteContent["meditationsPage"], value: string) => {
    onChange({ ...content, meditationsPage: { ...content.meditationsPage, [field]: value } });
  };
  const updateItem = (field: keyof Meditation, value: string) => {
    const meditations = content.meditations.map((entry, index) =>
      index === selectedIndex ? { ...entry, [field]: value } : entry
    );
    onChange({ ...content, meditations });
  };
  const addItem = () => {
    const nextNumber = String(
      Math.max(0, ...content.meditations.map((entry) => Number.parseInt(entry.index, 10) || 0)) + 1
    ).padStart(2, "0");
    const next: Meditation = {
      index: nextNumber,
      title: "新的 AI 沉思",
      excerpt: "用一句话说明这篇文章关心的问题。",
      body: "# 从这里开始\n\n使用 Markdown 写下完整正文。",
      status: "写作中"
    };
    onChange({ ...content, meditations: [next, ...content.meditations] });
    onSelect(0);
  };
  const removeItem = () => {
    if (!item || !window.confirm(`确定删除“${item.title}”吗？`)) {
      return;
    }
    const meditations = content.meditations.filter((_, index) => index !== selectedIndex);
    onChange({ ...content, meditations });
    onSelect(Math.max(0, Math.min(selectedIndex, meditations.length - 1)));
  };

  return (
    <ContentEditorLayout
      title="AI 沉思录"
      description="标题和摘要进入文章列表，Markdown 正文进入独立阅读页。"
      items={content.meditations.map((entry) => ({ meta: `${entry.index} · ${entry.status}`, title: entry.title }))}
      selectedIndex={selectedIndex}
      onSelect={onSelect}
      onAdd={addItem}
      addLabel="新增沉思"
      actions={actions}
    >
      <PageSettings title="沉思录设置">
        <Field label="页面标题" value={content.meditationsPage.title} onChange={(value) => updatePage("title", value)} />
        <Field label="页面说明" value={content.meditationsPage.description} onChange={(value) => updatePage("description", value)} />
        <Field label="列表尾注" value={content.meditationsPage.archiveNote} onChange={(value) => updatePage("archiveNote", value)} />
      </PageSettings>
      {item ? (
        <section className="entry-canvas">
          <EditorHeading title={item.title || "未命名沉思"} onDelete={removeItem} />
          <div className="field-grid field-grid--two">
            <Field label="编号" value={item.index} onChange={(value) => updateItem("index", value)} />
            <Field label="状态" value={item.status} onChange={(value) => updateItem("status", value)} />
          </div>
          <Field label="标题" value={item.title} onChange={(value) => updateItem("title", value)} />
          <Field multiline rows={3} label="摘要" value={item.excerpt} onChange={(value) => updateItem("excerpt", value)} />
          <MarkdownField label="Markdown 正文" value={item.body} onChange={(value) => updateItem("body", value)} rows={24} />
        </section>
      ) : <EmptyEditor onAdd={addItem} label="新增第一篇沉思" />}
    </ContentEditorLayout>
  );
}

interface EditorProps {
  content: WebsiteContent;
  onChange: (content: WebsiteContent) => void;
  selectedIndex: number;
  onSelect: (index: number) => void;
  actions: StudioEditorActions;
}

interface StudioEditorActions {
  onSaveDraft: () => void;
  onPublish: () => void;
  canSaveDraft: boolean;
  canPublish: boolean;
  publishing: boolean;
  localMode: boolean;
}

function ContentEditorLayout({
  title,
  description,
  items,
  selectedIndex,
  onSelect,
  onAdd,
  addLabel,
  actions,
  children
}: {
  title: string;
  description: string;
  items: Array<{ meta: string; title: string }>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  addLabel: string;
  actions: StudioEditorActions;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="workspace-heading">
        <div>
          <span>CONTENT WORKSPACE</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <button type="button" onClick={onAdd}>{addLabel}</button>
      </header>
      <div className="editor-layout">
        <aside className="entry-rail" aria-label={`${title}内容列表`}>
          {items.map((item, index) => (
            <button
              type="button"
              key={`${item.meta}-${index}`}
              className={selectedIndex === index ? "is-active" : ""}
              onClick={() => onSelect(index)}
            >
              <small>{item.meta}</small>
              <strong>{item.title || "未命名内容"}</strong>
            </button>
          ))}
        </aside>
        <div className="editor-column">{children}</div>
      </div>
      <StudioEditorActionsBar actions={actions} />
    </section>
  );
}

function StudioEditorActionsBar({ actions }: { actions: StudioEditorActions }) {
  return (
    <div className="studio-editor-actions">
      <div>
        <strong>{actions.localMode ? "确认内容后写入本地" : "确认内容后再发布"}</strong>
        <span>
          {actions.localMode
            ? "发布会写入工作区文件。"
            : "修改会自动保存为浏览器草稿，发布后官网才会更新。"}
        </span>
      </div>
      <div className="studio-editor-actions__buttons">
        {!actions.localMode ? (
          <button type="button" onClick={actions.onSaveDraft} disabled={!actions.canSaveDraft}>
            保存草稿
          </button>
        ) : null}
        <button
          className="publish-button"
          type="button"
          onClick={actions.onPublish}
          disabled={!actions.canPublish}
        >
          {actions.publishing
            ? "发布中..."
            : actions.localMode
              ? "写入本地内容"
              : actions.canPublish
                ? "发布到官网"
                : "已是最新"}
        </button>
      </div>
    </div>
  );
}

function PageSettings({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="page-settings">
      <summary>{title}<span>展开</span></summary>
      <div>{children}</div>
    </details>
  );
}

function EditorHeading({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <header className="entry-canvas__head">
      <div>
        <span>正在编辑</span>
        <h2>{title}</h2>
      </div>
      <button type="button" onClick={onDelete}>删除</button>
    </header>
  );
}

function EmptyEditor({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="empty-editor">
      <p>这里还没有内容。</p>
      <button type="button" onClick={onAdd}>{label}</button>
    </div>
  );
}

function Field({
  label,
  value,
  multiline = false,
  rows = 4,
  onChange
}: {
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function MarkdownField({
  label,
  value,
  rows,
  onChange
}: {
  label: string;
  value: string;
  rows: number;
  onChange: (value: string) => void;
}) {
  return (
    <section className="markdown-field">
      <div className="markdown-field__head">
        <span>{label}</span>
        <small>Markdown · 即时预览</small>
      </div>
      <div className="markdown-grid">
        <textarea
          aria-label={label}
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {value.trim() || "_暂无内容_"}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}

function validateEditableContent(content: WebsiteContent): void {
  if (!content.iterations.length && !content.meditations.length) {
    throw new Error("迭代和 AI 沉思录不能同时为空。");
  }
  if (content.iterations.some((item) => !item.title.trim() || !item.body.trim())) {
    throw new Error("每条迭代都需要标题和更新内容。");
  }
  if (content.meditations.some((item) => !item.title.trim() || !item.excerpt.trim())) {
    throw new Error("每篇 AI 沉思都需要标题和摘要。");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后再试。";
}
