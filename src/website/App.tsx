import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { websiteContent as content } from "./content";

type PageKey = "product" | "iterations" | "meditations" | "about";

const pageLinks: Record<PageKey, string> = {
  product: "./index.html",
  iterations: "./iterations.html",
  meditations: "./meditations.html",
  about: "./about.html"
};

const githubRepository =
  import.meta.env.VITE_GITHUB_REPOSITORY?.trim() || "tcitrhao/reality-splitter";
const repositoryUrl = `https://github.com/${githubRepository}`;
const downloadUrl = `${repositoryUrl}/releases/latest/download/reality-splitter-chrome.zip`;

export default function App() {
  const requestedPage = document.body.dataset.page as PageKey | undefined;
  const currentPage = requestedPage && requestedPage in pageLinks ? requestedPage : "product";

  return (
    <div className="blog-shell">
      <SiteHeader currentPage={currentPage} />
      <main>
        {currentPage === "product" ? <ProductPage /> : null}
        {currentPage === "iterations" ? <IterationsPage /> : null}
        {currentPage === "meditations" ? <MeditationsPage /> : null}
        {currentPage === "about" ? <AboutPage /> : null}
      </main>
    </div>
  );
}

function SiteHeader({ currentPage }: { currentPage: PageKey }) {
  const navigation = content.site.navigation;
  const items: Array<{ key: PageKey; label: string }> = [
    { key: "product", label: navigation.product },
    { key: "iterations", label: navigation.iterations },
    { key: "meditations", label: navigation.meditations },
    { key: "about", label: navigation.about }
  ];

  return (
    <header className="site-header">
      <a className="site-name" href={pageLinks.product}>
        {content.site.brand}
      </a>
      <nav aria-label="主要导航">
        {items.map((item) => (
          <a
            key={item.key}
            href={pageLinks[item.key]}
            aria-current={currentPage === item.key ? "page" : undefined}
            className={currentPage === item.key ? "is-current" : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function ProductPage() {
  const product = content.product;

  return (
    <>
      <section className="product-hero">
        <h1>{product.title}</h1>
        <p className="hero-statement">{product.statement}</p>
        <p className="hero-intro">{product.intro}</p>

        <div className="hero-links">
          <a className="hero-download" href={downloadUrl}>
            {product.downloadButtonLabel}
          </a>
          <a href="#how-it-works">{product.howItWorksLabel}</a>
          <a href={pageLinks.iterations}>{product.iterationsLinkLabel}</a>
        </div>
      </section>

      <section className="reading-section" id="how-it-works">
        <SectionTitle
          title={product.sectionTitle}
          description={product.sectionDescription}
        />

        <div className="product-example">
          <div className="source-text">
            <span>{product.sourceLabel}</span>
            <p>{product.sourceText}</p>
          </div>
          <div className="split-result">
            <span>{product.resultLabel}</span>
            <ul>
              {product.results.map((result) => (
                <li key={result.label}>
                  <strong>{result.label}</strong> {result.text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="step-list">
          {product.steps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function IterationsPage() {
  const page = content.iterationsPage;

  return (
    <div className="standalone-page">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content" aria-label="产品迭代记录">
        <div className="iteration-list iteration-list--page">
          {content.iterations.map((item) => (
            <article key={`${item.version}-${item.title}`}>
              <div className="iteration-meta">
                <span>{item.state}</span>
                <strong>{item.version}</strong>
              </div>
              <div>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
                <p className="iteration-learning">
                  <strong>{page.learningLabel}</strong>
                  {item.learning}
                </p>
              </div>
            </article>
          ))}
        </div>

        <aside className="continuation-note">
          <span>{page.nextLabel}</span>
          <p>{page.nextText}</p>
        </aside>
      </section>
    </div>
  );
}

function MeditationsPage() {
  const page = content.meditationsPage;
  const selectedIndex = new URLSearchParams(window.location.search).get("article");
  const selectedMeditation = content.meditations.find(
    (item) => item.index === selectedIndex && item.body.trim()
  );

  if (selectedMeditation) {
    return <MeditationArticle meditation={selectedMeditation} />;
  }

  return (
    <div className="standalone-page">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content" aria-label="AI 沉思录文章">
        <div className="meditation-list meditation-list--page">
          {content.meditations.map((item) => {
            const entry = (
              <>
                <span className="meditation-index">{item.index}</span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.excerpt}</p>
                </div>
                <span className="meditation-status">{item.status}</span>
              </>
            );

            return (
              <article key={`${item.index}-${item.title}`}>
                {item.body.trim() ? (
                  <a
                    className="meditation-entry"
                    href={`${pageLinks.meditations}?article=${encodeURIComponent(item.index)}`}
                  >
                    {entry}
                  </a>
                ) : (
                  <div className="meditation-entry">{entry}</div>
                )}
              </article>
            );
          })}
        </div>

        <p className="archive-note">{page.archiveNote}</p>
      </section>
    </div>
  );
}

function MeditationArticle({
  meditation
}: {
  meditation: (typeof content.meditations)[number];
}) {
  return (
    <article className="meditation-article">
      <a className="article-back" href={pageLinks.meditations}>
        ← 返回 AI 沉思录
      </a>
      <header>
        <div className="article-meta">
          <span>{meditation.index}</span>
          <span>{meditation.status}</span>
        </div>
        <h1>{meditation.title}</h1>
        <p>{meditation.excerpt}</p>
      </header>
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a {...props} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          }}
        >
          {meditation.body}
        </ReactMarkdown>
      </div>
    </article>
  );
}

function AboutPage() {
  const page = content.aboutPage;

  return (
    <div className="standalone-page">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content about-page-content">
        <div className="about-copy">
          {page.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <dl className="project-principles">
          {page.principles.map((principle) => (
            <div key={principle.title}>
              <dt>{principle.title}</dt>
              <dd>{principle.body}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

function PageHero({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="page-hero">
      <h1>{title}</h1>
      <div className="page-hero__description">
        <p>{description}</p>
      </div>
    </header>
  );
}

function SectionTitle({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="section-title">
      <h2>{title}</h2>
      <div className="section-description">
        <p>{description}</p>
      </div>
    </header>
  );
}
