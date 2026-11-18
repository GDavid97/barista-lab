import {
  fitFor,
  formatRange,
  GUIDE_BANDS,
  guideForDrink,
  scalePos,
  SCALE_MIN_UM,
  settingRange,
  textureOf,
  type GuideId,
} from '../domain/grindGuide';
import type { GrindScale } from '../engine';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';

/** "finom, mint a porcukor" for a particle size. */
export function useTextureText(): (um: number) => string {
  const { tDyn } = useI18n();
  return (um) => tDyn(`grindTextures.${textureOf(um)}`);
}

interface Props {
  /** Nominal particle size (µm) – what the dial says. */
  um: number;
  drinkId: string;
  scale?: GrindScale;
}

/** Texture, method scale with a marker, and the recommended dial window for this drink. */
export function GrindGuide({ um, drinkId, scale }: Props) {
  const { t, tDyn, fmt } = useI18n();
  const { settings } = useSettings();
  const guide = guideForDrink(drinkId);
  const fit = fitFor(um, guide);
  const range = scale ? settingRange(scale, guide) : undefined;
  let prev = SCALE_MIN_UM;

  return (
    <div className="grind-guide">
      <div className="grind-guide__texture">{tDyn(`grindTextures.${textureOf(um)}`)}</div>
      <div className="grind-scale" aria-hidden>
        {GUIDE_BANDS.map((b) => {
          const left = scalePos(prev) * 100;
          const width = (scalePos(b.to) - scalePos(prev)) * 100;
          prev = b.to;
          return (
            <span key={b.id} className={`grind-scale__band${b.id === guide ? ' is-target' : ''}`} style={{ left: `${left}%`, width: `${width}%` }}>
              {/* Narrow bands stay unlabeled; the target band is always named. */}
              {(width >= 12 || b.id === guide) && <span className="grind-scale__label">{tDyn(`guides.${b.id}`)}</span>}
            </span>
          );
        })}
        <span className={`grind-scale__marker grind-scale__marker--${fit}`} style={{ left: `${scalePos(um) * 100}%` }} />
      </div>
      <div className="grind-scale__ends">
        <span>{t('grindTextures.flour').split(',')[0]}</span>
        <span>{t('grindTextures.seaSalt').split(',')[0]}</span>
      </div>
      <div className={`grind-guide__fit grind-guide__fit--${fit}`}>{t(`grindGuide.${fit}`)}</div>
      {scale &&
        (range ? (
          <div className="grind-guide__rec">{t('grindGuide.recommended', { range: formatRange(range, scale.step, fmt) })}</div>
        ) : (
          <div className="grind-guide__rec">{t('grindGuide.notSupported')}</div>
        ))}
      {settings.advanced && <div className="field__hint">{t('grindGuide.micron', { um: fmt(um) })}</div>}
    </div>
  );
}

const LIST: GuideId[] = ['espresso', 'moka', 'aeropress', 'pourover', 'chemex', 'frenchPress'];

/** "Espresso 8–12 · V60 20–25 · …" for a grinder's dial. */
export function GrinderRangeList({ scale }: { scale: GrindScale }) {
  const { tDyn, fmt } = useI18n();
  const parts = LIST.map((id) => {
    const r = settingRange(scale, id);
    return r ? `${tDyn(`guides.${id}`)} ${formatRange(r, scale.step, fmt)}` : undefined;
  }).filter(Boolean);
  return <span className="grind-ranges">{parts.join(' · ')}</span>;
}
