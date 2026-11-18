import { getPrivacyNotice } from '../data/privacy';
import { useI18n } from '../i18n';
import { Card } from '../ui/fields';

export function Privacy() {
  const { lang } = useI18n();
  const n = getPrivacyNotice(lang);
  return (
    <div className="page privacy">
      <div className="page__section">
        <h2 className="page__title">🔒 {n.title}</h2>
        <p className="help privacy__updated">{n.updated}</p>
        <p className="lesson__summary">{n.summary}</p>
      </div>
      {n.sections.map((s) => (
        <Card key={s.title} title={s.title}>
          {s.paragraphs.map((p, i) => (
            <p key={i} className="lesson__p">{p}</p>
          ))}
          {s.list && (
            <ul className="lesson__tips privacy__list">
              {s.list.map((li, i) => (
                <li key={i}>{li}</li>
              ))}
            </ul>
          )}
          {s.after?.map((p, i) => (
            <p key={i} className="lesson__p">{p}</p>
          ))}
        </Card>
      ))}
    </div>
  );
}
