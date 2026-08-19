import rawContent from "../../content/website-content.json";

export type MeditationFormat = "short" | "long";

export interface WebsiteContent {
  site: {
    brand: string;
    tagline: string;
    navigation: {
      product: string;
      iterations: string;
      meditations: string;
      about: string;
    };
    footer: {
      statement: string;
      copyright: string;
    };
  };
  product: {
    eyebrow: string;
    title: string;
    statement: string;
    intro: string;
    downloadButtonLabel: string;
    storeButtonLabel: string;
    howItWorksLabel: string;
    iterationsLinkLabel: string;
    thesis: {
      eyebrow: string;
      title: string;
      body: string;
    };
    sectionTitle: string;
    sectionDescription: string;
    modes: Array<{
      title: string;
      meta: string;
      body: string;
      example: {
        inputLabel: string;
        input: string;
        outputLabel: string;
        results: Array<{ label: string; text: string }>;
      };
    }>;
    steps: Array<{ number: string; title: string; body: string }>;
    principles: {
      eyebrow: string;
      title: string;
      items: Array<{ title: string; body: string }>;
    };
    offlineInstall: {
      title: string;
      description: string;
      steps: Array<{ number: string; title: string; body: string }>;
      networkNote: string;
    };
  };
  iterationsPage: {
    eyebrow: string;
    title: string;
    description: string;
    learningLabel: string;
    next: PageNextContent;
  };
  iterations: Array<{
    state: string;
    version: string;
    title: string;
    body: string;
    learning: string;
  }>;
  meditationsPage: {
    eyebrow: string;
    title: string;
    description: string;
    next: PageNextContent;
  };
  meditations: Array<{
    index: string;
    title: string;
    excerpt: string;
    body: string;
    status: string;
    format?: MeditationFormat;
    tags?: string[];
    publishedAt?: string;
    readTime?: string;
  }>;
  aboutPage: {
    eyebrow: string;
    title: string;
    description: string;
    paragraphs: string[];
    principles: Array<{ title: string; body: string }>;
    next: PageNextContent;
  };
  privacyPage: {
    eyebrow: string;
    title: string;
    description: string;
    updatedAt: string;
    intro: string;
    sections: Array<{
      title: string;
      paragraphs: string[];
    }>;
  };
}

interface PageNextContent {
  eyebrow: string;
  title: string;
  label: string;
}

export const websiteContent = rawContent as WebsiteContent;
