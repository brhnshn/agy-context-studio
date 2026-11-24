import { MinusIcon, PlusIcon } from '../utils/icons.js';

interface NumberStepperProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}

export function NumberStepper({
  id,
  label,
  value,
  min,
  max,
  step = 5,
  suffix = '',
  onChange
}: NumberStepperProps) {
  const clamp = (raw: number) => Math.min(max, Math.max(min, Math.round(raw)));

  return (
    <div className="cs-stepper-field">
      <label htmlFor={id} className="cs-stepper-label">
        {label}
      </label>
      <div className="cs-stepper">
        <button
          type="button"
          className="cs-stepper-btn"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          <MinusIcon />
        </button>
        <div className="cs-stepper-val-wrap">
          <input
            id={id}
            type="number"
            min={min}
            max={max}
            className="cs-stepper-input"
            value={value}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) {
                onChange(clamp(parsed));
              }
            }}
          />
          {suffix && <span className="cs-stepper-suffix">{suffix}</span>}
        </div>
        <button
          type="button"
          className="cs-stepper-btn"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}
