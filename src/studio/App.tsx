import { useEffect, useState } from "react";
import { websiteContent as defaultContent, type WebsiteContent } from "../website/content";

type StudioSection = "copy" | "iterations" | "meditations" | "about";
type Iteration = WebsiteContent["iterations"][number];
type Meditation = WebsiteContent["meditations"][number];

const sections: Array<{ key: StudioSection; label: string }> = [
  { key: "copy", label: "首页文案" },
  { key: "iterations", label: "产品更新" },
  { key: "meditations", label: "AI 沉思录" },
  { key: "about", label: "关于" }
];

export default function App() {
  const [content, setContent] = useState<WebsiteContent>(() => structuredClone(defaultContent));
  const [activeSection, setActiveSection] = useState<StudioSection>("copy");
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("正在连接本地内容服务...");

  useEffect(() => {
    void loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("内容服务不可用");
      }

      const nextContent = (await response.json()) as WebsiteContent;
      setContent(nextContent);
      setBackendAvailable(true);
      setMessage("已读取当前网站文案");
    } catch {
      setBackendAvailable(false);
      setMessage("当前是只读预览。请运行 npm run studio 后再发布内容。");
    }
  };

  const publishContent = async () => {
    setPublishing(true);
    setMessage("正在写入文案并重新生成网站...");

    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content)
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "发布失败");
      }

      setMessage("发布完成。网站已经使用最新内容重新生成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败，请稍后再试。");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div>
          <p>Reality Splitter</p>
          <h1>内容后台</h1>
        </div>
        <div className="studio-actions">
          <a href="./index.html" target="_blank" rel="noreferrer">
            查看网站
          </a>
          <button type="button" onClick={() => void loadContent()} disabled={publishing}>
            重新载入
          </button>
          <button
            className="publish-button"
            type="button"
            onClick={() => void publishContent()}
            disabled={!backendAvailable || publishing}
          >
            {publishing ? "发布中..." : "发布内容"}
          </button>
        </div>
      </header>

      <div className="studio-status" data-ready={backendAvailable}>
        <span />
        {message}
      </div>

      <div className="studio-layout">
        <nav className="studio-nav" aria-label="内容分类">
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              className={activeSection === section.key ? "is-active" : ""}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <main className="studio-main">
          {activeSection === "copy" ? (
            <CopyEditor content={content} onChange={setContent} />
          ) : null}
          {activeSection === "iterations" ? (
            <IterationsEditor content={content} onChange={setContent} />
          ) : null}
          {activeSection === "meditations" ? (
            <MeditationsEditor content={content} onChange={setContent} />
          ) : null}
          {activeSection === "about" ? (
            <AboutEditor content={content} onChange={setContent} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function CopyEditor({
  content,
  onChange
}: {
  content: WebsiteContent;
  onChange: (next: WebsiteContent) => void;
}) {
  const updateSite = (field: "brand" | "footerDescription", value: string) => {
    onChange({ ...content, site: { ...content.site, [field]: value } });
  };
  const updateProduct = (field: keyof WebsiteContent["product"], value: string) => {
    onChange({ ...content, product: { ...content.product, [field]: value } });
  };

  return (
    <EditorSection title="首页文案" description="管理品牌名称、首屏和产品介绍的主要文字。">
      <Field label="网站名称" value={content.site.brand} onChange={(value) => updateSite("brand", value)} />
      <Field label="页脚说明" value={content.site.footerDescription} onChange={(value) => updateSite("footerDescription", value)} />
      <Field label="首屏小标题" value={content.product.overline} onChange={(value) => updateProduct("overline", value)} />
      <Field label="产品名称" value={content.product.title} onChange={(value) => updateProduct("title", value)} />
      <Field label="核心表达" value={content.product.statement} onChange={(value) => updateProduct("statement", value)} />
      <Field label="产品介绍" multiline value={content.product.intro} onChange={(value) => updateProduct("intro", value)} />
      <div className="field-grid">
        <Field label="当前版本" value={content.product.version} onChange={(value) => updateProduct("version", value)} />
        <Field label="项目状态" value={content.product.status} onChange={(value) => updateProduct("status", value)} />
        <Field label="项目性质" value={content.product.nature} onChange={(value) => updateProduct("nature", value)} />
      </div>
      <Field label="产品区标题" value={content.product.sectionTitle} onChange={(value) => updateProduct("sectionTitle", value)} />
      <Field label="产品区说明" multiline value={content.product.sectionDescription} onChange={(value) => updateProduct("sectionDescription", value)} />
    </EditorSection>
  );
}

function IterationsEditor({
  content,
  onChange
}: {
  content: WebsiteContent;
  onChange: (next: WebsiteContent) => void;
}) {
  const updatePage = (field: keyof WebsiteContent["iterationsPage"], value: string) => {
    onChange({ ...content, iterationsPage: { ...content.iterationsPage, [field]: value } });
  };
  const updateItem = (index: number, field: keyof Iteration, value: string) => {
    const iterations = content.iterations.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
    onChange({ ...content, iterations });
  };
  const addItem = () => {
    const next: Iteration = {
      state: "最新",
      version: "v0.0.0",
      title: "新的产品更新",
      body: "记录这次更新做了什么。",
      learning: "记录这次迭代真正学到了什么。"
    };
    onChange({ ...content, iterations: [next, ...content.iterations] });
  };
  const removeItem = (index: number) => {
    onChange({ ...content, iterations: content.iterations.filter((_, itemIndex) => itemIndex !== index) });
  };

  return (
    <EditorSection
      title="产品更新"
      description="最新内容排在最前面。发布后会出现在独立的迭代页面。"
      action={<button type="button" onClick={addItem}>新增更新</button>}
    >
      <Field label="页面标题" value={content.iterationsPage.title} onChange={(value) => updatePage("title", value)} />
      <Field label="页面说明" multiline value={content.iterationsPage.description} onChange={(value) => updatePage("description", value)} />
      <div className="entry-list">
        {content.iterations.map((item, index) => (
          <article className="entry-editor" key={`${index}-${item.version}`}>
            <div className="entry-editor__head">
              <strong>{item.title || "未命名更新"}</strong>
              <button type="button" onClick={() => removeItem(index)}>删除</button>
            </div>
            <div className="field-grid">
              <Field label="阶段" value={item.state} onChange={(value) => updateItem(index, "state", value)} />
              <Field label="版本" value={item.version} onChange={(value) => updateItem(index, "version", value)} />
            </div>
            <Field label="标题" value={item.title} onChange={(value) => updateItem(index, "title", value)} />
            <Field label="更新内容" multiline value={item.body} onChange={(value) => updateItem(index, "body", value)} />
            <Field label="这一阶段的学习" multiline value={item.learning} onChange={(value) => updateItem(index, "learning", value)} />
          </article>
        ))}
      </div>
    </EditorSection>
  );
}

function MeditationsEditor({
  content,
  onChange
}: {
  content: WebsiteContent;
  onChange: (next: WebsiteContent) => void;
}) {
  const updatePage = (field: keyof WebsiteContent["meditationsPage"], value: string) => {
    onChange({ ...content, meditationsPage: { ...content.meditationsPage, [field]: value } });
  };
  const updateItem = (index: number, field: keyof Meditation, value: string) => {
    const meditations = content.meditations.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );
    onChange({ ...content, meditations });
  };
  const addItem = () => {
    const number = String(content.meditations.length + 1).padStart(2, "0");
    const next: Meditation = {
      index: number,
      title: "新的 AI 沉思",
      excerpt: "写下一段摘要，说明这篇思考关心的问题。",
      body: "",
      status: "写作中"
    };
    onChange({ ...content, meditations: [next, ...content.meditations] });
  };
  const removeItem = (index: number) => {
    onChange({ ...content, meditations: content.meditations.filter((_, itemIndex) => itemIndex !== index) });
  };

  return (
    <EditorSection
      title="AI 沉思录"
      description="管理思考题目、摘要、正文与写作状态。"
      action={<button type="button" onClick={addItem}>新增沉思</button>}
    >
      <Field label="页面标题" value={content.meditationsPage.title} onChange={(value) => updatePage("title", value)} />
      <Field label="页面说明" multiline value={content.meditationsPage.description} onChange={(value) => updatePage("description", value)} />
      <div className="entry-list">
        {content.meditations.map((item, index) => (
          <article className="entry-editor" key={`${index}-${item.index}`}>
            <div className="entry-editor__head">
              <strong>{item.title || "未命名沉思"}</strong>
              <button type="button" onClick={() => removeItem(index)}>删除</button>
            </div>
            <div className="field-grid">
              <Field label="编号" value={item.index} onChange={(value) => updateItem(index, "index", value)} />
              <Field label="状态" value={item.status} onChange={(value) => updateItem(index, "status", value)} />
            </div>
            <Field label="标题" value={item.title} onChange={(value) => updateItem(index, "title", value)} />
            <Field label="摘要" multiline value={item.excerpt} onChange={(value) => updateItem(index, "excerpt", value)} />
            <Field label="正文" multiline value={item.body} onChange={(value) => updateItem(index, "body", value)} />
          </article>
        ))}
      </div>
    </EditorSection>
  );
}

function AboutEditor({
  content,
  onChange
}: {
  content: WebsiteContent;
  onChange: (next: WebsiteContent) => void;
}) {
  const updatePage = (field: "title" | "description", value: string) => {
    onChange({ ...content, aboutPage: { ...content.aboutPage, [field]: value } });
  };
  const updateParagraph = (index: number, value: string) => {
    const paragraphs = content.aboutPage.paragraphs.map((paragraph, paragraphIndex) =>
      paragraphIndex === index ? value : paragraph
    );
    onChange({ ...content, aboutPage: { ...content.aboutPage, paragraphs } });
  };

  return (
    <EditorSection title="关于" description="管理项目定位与个人说明。">
      <Field label="页面标题" value={content.aboutPage.title} onChange={(value) => updatePage("title", value)} />
      <Field label="页面说明" multiline value={content.aboutPage.description} onChange={(value) => updatePage("description", value)} />
      {content.aboutPage.paragraphs.map((paragraph, index) => (
        <Field
          key={index}
          label={`正文 ${index + 1}`}
          multiline
          value={paragraph}
          onChange={(value) => updateParagraph(index, value)}
        />
      ))}
    </EditorSection>
  );
}

function EditorSection({
  title,
  description,
  action,
  children
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="editor-section">
      <header className="editor-section__head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {action}
      </header>
      <div className="editor-fields">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  multiline = false,
  onChange
}: {
  label: string;
  value: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="studio-field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} rows={4} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}
