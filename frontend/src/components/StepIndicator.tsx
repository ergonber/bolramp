"use client";

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 px-2">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;

        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`
                  w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-500 ease-out
                  ${
                    isCompleted
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                      : isActive
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30 animate-glow-pulse"
                        : "bg-white/5 text-slate-500 border border-white/10"
                  }
                `}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNumber
                )}
              </div>
              <span
                className={`text-[10px] sm:text-xs font-medium transition-colors duration-300 ${
                  isActive ? "text-blue-400" : isCompleted ? "text-emerald-400" : "text-slate-600"
                }`}
              >
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 sm:w-14 h-[2px] mx-1.5 sm:mx-2.5 mt-[-14px] sm:mt-0 rounded-full transition-all duration-700 ${
                  isCompleted
                    ? "bg-emerald-500"
                    : isActive
                      ? "bg-gradient-to-r from-blue-500 to-slate-700"
                      : "bg-white/5"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
