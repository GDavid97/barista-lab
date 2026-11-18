import { getLesson, getLessons } from '../data/lessons';
import { useI18n } from '../i18n';
import { Card } from '../ui/fields';

export function Learn({ path }: { path: string[] }) {
  const { t, lang } = useI18n();
  const lesson = path[0] ? getLesson(lang, path[0]) : undefined;

  if (path[0]) {
    if (!lesson) {
      return (
        <div className="page">
          <a className="link-btn" href="#/learn">{t('learn.back')}</a>
          <p className="empty">{t('journal.notFound')}</p>
        </div>
      );
    }
    const all = getLessons(lang);
    const i = all.findIndex((l) => l.id === lesson.id);
    const next = all[(i + 1) % all.length]!;
    return (
      <div className="page lesson">
        <a className="link-btn" href="#/learn">{t('learn.back')}</a>
        <h2 className="page__title">
          <span aria-hidden>{lesson.emoji}</span> {lesson.title}
        </h2>
        <p className="lesson__summary">{lesson.summary}</p>
        <Card>
          {lesson.paragraphs.map((p, k) => (
            <p key={k} className="lesson__p">
              {p}
            </p>
          ))}
        </Card>
        <Card title={t('learn.tips')}>
          <ul className="lesson__tips">
            {lesson.tips.map((tip, k) => (
              <li key={k}>{tip}</li>
            ))}
          </ul>
        </Card>
        <a className="btn" href={`#/learn/${next.id}`}>
          {t('learn.next')}: {next.emoji} {next.title} →
        </a>
      </div>
    );
  }

  return (
    <div className="page">
      <h2 className="page__title">📖 {t('learn.title')}</h2>
      <p className="help">{t('learn.intro')}</p>
      <div className="lesson-grid">
        {getLessons(lang).map((l) => (
          <a key={l.id} className="lesson-card" href={`#/learn/${l.id}`}>
            <span className="lesson-card__emoji" aria-hidden>
              {l.emoji}
            </span>
            <span className="lesson-card__title">{l.title}</span>
            <span className="lesson-card__summary">{l.summary}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
