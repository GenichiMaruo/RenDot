"use client";

import { Check, LockKeyhole } from "lucide-react";

import { cn } from "@/lib/utils";

export type StepNavigationItem = {
  id: string;
  label: string;
  shortLabel?: string;
};

export const DEFAULT_WORKSHOP_STEPS = [
  { id: "pixel", label: "ドット絵" },
  { id: "numbers", label: "数字" },
  { id: "compression", label: "圧縮" },
  { id: "binary", label: "二進数" },
  { id: "parity", label: "パリティ" },
  { id: "qr-like", label: "QRライク", shortLabel: "QR風" },
  { id: "restore", label: "復元" },
] as const satisfies readonly StepNavigationItem[];

export type StepNavigationProps = {
  /** Zero-based index of the visible step. */
  currentStepIndex: number;
  /** Zero-based last step that may be opened. */
  unlockedThroughIndex: number;
  onStepChange: (stepIndex: number) => void;
  steps?: readonly StepNavigationItem[];
  completedStepIndexes?: readonly number[];
  className?: string;
};

/** A responsive, accessible seven-step progress navigator. */
export function StepNavigation({
  currentStepIndex,
  unlockedThroughIndex,
  onStepChange,
  steps = DEFAULT_WORKSHOP_STEPS,
  completedStepIndexes,
  className,
}: StepNavigationProps) {
  const safeCurrentIndex = Math.min(
    Math.max(currentStepIndex, 0),
    Math.max(steps.length - 1, 0),
  );
  const completed = new Set(
    completedStepIndexes ?? steps.map((_, index) => index).filter((index) => index < safeCurrentIndex),
  );
  const progress =
    steps.length <= 1 ? 100 : (safeCurrentIndex / (steps.length - 1)) * 100;

  if (steps.length === 0) return null;

  return (
    <nav
      aria-label="学習ステップ"
      className={cn(
        "border-b border-border/70 bg-background/72 px-3 py-2 sm:px-5",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-2 flex items-center justify-between gap-3 min-[600px]:hidden">
          <p className="truncate text-sm font-extrabold text-foreground">
            {safeCurrentIndex + 1}. {steps[safeCurrentIndex]?.label}
          </p>
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
            {safeCurrentIndex + 1} / {steps.length}
          </span>
        </div>

        <div aria-hidden="true" className="mb-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol
          className="flex snap-x gap-1.5 overflow-x-auto pb-1 min-[600px]:grid min-[600px]:overflow-visible min-[600px]:pb-0"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => {
            const isCurrent = index === safeCurrentIndex;
            const isCompleted = completed.has(index);
            const isLocked = index > unlockedThroughIndex;
            const stateLabel = isCurrent
              ? "現在のステップ"
              : isLocked
                ? "まだ開けません"
                : isCompleted
                  ? "完了"
                  : "開くことができます";

            return (
              <li className="min-w-11 flex-1 snap-center min-[600px]:min-w-0" key={step.id}>
                <button
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`ステップ${index + 1}、${step.label}、${stateLabel}`}
                  className={cn(
                    "group flex min-h-11 w-full min-w-11 items-center justify-center gap-2 rounded-xl border px-1.5 py-1 text-center outline-none transition-[color,background-color,border-color,box-shadow,transform] focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] min-[600px]:gap-1",
                    isCurrent &&
                      "border-primary/35 bg-primary/12 text-primary shadow-[0_8px_24px_-16px_var(--primary)]",
                    !isCurrent && !isLocked &&
                      "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                    isLocked &&
                      "cursor-not-allowed border-transparent text-muted-foreground/55",
                  )}
                  disabled={isLocked}
                  onClick={() => {
                    if (!isCurrent) onStepChange(index);
                  }}
                  title={isLocked ? `${step.label}は、前のステップを終えると開けます` : step.label}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-black tabular-nums transition-colors",
                      isCurrent && "border-primary bg-primary text-primary-foreground",
                      !isCurrent && isCompleted &&
                        "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
                      !isCurrent && !isCompleted && "border-border bg-card",
                    )}
                  >
                    {isLocked ? (
                      <LockKeyhole className="size-3.5" />
                    ) : isCompleted && !isCurrent ? (
                      <Check className="size-4" strokeWidth={3} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="hidden max-w-full truncate text-xs font-extrabold min-[600px]:block">
                    <span className="min-[760px]:hidden">{step.shortLabel ?? step.label}</span>
                    <span className="hidden min-[760px]:inline">{step.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
