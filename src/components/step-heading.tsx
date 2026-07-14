import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type StepHeadingProps = {
  step: number;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  trailing?: React.ReactNode;
};

export function StepHeading({
  step,
  eyebrow,
  title,
  description,
  icon: Icon,
  trailing,
}: StepHeadingProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/15">
          <Icon className="size-5.5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge>STEP {step}</Badge>
            <span className="text-xs font-bold tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </span>
          </div>
          <h1 className="text-balance text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
