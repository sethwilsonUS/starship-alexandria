import { HOW_TO_PLAY } from '@/content/howToPlay';
import HowToPlayNarration from './HowToPlayNarration';

interface HowToPlayContentProps {
  titleId: string;
  titleLevel: 1 | 2;
}

export default function HowToPlayContent({
  titleId,
  titleLevel,
}: HowToPlayContentProps) {
  const Title = titleLevel === 1 ? 'h1' : 'h2';
  const SectionTitle = titleLevel === 1 ? 'h2' : 'h3';

  return (
    <div className="how-to-guide">
      <p className="how-to-guide__eyebrow">{HOW_TO_PLAY.eyebrow}</p>
      <Title
        id={titleId}
        className="how-to-guide__title"
        tabIndex={-1}
        data-autofocus
      >
        {HOW_TO_PLAY.title}
      </Title>
      <p id={`${titleId}-intro`} className="how-to-guide__intro">
        {HOW_TO_PLAY.intro}
      </p>
      <HowToPlayNarration />

      {HOW_TO_PLAY.sections.map((section) => (
        <section key={section.id} aria-labelledby={`${titleId}-${section.id}`}>
          <SectionTitle id={`${titleId}-${section.id}`}>{section.heading}</SectionTitle>
          {section.kind === 'ordered' ? (
            <ol>
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ol>
          ) : null}
          {section.kind === 'controls' ? (
            <dl className="how-to-guide__controls">
              {section.items.map((item) => (
                <div key={item.description}>
                  <dt>
                    {item.keyGroups.map((group, groupIndex) => (
                      <span key={group.join('+')}>
                        {groupIndex > 0 ? ` ${item.keyGroupJoiner} ` : null}
                        {group.map((key, keyIndex) => (
                          <span key={key}>
                            {keyIndex > 0 ? '+' : null}<kbd>{key}</kbd>
                          </span>
                        ))}
                      </span>
                    ))}
                  </dt>
                  <dd>{item.description}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {section.kind === 'prose'
            ? section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
            : null}
        </section>
      ))}
    </div>
  );
}
