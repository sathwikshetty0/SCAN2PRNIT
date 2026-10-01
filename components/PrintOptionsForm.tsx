/**
 * PrintOptionsForm — lets the user configure print options for a job.
 *
 * Controls:
 *   - Copies: integer input, range 1–99
 *   - Orientation: Portrait / Landscape radio group
 *   - Colour mode: Black & White / Colour radio group
 *
 * On any change, `calculatePrice` is invoked and the result is propagated to
 * the parent via `onPriceChange` and `onOptionsChange` within 300 ms (direct,
 * no debounce needed since all calculations are synchronous).
 *
 * Selected print options are serialised as `{ orientation, colourMode }` JSON
 * and passed up via `onOptionsChange`.
 *
 * @requirements 3.2 — copies integer input, 1–99
 * @requirements 3.3 — orientation radio: Portrait / Landscape
 * @requirements 3.4 — colour mode radio: Black & White / Colour
 * @requirements 3.5 — recalculate and display total price on any change
 * @requirements 3.6 — store options as { orientation, colourMode } JSON
 * @requirements 14.2 — single-column mobile-first layout
 * @requirements 14.4 — touch-friendly, interactive elements ≥ 44×44 CSS px
 */

'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { calculatePrice, getKioskConfig, type KioskConfig } from '../lib/pricing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Orientation = 'portrait' | 'landscape';
export type ColourMode = 'bw' | 'colour';

export interface PrintOptions {
  orientation: Orientation;
  colourMode: ColourMode;
}

export interface PrintOptionsPriceResult {
  copies: number;
  options: PrintOptions;
  /** Serialised `print_options` JSON string — ready for the API payload */
  optionsJson: string;
  perPagePrice: number;
  total: number;
}

export interface PrintOptionsFormProps {
  /** Number of pages in the uploaded document, used for price calculation */
  pageCount: number;
  /**
   * Called on every change with the updated price result.
   * Guaranteed to be called within 300 ms of any user interaction.
   */
  onPriceChange: (result: PrintOptionsPriceResult) => void;
  /** Optional initial values; defaults to 1 copy, portrait, bw */
  initialCopies?: number;
  initialOrientation?: Orientation;
  initialColourMode?: ColourMode;
  /**
   * Optional override for kiosk config (useful in tests / Storybook).
   * Falls back to `getKioskConfig()` from env vars.
   */
  kioskConfig?: KioskConfig;
}

// ---------------------------------------------------------------------------
// Sub-component: RadioCard
// ---------------------------------------------------------------------------

interface RadioCardProps {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  description?: string;
}

