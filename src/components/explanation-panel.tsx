"use client";

import { useId, useState, type ReactNode } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExplanationPanelProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

export function ExplanationPanel({ label, children, className }: ExplanationPanelProps) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <div className={cn("rounded-2xl border border-primary/20 bg-primary/[0.035] p-3", className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <BookOpen aria-hidden="true" />
        {open ? `${label}を閉じる` : `${label}を読む`}
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </Button>
      {open ? (
        <div
          id={contentId}
          role="region"
          aria-label={label}
          className="mt-3 border-t border-primary/15 px-1 pt-3 text-sm leading-7 text-muted-foreground"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
