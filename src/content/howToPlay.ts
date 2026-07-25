import guideDocument from '../../public/content/how-to-play.json';

export type HowToPlayControl = {
  keyGroups: string[][];
  keyGroupJoiner: string;
  description: string;
  spoken: string;
};

export type HowToPlaySection =
  | { id: string; heading: string; kind: 'ordered'; items: string[] }
  | { id: string; heading: string; kind: 'controls'; items: HowToPlayControl[] }
  | { id: string; heading: string; kind: 'prose'; paragraphs: string[] };

export type HowToPlayDocument = {
  eyebrow: string;
  title: string;
  intro: string;
  voiceLineId: string;
  sections: HowToPlaySection[];
};

export const HOW_TO_PLAY = guideDocument as HowToPlayDocument;

export function buildHowToPlayNarration(document: HowToPlayDocument): string {
  const parts = [`${document.title}.`, document.intro];

  for (const section of document.sections) {
    parts.push(`${section.heading}.`);
    if (section.kind === 'ordered') parts.push(...section.items);
    if (section.kind === 'controls') parts.push(...section.items.map((item) => item.spoken));
    if (section.kind === 'prose') parts.push(...section.paragraphs);
  }

  return parts.join(' ');
}

export const HOW_TO_PLAY_NARRATION = buildHowToPlayNarration(HOW_TO_PLAY);
