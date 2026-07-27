import { websiteContent as content } from "./content";

type PageKey = "product" | "iterations" | "meditations" | "about";

const pageLinks: Record<PageKey, string> = {
  product: "./index.html",
  iterations: "./iterations.html",
  meditations: "./meditations.html",
  about: "./about.html"
};

const githubRepository = import.meta.env.VITE_GITHUB_REPOSITORY?.trim();
const repositoryUrl = githubRepository
  ? `https://github.com/${githubRepository}`
  : undefined;
const downloadUrl = repositoryUrl
  ? `${repositoryUrl}/releases/latest/download/reality-splitter-chrome.zip`
  : undefined;

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
      <SiteFooter />
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
        <a href={`${pageLinks.product}#download`}>{navigation.download}</a>
      </nav>
    </header>
  );
}

function ProductPage() {
  const product = content.product;

  return (
    <>
      <section className="product-hero">
        <p className="overline">{product.overline}</p>
        <h1>{product.title}</h1>
        <p className="hero-statement">{product.statement}</p>
        <p className="hero-intro">{product.intro}</p>

        <div className="hero-links">
          <a className="hero-download" href={downloadUrl || "#download"}>
            {product.download.buttonLabel}
          </a>
          <a href="#how-it-works">{product.howItWorksLabel}</a>
          <a href={pageLinks.iterations}>{product.iterationsLinkLabel}</a>
        </div>

        <div className="product-status" aria-label="项目状态">
          <div>
            <span>{product.versionLabel}</span>
            <strong>{product.version}</strong>
          </div>
          <div>
            <span>{product.statusLabel}</span>
            <strong>{product.status}</strong>
          </div>
          <div>
            <span>{product.natureLabel}</span>
            <strong>{product.nature}</strong>
          </div>
        </div>
      </section>

      <section className="reading-section" id="how-it-works">
        <SectionTitle
          label={product.sectionLabel}
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

      <DownloadSection />
    </>
  );
}

function DownloadSection() {
  const download = content.product.download;

  return (
    <section className="reading-section download-section" id="download">
      <SectionTitle
        label={download.label}
        title={download.title}
        description={download.description}
      />

      <div className="download-content">
        <div className="download-actions">
          {downloadUrl ? (
            <a className="download-button" href={downloadUrl}>
              {download.buttonLabel}
            </a>
          ) : (
            <span className="download-button is-disabled">
              {download.unavailableLabel}
            </span>
          )}
          {repositoryUrl ? (
            <a className="source-link" href={repositoryUrl} target="_blank" rel="noreferrer">
              {download.sourceLabel}
            </a>
          ) : null}
        </div>

        <ol className="install-steps">
          {download.steps.map((step) => (
            <li key={step.number}>
              <span>{step.number}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function IterationsPage() {
  const page = content.iterationsPage;

  return (
    <div className="standalone-page">
      <PageHero label={page.label} title={page.title} description={page.description} />

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

  return (
    <div className="standalone-page">
      <PageHero label={page.label} title={page.title} description={page.description} />

      <section className="page-content" aria-label="AI 沉思录文章">
        <div className="meditation-list meditation-list--page">
          {content.meditations.map((item) => (
            <article key={`${item.index}-${item.title}`}>
              <span className="meditation-index">{item.index}</span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.excerpt}</p>
                {item.body ? <p className="meditation-body">{item.body}</p> : null}
              </div>
              <span className="meditation-status">{item.status}</span>
            </article>
          ))}
        </div>

        <p className="archive-note">{page.archiveNote}</p>
      </section>
    </div>
  );
}

function AboutPage() {
  const page = content.aboutPage;

  return (
    <div className="standalone-page">
      <PageHero label={page.label} title={page.title} description={page.description} />

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
  label,
  title,
  description
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-hero">
      <p>{label}</p>
      <h1>{title}</h1>
      <div className="page-hero__description">
        <p>{description}</p>
      </div>
    </header>
  );
}

function SectionTitle({
  label,
  title,
  description
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <header className="section-title">
      <p>{label}</p>
      <h2>{title}</h2>
      <div className="section-description">
        <p>{description}</p>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <strong>{content.site.brand}</strong>
        <span>{content.site.footerDescription}</span>
      </div>
      <a href={pageLinks.product}>回到产品 →</a>
    </footer>
  );
}
