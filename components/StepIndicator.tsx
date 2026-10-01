'use client';

import React from 'react';

const STEPS = [
  { num: 1, label: 'Upload' },
  { num: 2, label: 'Options' },
  { num: 3, label: 'Payment' },
];

export default function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="step-indicator" role="list" aria-label="Progress">
      {STEPS.map((step, i) => {
        const isDone = step.num < currentStep;
        const isActive = step.num === currentStep;
        const stateClass = isDone ? 'done' : isActive ? 'active' : 'pending';

        return (
          <React.Fragment key={step.num}>
            <div className="step-item" role="listitem">
              <div className={`step-circle ${stateClass}`} aria-current={isActive ? 'step' : undefined}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : step.num}
              </div>
              <span className={`step-label ${stateClass}`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`step-connector ${isDone ? 'done' : 'pending'}`} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
