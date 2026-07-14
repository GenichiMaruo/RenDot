"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BottomNavigationProps = {
  /** Zero-based index of the visible step. */
  currentStepIndex: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  currentStepLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextDisabledReason?: string;
  backLabel?: string;
  nextLabel?: string;
  isNextPending?: boolean;
  className?: string;
};

/** Collapsible previous/next actions with safe-area support for iPad Safari. */
export function BottomNavigation({
  currentStepIndex,
  totalSteps,
  onBack,
  onNext,
  currentStepLabel,
  backDisabled = false,
  nextDisabled = false,
  nextDisabledReason,
  backLabel = "戻る",
  nextLabel = "次へ",
  isNextPending = false,
  className,
}: BottomNavigationProps) {
  const [expanded, setExpanded] = React.useState(false);
  const reasonId = React.useId();
  const controlsId = React.useId();
  const safeTotal = Math.max(totalSteps, 1);
  const displayStep = Math.min(Math.max(currentStepIndex + 1, 1), safeTotal);
  const progress = (displayStep / safeTotal) * 100;
  const disableNext = nextDisabled || isNextPending;

  return (
    <nav
      aria-label="前後のステップへ移動"
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40", className)}
    >
      {!expanded ? (
        <div
          className="flex justify-center px-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto min-h-11 rounded-full border bg-background/92 px-5 shadow-lg backdrop-blur-xl"
            aria-expanded="false"
            aria-controls={controlsId}
            onClick={() => setExpanded(true)}
          >
            <ChevronUp aria-hidden="true" />
            操作を表示
            <span className="text-xs tabular-nums text-muted-foreground">{displayStep}/{safeTotal}</span>
          </Button>
        </div>
      ) : (
        <div
          id={controlsId}
          className="safe-bottom bottom-nav-enter pointer-events-auto border-t border-border/80 bg-background/92 px-3 pt-1.5 shadow-[0_-14px_42px_-28px_rgba(15,23,42,0.5)] backdrop-blur-xl sm:px-5"
        >
          <button
            type="button"
            className="mx-auto mb-1 flex min-h-7 items-center gap-1 rounded-full px-3 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-expanded="true"
            aria-controls={controlsId}
            onClick={() => setExpanded(false)}
          >
            操作を隠す
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>

          <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 sm:gap-4">
            <Button
              className="min-w-24 px-4 sm:min-w-32"
              disabled={backDisabled}
              onClick={onBack}
              type="button"
              variant="secondary"
            >
              <ArrowLeft aria-hidden="true" />
              {backLabel}
            </Button>

            <div className="min-w-0 text-center">
              <p className="truncate text-xs font-extrabold text-foreground sm:text-sm">
                {currentStepLabel ?? `ステップ ${displayStep}`}
              </p>
              <div className="mx-auto mt-1.5 h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-[0.68rem] font-bold tabular-nums text-muted-foreground">
                {displayStep} / {safeTotal}
                {nextDisabledReason ? (
                  <span aria-hidden="true" className="hidden sm:inline">
                    <span aria-hidden="true"> ・ </span>
                    {nextDisabledReason}
                  </span>
                ) : null}
              </p>
              {nextDisabledReason ? (
                <span className="sr-only" id={reasonId}>
                  {nextDisabledReason}
                </span>
              ) : null}
            </div>

            <Button
              aria-describedby={nextDisabledReason ? reasonId : undefined}
              className="min-w-24 px-4 sm:min-w-32"
              disabled={disableNext}
              onClick={onNext}
              type="button"
            >
              {isNextPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {nextLabel}
              {!isNextPending ? <ArrowRight aria-hidden="true" /> : null}
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
