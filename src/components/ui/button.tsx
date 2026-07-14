import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-bold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_var(--primary)] hover:bg-primary/90 hover:shadow-[0_10px_28px_-10px_var(--primary)]",
        secondary:
          "border border-border bg-card text-card-foreground shadow-sm hover:border-primary/30 hover:bg-accent",
        outline:
          "border border-border bg-background/70 text-foreground hover:border-primary/40 hover:bg-accent",
        ghost: "text-muted-foreground hover:bg-accent hover:text-foreground",
        danger:
          "bg-destructive/10 text-destructive hover:bg-destructive/16 focus-visible:ring-destructive/20",
      },
      size: {
        default: "h-12 px-5 py-2.5",
        sm: "h-11 rounded-lg px-3.5",
        lg: "h-14 rounded-2xl px-7 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
