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
      copyright: string;
    };
  };
  product: {
    title: string;
    statement: string;
    intro: string;
    downloadButtonLabel: string;
    storeButtonLabel: string;
    howItWorksLabel: string;
    iterationsLinkLabel: string;
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
    offlineInstall: {
      title: string;
      description: string;
      steps: Array<{ number: string; title: string; body: string }>;
      networkNote: string;
    };
  };
  iterationsPage: {
    title: string;
    description: string;
    learningLabel: string;
  };
  iterations: Array<{
    state: string;
    version: string;
    title: string;
    body: string;
    learning: string;
  }>;
  meditationsPage: {
    title: string;
    description: string;
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
    title: string;
    description: string;
    paragraphs: string[];
    principles: Array<{ title: string; body: string }>;
  };
  privacyPage: {
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

export const websiteContent = rawContent as WebsiteContent;
