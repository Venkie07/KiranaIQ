import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Accessible name, e.g. the product name. */
  label: string;
}

/** Large touch-friendly quantity stepper (48 px buttons). */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99_999,
  step = 1,
  disabled,
  label,
}: QuantityStepperProps) {
  const { t } = useTranslation();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(clamp(value - step))}
        disabled={disabled || value <= min}
        aria-label={`${label}: ${t('sales.quantityMinus')}`}
      >
        <Minus size={20} aria-hidden="true" />
      </button>
      <input
        className="stepper__input"
        type="number"
        inputMode="numeric"
        value={String(value)}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10);
          onChange(Number.isNaN(parsed) ? min : clamp(parsed));
        }}
      />
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(clamp(value + step))}
        disabled={disabled || value >= max}
        aria-label={`${label}: ${t('sales.quantityPlus')}`}
      >
        <Plus size={20} aria-hidden="true" />
      </button>
    </div>
  );
}
