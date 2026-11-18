import { useId, type ReactNode } from 'react';
import { useSettings } from '../settings';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Text shown instead of the raw number (e.g. "Medium"). */
  display?: string;
  hint?: ReactNode;
  disabled?: boolean;
  /** Value, min and max are °C; shown and edited in the user's temperature unit. */
  temp?: boolean;
  onChange: (v: number) => void;
}

export function Slider(props: SliderProps) {
  const { toTemp, fromTemp, tempSymbol, settings } = useSettings();
  if (!props.temp) return <SliderBase {...props} />;
  const f = settings.tempUnit === 'F';
  return (
    <SliderBase
      {...props}
      value={toTemp(props.value)}
      min={Math.round(toTemp(props.min))}
      max={Math.round(toTemp(props.max))}
      step={f ? 1 : props.step}
      unit={tempSymbol}
      onChange={(v) => props.onChange(Number(fromTemp(v).toFixed(2)))}
    />
  );
}

function SliderBase({ label, value, min, max, step, unit, display, hint, disabled, onChange }: SliderProps) {
  const id = useId();
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0;
  return (
    <div className={`field${disabled ? ' field--disabled' : ''}`}>
      <div className="field__head">
        <label htmlFor={id}>{label}</label>
        {display !== undefined ? (
          <span className="field__value">{display}</span>
        ) : (
          <span className="field__value">
            <input
              type="number"
              inputMode="decimal"
              aria-label={label}
              value={Number(value.toFixed(decimals))}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
              }}
            />
            {unit && <span className="field__unit">{unit}</span>}
          </span>
        )}
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="field">
      {label && <div className="field__head"><span>{label}</span></div>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'is-active' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Options sharing a group label are rendered inside one <optgroup>. */
  group?: string;
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  hint?: ReactNode;
  onChange: (v: T) => void;
}

export function Select<T extends string>({ label, value, options, hint, onChange }: SelectProps<T>) {
  const id = useId();
  const render = (o: SelectOption<T>) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  );
  // Preserve option order; consecutive options with the same group form one optgroup.
  const blocks: { group?: string; items: SelectOption<T>[] }[] = [];
  for (const o of options) {
    const last = blocks[blocks.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else blocks.push({ group: o.group, items: [o] });
  }
  return (
    <div className="field">
      <div className="field__head">
        <label htmlFor={id}>{label}</label>
      </div>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {blocks.map((b, i) =>
          b.group ? (
            <optgroup key={`${b.group}-${i}`} label={b.group}>
              {b.items.map(render)}
            </optgroup>
          ) : (
            b.items.map(render)
          ),
        )}
      </select>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ label, checked, hint, onChange }: { label: string; checked: boolean; hint?: string; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle__track" aria-hidden />
      <span>
        {label}
        {hint && <small className="field__hint"> · {hint}</small>}
      </span>
    </label>
  );
}

export function TextField({
  label,
  value,
  type = 'text',
  placeholder,
  error,
  onChange,
}: {
  label: string;
  value: string;
  type?: 'text' | 'date';
  placeholder?: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field__head">
        <label htmlFor={id}>{label}</label>
      </div>
      <input
        id={id}
        className={`text-input${error ? ' is-invalid' : ''}`}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="field__error">{error}</div>}
    </div>
  );
}

export function NumberField({
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="field field--number">
      <label htmlFor={id}>{label}</label>
      <span className="field__value">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(v);
          }}
        />
        {unit && <span className="field__unit">{unit}</span>}
      </span>
    </div>
  );
}

/** Number input that may be left empty (→ undefined). */
export function OptionalNumberField({
  label,
  value,
  unit,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number | undefined;
  unit?: string;
  step?: number;
  hint?: string;
  onChange: (v: number | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="field field--number">
      <label htmlFor={id}>
        {label}
        {hint && <small className="field__hint"> · {hint}</small>}
      </label>
      <span className="field__value">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') return onChange(undefined);
            const v = parseFloat(raw);
            if (Number.isFinite(v) && v >= 0) onChange(v);
          }}
        />
        {unit && <span className="field__unit">{unit}</span>}
      </span>
    </div>
  );
}

export function Card({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
