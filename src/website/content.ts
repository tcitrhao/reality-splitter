import rawContent from "../../content/website-content.json";

export interface WebsiteContent {
  site: {
    brand: string;
    footerDescription: string;
    navigation: {
      product: string;
      iterations: string;
      meditations: string;
      about: string;
      download: string;
    };
  };
  product: {
    overline: string;
    title: string;
    statement: string;
    intro: string;
    howItWorksLabel: string;
    iterationsLinkLabel: string;
    versionLabel: string;
    version: string;
    statusLabel: string;
    status: string;
    natureLabel: string;
    nature: string;
    sectionLabel: string;
    sectionTitle: string;
    sectionDescription: string;
    sourceLabel: string;
    sourceText: string;
    resultLabel: string;
    results: Array<{ label: string; text: string }>;
    steps: Array<{ number: string; title: string; body: string }>;
    download: {
      label: string;
      title: string;
      description: string;
      buttonLabel: string;
      sourceLabel: string;
      unavailableLabel: string;
      steps: Array<{ number: string; title: string; body: string }>;
    };
  };
  iterationsPage: {
    label: string;
    title: string;
    description: string;
    learningLabel: string;
    nextLabel: string;
    nextText: string;
  };
  iterations: Array<{
    state: string;
    version: string;
    title: string;
    body: string;
    learning: string;
  }>;
  meditationsPage: {
    label: string;
    title: string;
    description: string;
    archiveNote: string;
  };
  meditations: Array<{
    index: string;
    title: string;
    excerpt: string;
    body: string;
    status: string;
  }>;
  aboutPage: {
    label: string;
    title: string;
    description: string;
    paragraphs: string[];
    principles: Array<{ title: string; body: string }>;
  };
}

export const websiteContent = rawContent as WebsiteContent;
