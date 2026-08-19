import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import siteIconUrl from "../../public/icons/icon.svg?url";
import { websiteContent as content, type MeditationFormat } from "./content";

type PageKey = "product" | "iterations" | "meditations" | "about" | "privacy";

const pageLinks: Record<PageKey, string> = {
  product: "./index.html",
  iterations: "./iterations.html",
  meditations: "./meditations.html",
  about: "./about.html",
  privacy: "./privacy.html"
};

const githubRepository =
  import.meta.env.VITE_GITHUB_REPOSITORY?.trim() || "tcitrhao/reality-splitter";
const repositoryUrl = `https://github.com/${githubRepository}`;
const productVersion = __REALITY_SPLITTER_VERSION__;
const offlinePackageName = `reality-splitter-offline-v${productVersion}.zip`;
const downloadUrl = `${repositoryUrl}/releases/latest/download/${offlinePackageName}`;
const chromeWebStoreUrl = import.meta.env.VITE_CHROME_WEB_STORE_URL?.trim();
const installUrl = chromeWebStoreUrl || downloadUrl;

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
        {currentPage === "privacy" ? <PrivacyPage /> : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ currentPage }: { currentPage: PageKey }) {
  const navigation = content.site.navigation;
  const items: Array<{ key: Exclude<PageKey, "privacy">; label: string }> = [
    { key: "product", label: navigation.product },
    { key: "iterations", label: navigation.iterations },
    { key: "meditations", label: navigation.meditations },
    { key: "about", label: navigation.about }
  ];

  return (
    <header className="site-header">
      <a className="site-name" href={pageLinks.product}>
        <img src={siteIconUrl} alt="" width="36" height="36" />
        <span className="site-name__copy">
          <strong>{content.site.brand}</strong>
          <small>{content.site.tagline}</small>
        </span>
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

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__identity">
        <strong>{content.site.brand}</strong>
        <span>{content.site.footer.statement}</span>
      </div>
      <p>{content.site.footer.copyright}</p>
    </footer>
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
          <a className="hero-download" href={installUrl} target="_blank" rel="noreferrer">
            {chromeWebStoreUrl
              ? product.storeButtonLabel
              : `${product.downloadButtonLabel} v${productVersion}`}
          </a>
          <a href="#offline-install">{product.howItWorksLabel}</a>
          <a href={pageLinks.iterations}>{product.iterationsLinkLabel}</a>
        </div>
      </section>

      <section className="product-thesis" aria-labelledby="product-thesis-title">
        <header>
          <h2 id="product-thesis-title">{product.thesis.title}</h2>
        </header>
        <p>{product.thesis.body}</p>
      </section>

      <section className="reading-section" id="how-it-works">
        <div className="reading-section__copy">
          <SectionTitle
            title={product.sectionTitle}
            description={product.sectionDescription}
          />
        </div>

        <div className="mode-showcase" aria-label="两种分析模式示例">
          {product.modes.map((mode) => (
            <article className="mode-card" key={mode.title}>
              <header className="mode-card__header">
                <div className="mode-card__title-row">
                  <h3>{mode.title}</h3>
                  <span>{mode.meta}</span>
                </div>
                <p>{mode.body}</p>
              </header>

              <div className="mode-card__input">
                <span>{mode.example.inputLabel}</span>
                <p>{mode.example.input}</p>
              </div>

              <div className="mode-card__output">
                <span>{mode.example.outputLabel}</span>
                <ul>
                  {mode.example.results.map((result) => (
                    <li key={result.label}>
                      <strong>{result.label}</strong>
                      <span>{result.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>

        <div className="step-list">
          {product.steps.map((step) => (
            <article key={step.number}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-principles" aria-labelledby="principles-title">
        <header>
          <h2 id="principles-title">{product.principles.title}</h2>
        </header>
        <div className="product-principles__list">
          {product.principles.items.map((item) => (
            <article key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="offline-install" id="offline-install">
        <div className="offline-install__intro">
          <h2>{product.offlineInstall.title}</h2>
          <p>{product.offlineInstall.description}</p>
        </div>

        <ol className="offline-install__steps">
          {product.offlineInstall.steps.map((step) => (
            <li key={step.number}>
              <div>
                <strong>{step.title}</strong>
                <p>{step.body.replace("{offlinePackageName}", offlinePackageName)}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="offline-install__note">{product.offlineInstall.networkNote}</p>
      </section>
    </>
  );
}

function IterationsPage() {
  const page = content.iterationsPage;

  return (
    <div className="standalone-page standalone-page--iterations">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content" aria-label="产品迭代记录">
        <div className="iteration-list iteration-list--page">
          {content.iterations.map((item, index) => (
            <article
              key={`${item.version}-${item.title}`}
              className={index === 0 ? "is-latest" : undefined}
            >
              <div className="iteration-meta">
                <strong>{item.version}</strong>
                <span>{item.state}</span>
              </div>
              <div className="iteration-entry__content">
                <h2>{item.title}</h2>
                <div className="iteration-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
                </div>
                <div className="iteration-learning">
                  <strong>{page.learningLabel}</strong>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.learning}</ReactMarkdown>
                </div>
              </div>
            </article>
          ))}
        </div>
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

  const longItems = content.meditations.filter(
    (item) => meditationFormat(item) === "long"
  );

  return (
    <div className="standalone-page standalone-page--meditations">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content" aria-label="AI 沉思录文章">
        {longItems.length ? (
          <div className="meditation-stream">
            {longItems.map((item, index) => (
              <LongMeditationEntry
                key={`${item.index}-${item.title}`}
                item={item}
                featured={index === 0}
              />
            ))}
          </div>
        ) : null}

        {!longItems.length ? (
          <div className="meditation-empty">还没有可阅读的长文。</div>
        ) : null}

      </section>
    </div>
  );
}

function meditationFormat(item: { format?: MeditationFormat; body: string }): MeditationFormat {
  return item.format ?? (item.body.trim().length > 600 ? "long" : "short");
}

function LongMeditationEntry({
  item,
  featured = false
}: {
  item: (typeof content.meditations)[number];
  featured?: boolean;
}) {
  const entry = (
    <>
      <div className="meditation-stream-entry__meta">
        <span>{item.publishedAt || "持续记录"}</span>
        <span>{item.readTime || "阅读时间待定"}</span>
      </div>
      <div>
        <h2>{item.title}</h2>
        <p>{item.excerpt}</p>
      </div>
    </>
  );

  return (
    <article
      className={`meditation-stream-entry meditation-stream-entry--long ${
        featured ? "is-featured" : ""
      }`}
    >
      {item.body.trim() ? (
        <a
          className="meditation-stream-entry__link"
          href={`${pageLinks.meditations}?article=${encodeURIComponent(item.index)}`}
        >
          {entry}
        </a>
      ) : (
        <div className="meditation-stream-entry__link">{entry}</div>
      )}
    </article>
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
          <span>{meditation.readTime || "阅读时间待定"}</span>
          <span>{meditation.publishedAt || "持续记录"}</span>
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
    <div className="standalone-page standalone-page--about">
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

        <div className="legal-links">
          <a href={pageLinks.privacy}>隐私说明</a>
          <a href={`${repositoryUrl}/issues`} target="_blank" rel="noreferrer">
            问题反馈
          </a>
        </div>
      </section>
    </div>
  );
}

function PrivacyPage() {
  const page = content.privacyPage;

  return (
    <article className="standalone-page privacy-page">
      <PageHero title={page.title} description={page.description} />

      <section className="page-content privacy-content">
        <p className="privacy-updated">{page.updatedAt}</p>
        <p className="privacy-intro">{page.intro}</p>

        {page.sections.map((section) => (
          <section key={section.title} className="privacy-section">
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <div className="legal-links">
          <a href={pageLinks.product}>返回产品页</a>
          <a href={`${repositoryUrl}/issues`} target="_blank" rel="noreferrer">
            GitHub Issues
          </a>
        </div>
      </section>
    </article>
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
