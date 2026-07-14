import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/12 text-primary",
        secondary: "border-border bg-secondary text-secondary-foreground",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        warning: "border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-300",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
        outline: "border-border bg-background/70 text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
