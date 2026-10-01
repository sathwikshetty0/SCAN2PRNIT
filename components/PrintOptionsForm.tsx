'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { calculatePrice, getKioskConfig, type KioskConfig } from '../lib/pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Orientation = 'portrait' | 'landscape';
export type ColourMode  = 'bw' | 'colour';

export interface PrintOptions {
  orientation: Orientation;
  colourMode:  ColourMode;
}

export interface PrintOptionsPriceResult {
  copies:      number;
  options:     PrintOptions;
  optionsJson: string;
  perPagePrice: number;
  total:       number;
}

export interface PrintOptionsFormProps {
  pageCount:          number;
  onPriceChange:      (result: PrintOptionsPriceResult) => void;
  initialCopies?:     number;
  initialOrientation?: Orientation;
  initialColourMode?: ColourMode;
  kioskConfig?:       KioskConfig;
}

// ─── RadioCard ────────────────────────────────────────────────────────────────

function RadioCard({
  id, name, value, checked, onChange, label, description,
}: {
  id: string; name: string; value: string; checked: boolean;
  onChange: (v: string) => void; label: string; description?: string;
}) {
  return (
    <label htmlFor={id} className={`radio-card${checked ? ' selected' : ''}`}>
      <input
        id={id} type="radio" name={name} value={value}
        checked={checked} onChange={() => onChange(value)}
        className="sr-only"
      />
      <div className="radio-dot">
        <div className="radio-dot-inner" />
      </div>
      <div>
        <div className="radio-label">{label}</div>
        {description && <div className="radio-desc">{description}</div>}
      </div>
    </label>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PrintOptionsForm({
  pageCount,
  onPriceChange,
  initialCopies      = 1,
  initialOrientation = 'portrait',
  initialColourMode  = 'bw',
  kioskConfig,
}: PrintOptionsFormProps) {
  const config = useRef<KioskConfig>(kioskConfig ?? getKioskConfig()).current;

  const [copies,      setCopies]      = useState(Math.min(99, Math.max(1, initialCopies)));
  const [orientation, setOrientation] = useState<Orientation>(initialOrientation);
  const [colourMode,  setColourMode]  = useState<ColourMode>(initialColourMode);

  const uid = useId();

  const propagate = useCallback(
    (c: number, o: Orientation, cm: ColourMode) => {
      const { perPagePrice, total } = calculatePrice(config, pageCount, c, cm);
      const options: PrintOptions = { orientation: o, colourMode: cm };
      onPriceChange({ copies: c, options, optionsJson: JSON.stringify(options), perPagePrice, total });
    },
    [config, pageCount, onPriceChange],
  );

  // Fire on mount so parent has initial price immediately
  React.useEffect(() => {
    propagate(copies, orientation, colourMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCopiesAndPropagate = (next: number) => {
    setCopies(next);
    propagate(next, orientation, colourMode);
  };

  const handleOrientationChange = (v: string) => {
    const o = v as Orientation;
    setOrientation(o);
    propagate(copies, o, colourMode);
  };

  const handleColourModeChange = (v: string) => {
    const cm = v as ColourMode;
    setColourMode(cm);
    propagate(copies, orientation, cm);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Copies */}
      <div className="field-group">
        <label className="field-label" htmlFor={`${uid}-copies`}>Number of copies</label>
        <div className="copies-row">
          <button
            type="button"
            aria-label="Decrease copies"
            disabled={copies <= 1}
            onClick={() => setCopiesAndPropagate(Math.max(1, copies - 1))}
            className="counter-btn"
          >
            −
          </button>
          <input
            id={`${uid}-copies`}
            type="number"
            min={1} max={99}
            value={copies}
            aria-label="Copies"
            className="counter-input"
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setCopiesAndPropagate(Math.min(99, Math.max(1, v)));
            }}
          />
          <button
            type="button"
            aria-label="Increase copies"
            disabled={copies >= 99}
            onClick={() => setCopiesAndPropagate(Math.min(99, copies + 1))}
            className="counter-btn"
          >
            +
          </button>
          <span className="counter-label">{copies === 1 ? '1 copy' : `${copies} copies`}</span>
        </div>
      </div>

      {/* Orientation */}
      <div className="field-group">
        <div className="field-label">Orientation</div>
        <div className="radio-grid" role="radiogroup" aria-label="Orientation">
          <RadioCard
            id={`${uid}-portrait`} name={`${uid}-orientation`} value="portrait"
            checked={orientation === 'portrait'} onChange={handleOrientationChange}
            label="Portrait" description="Tall (A4 default)"
          />
          <RadioCard
            id={`${uid}-landscape`} name={`${uid}-orientation`} value="landscape"
            checked={orientation === 'landscape'} onChange={handleOrientationChange}
            label="Landscape" description="Wide layout"
          />
        </div>
      </div>

      {/* Colour mode */}
      <div className="field-group">
        <div className="field-label">Colour mode</div>
        <div className="radio-grid" role="radiogroup" aria-label="Colour mode">
          <RadioCard
            id={`${uid}-bw`} name={`${uid}-colour`} value="bw"
            checked={colourMode === 'bw'} onChange={handleColourModeChange}
            label="Black & White" description="Lower cost"
          />
          <RadioCard
            id={`${uid}-colour`} name={`${uid}-colour`} value="colour"
            checked={colourMode === 'colour'} onChange={handleColourModeChange}
            label="Colour" description="Surcharge applies"
          />
        </div>
      </div>
    </div>
  );
}