function RadioCard({ id, name, value, checked, onChange, label, description }: RadioCardProps) {
  return (
    <label
      htmlFor={id}
      className={[
        // Minimum 44px height for touch friendliness (Req 14.4)
        'flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer',
        'min-h-[44px] transition-colors duration-150 select-none',
        checked
          ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
          : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300',
      ].join(' ')}
    >
      {/* Native radio — visually hidden but still focusable / keyboard-operable */}
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      {/* Custom circle indicator */}
      <span
        aria-hidden="true"
        className={[
          'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
          checked ? 'border-indigo-600' : 'border-gray-300',
        ].join(' ')}
      >
        {checked && (
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium leading-tight">{label}</span>
        {description && (
          <span className="text-xs text-gray-500 leading-tight mt-0.5">{description}</span>
        )}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PrintOptionsForm({
  pageCount,
  onPriceChange,
  initialCopies = 1,
  initialOrientation = 'portrait',
  initialColourMode = 'bw',
  kioskConfig,
}: PrintOptionsFormProps) {
  // Derive a stable config — either the prop override or env-var defaults.
  // We memoize on mount; env vars don't change at runtime.
  const config = useRef<KioskConfig>(kioskConfig ?? getKioskConfig()).current;

  const [copies, setCopies] = useState<number>(
    Math.min(99, Math.max(1, initialCopies)),
  );
  const [orientation, setOrientation] = useState<Orientation>(initialOrientation);
  const [colourMode, setColourMode] = useState<ColourMode>(initialColourMode);

  // Unique id prefix for radio groups — ensures no id collisions if the form
  // is rendered more than once on the same page.
  const uid = useId();

  // -------------------------------------------------------------------------
  // Price propagation
  // -------------------------------------------------------------------------

  const propagate = useCallback(
    (c: number, o: Orientation, cm: ColourMode) => {
      const { perPagePrice, total } = calculatePrice(config, pageCount, c, cm);
      const options: PrintOptions = { orientation: o, colourMode: cm };
      onPriceChange({
        copies: c,
        options,
        optionsJson: JSON.stringify(options), // Req 3.6
        perPagePrice,
        total,
      });
    },
    [config, pageCount, onPriceChange],
  );

  // Fire on mount so the parent always has a price without waiting for user
  // interaction — and fire synchronously (well within the 300 ms window).
  useEffect(() => {
    propagate(copies, orientation, colourMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // -------------------------------------------------------------------------
  // Change handlers — all synchronous, always within 300 ms (Req 3.5)
  // -------------------------------------------------------------------------

  function handleCopiesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    if (isNaN(raw)) return;
    const clamped = Math.min(99, Math.max(1, raw));
    setCopies(clamped);
    propagate(clamped, orientation, colourMode);
  }

  function handleOrientationChange(value: string) {
    const o = value as Orientation;
    setOrientation(o);
    propagate(copies, o, colourMode);
  }

  function handleColourModeChange(value: string) {
    const cm = value as ColourMode;
    setColourMode(cm);
    propagate(copies, orientation, cm);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ------------------------------------------------------------------ */}
      {/* Copies                                                              */}
      {/* ------------------------------------------------------------------ */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">
          Number of copies
        </legend>
        <div className="flex items-center gap-3">
          {/* Decrement button */}
          <button
            type="button"
            aria-label="Decrease copies"
            onClick={() => {
              const next = Math.max(1, copies - 1);
              setCopies(next);
              propagate(next, orientation, colourMode);
            }}
            disabled={copies <= 1}
            className={[
              // 44×44 px touch target (Req 14.4)
              'min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg border-2',
              'text-lg font-semibold flex items-center justify-center',
              'transition-colors duration-150',
              copies <= 1
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600',
            ].join(' ')}
          >
            −
          </button>

          {/* Number input */}
          <input
            id={`${uid}-copies`}
            type="number"
            min={1}
            max={99}
            value={copies}
            onChange={handleCopiesChange}
            aria-label="Copies"
            className={[
              // 44px height, centred text (Req 14.4)
              'w-16 min-h-[44px] text-center text-base font-medium',
              'rounded-lg border-2 border-gray-300 focus:border-indigo-500',
              'focus:ring-2 focus:ring-indigo-200 focus:outline-none',
              '[appearance:textfield]',
              '[&::-webkit-outer-spin-button]:appearance-none',
              '[&::-webkit-inner-spin-button]:appearance-none',
            ].join(' ')}
          />

          {/* Increment button */}
          <button
            type="button"
            aria-label="Increase copies"
            onClick={() => {
              const next = Math.min(99, copies + 1);
              setCopies(next);
              propagate(next, orientation, colourMode);
            }}
            disabled={copies >= 99}
            className={[
              'min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg border-2',
              'text-lg font-semibold flex items-center justify-center',
              'transition-colors duration-150',
              copies >= 99
                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                : 'border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600',
            ].join(' ')}
          >
            +
          </button>

          <span className="text-sm text-gray-500" aria-live="polite">
            {copies === 1 ? '1 copy' : `${copies} copies`}
          </span>
        </div>
      </fieldset>

      {/* ------------------------------------------------------------------ */}
      {/* Orientation                                                         */}
      {/* ------------------------------------------------------------------ */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">
          Orientation
        </legend>
        {/* Single-column on mobile, two-column on sm+ (Req 14.2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Orientation">
          <RadioCard
            id={`${uid}-orientation-portrait`}
            name={`${uid}-orientation`}
            value="portrait"
            checked={orientation === 'portrait'}
            onChange={handleOrientationChange}
            label="Portrait"
            description="Tall layout (default)"
          />
          <RadioCard
            id={`${uid}-orientation-landscape`}
            name={`${uid}-orientation`}
            value="landscape"
            checked={orientation === 'landscape'}
            onChange={handleOrientationChange}
            label="Landscape"
            description="Wide layout"
          />
        </div>
      </fieldset>

      {/* ------------------------------------------------------------------ */}
      {/* Colour mode                                                         */}
      {/* ------------------------------------------------------------------ */}
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900 mb-2">
          Colour mode
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Colour mode">
          <RadioCard
            id={`${uid}-colour-bw`}
            name={`${uid}-colour`}
            value="bw"
            checked={colourMode === 'bw'}
            onChange={handleColourModeChange}
            label="Black &amp; White"
            description="Standard — lower cost"
          />
          <RadioCard
            id={`${uid}-colour-colour`}
            name={`${uid}-colour`}
            value="colour"
            checked={colourMode === 'colour'}
            onChange={handleColourModeChange}
            label="Colour"
            description="Full colour — surcharge applies"
          />
        </div>
      </fieldset>
    </div>
  );
}
