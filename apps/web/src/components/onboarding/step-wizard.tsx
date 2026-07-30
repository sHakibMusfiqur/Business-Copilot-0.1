'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
}

const STEPS: Step[] = [
  { id: 0, label: 'Verify' },
  { id: 1, label: 'Industry' },
  { id: 2, label: 'Organization' },
  { id: 3, label: 'Profile' },
  { id: 4, label: 'AI' },
  { id: 5, label: 'Plan' },
  { id: 6, label: 'Provision' },
  { id: 7, label: 'Done' },
];

interface StepWizardProps {
  currentStep: number;
  completedSteps: number[];
}

export function StepWizard({ currentStep, completedSteps }: StepWizardProps) {
  return (
    <div className="w-full overflow-x-auto py-6">
      <div className="flex items-center justify-center gap-0 min-w-max px-4">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{
                    scale: isCurrent ? 1.15 : 1,
                    backgroundColor: isCompleted
                      ? 'rgb(34 197 94)'
                      : isCurrent
                        ? 'rgb(59 130 246)'
                        : 'rgb(100 116 139)',
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white shadow-lg transition-colors"
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{step.id + 1}</span>
                  )}
                </motion.div>
                <span
                  className={`mt-1.5 text-[10px] font-medium ${
                    isCurrent
                      ? 'text-primary'
                      : isCompleted
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`mx-1 h-0.5 w-6 sm:w-10 ${
                    isCompleted ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
