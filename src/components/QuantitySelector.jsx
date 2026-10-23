import { useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

/* Never lets the value fall below the product minimum (9 polaroid
   prints, 1 of everything else) or go negative. The ref keeps rapid
   clicks from collapsing into one step before React re-renders. */
export default function QuantitySelector({
  value,
  min = 1,
  max = 999,
  step = 1,
  onChange,
  label = 'Quantity',
  size = 'md'
}) {
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  const clamp = (n) => Math.min(max, Math.max(min, Math.round(Number(n) || min)));

  const emit = (next) => {
    const clamped = clamp(next);
    latest.current = clamped;
    onChange(clamped);
  };

  return (
    <div className={`qty${size === 'lg' ? ' qty--lg' : ''}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => emit(latest.current - step)}
      >
        <Minus size={15} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return;
          emit(raw);
        }}
        onBlur={(e) => emit(e.target.value)}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => emit(latest.current + step)}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
