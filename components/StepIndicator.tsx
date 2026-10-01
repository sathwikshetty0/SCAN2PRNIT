/**
 * StepIndicator — displays the 4-step workflow progress for the A4 Print Kiosk.
 *
 * Steps: Upload → Options → Payment → Status
 *
 * - Active step is visually highlighted with a filled circle and bold label.
 * - Completed steps (index < currentStep) show a checkmark indicator.
 * - Pending steps appear muted.
 * - All interactive areas meet the 44×44 CSS pixel minimum touch target size.
 * - Uses a horizontal layout that wraps gracefully on narrow (375 px) viewports.
 *
 * @requirements 14.3 — step indicator showing current workflow position
 * @requirements 14.4 — touch-friendly controls, interactive elements ≥ 44×44 CSS px
 */

import React from 'react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
}

interface Step {
  label: string;
  number: 1 | 2 | 3 | 4;
}

const STEPS: Step[] = [
  { number: 1, label: 'Upload' },
  { number: 2, label: 'Options' },
  { number: 3, label: 'Payment' },
  { number: 4, label: 'Status' },
];

/**
 * StepIndicator component.
 *
 * Renders the four workflow steps with visual states:
 * - Completed: filled indigo circle with a checkmark ✓
 * - Active:    filled indigo circle with the step number, aria-current="step"
 * - Pending:   outlined grey circle with the step number
 *
 * @param currentStep - The 1-based index of the active step.
 */
export default function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <nav
      aria-label="Progress"
      className="w-full"
    >
      <ol className="flex items-center justify-between w-full">
        {STEPS.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isLast = index === STEPS.length - 1;

          return (
            <React.Fragment key={step.number}>
              {/* Step node */}
              <li
                className="flex flex-col items-center gap-1"
                aria-current={isActive ? 'step' : undefined}
              >
                {/* Circle — min 44×44 px touch area */}
                <span
                  className={[
                    'flex items-center justify-center',
                    'min-w-[44px] min-h-[44px] w-11 h-11 rounded-full',
                    'text-sm font-semibold select-none',
                    isCompleted
                      ? 'bg-indigo-600 text-white'
                      : isActive
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-200'
                      : 'bg-white text-gray-400 border-2 border-gray-300',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    // Checkmark for completed steps
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>

                {/* Step label */}
                <span
                  className={[
                    'text-xs font-medium text-center leading-tight',
                    isActive
                      ? 'text-indigo-700 font-semibold'
                      : isCompleted
                      ? 'text-indigo-600'
                      : 'text-gray-400',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </li>

              {/* Connector line between steps */}
              {!isLast && (
                <li
                  aria-hidden="true"
                  className={[
                    'flex-1 h-0.5 mx-1 mb-5',
                    step.number < currentStep
                      ? 'bg-indigo-600'
                      : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
