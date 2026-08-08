"use client";

import { Check } from "lucide-react";

import { COLOR_MODES, getColors } from "@/lib/colors";
import type { ColorId, ColorMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ColorPaletteLayout =
  | "responsive"
  | "two-columns"
  | "four-columns";

export type ColorPaletteProps = {
  value: ColorId;
  colorMode?: ColorMode;
  onValueChange: (color: ColorId) => void;
  disabled?: boolean;
  layout?: ColorPaletteLayout;
  ariaLabel?: string;
  className?: string;
};

export type ColorModeSelectorProps = {
  value: ColorMode;
  onValueChange: (mode: ColorMode) => void;
  disabled?: boolean;
  className?: string;
};

const LAYOUT_CLASSES: Record<ColorPaletteLayout, string> = {
  responsive:
    "grid-cols-2 min-[520px]:grid-cols-4 min-[900px]:grid-cols-2",
  "two-columns": "grid-cols-2",
  "four-columns": "grid-cols-4",
};

/** Four palettes. Their two-bit codes are persisted in the QR-like header. */
export function ColorModeSelector({
  value,
  onValueChange,
  disabled = false,
  className,
}: ColorModeSelectorProps) {
  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-extrabold text-foreground">
        カラーモードを選ぶ
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {COLOR_MODES.map((mode) => {
          const isSelected = value === mode.id;

          return (
            <button
              aria-label={`${mode.name}。${mode.description}${isSelected ? "、選択中" : "を選ぶ"}`}
              aria-pressed={isSelected}
              className={cn(
                "group min-w-0 rounded-xl border bg-card p-2 text-left outline-none transition-[background-color,border-color,box-shadow,transform] focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
                isSelected
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                  : "border-border/80 hover:border-primary/30 hover:bg-accent/70",
              )}
              key={mode.id}
              onClick={() => onValueChange(mode.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="mb-2 grid h-5 grid-cols-8 overflow-hidden rounded-md border border-black/15 dark:border-white/25"
              >
                {mode.colors.map((color) => (
                  <span key={color.id} style={{ backgroundColor: color.hex }} />
                ))}
              </span>
              <span className="flex items-center justify-between gap-1">
                <span className="truncate text-sm font-extrabold">{mode.name}</span>
                {isSelected ? <Check aria-hidden="true" className="size-4 shrink-0 text-primary" strokeWidth={3} /> : null}
              </span>
              <span className="mt-0.5 block text-[0.68rem] leading-4 text-muted-foreground">
                {mode.description}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Eight numbered colors. Selection never depends on color alone. */
export function ColorPalette({
  value,
  colorMode = "colorful",
  onValueChange,
  disabled = false,
  layout = "responsive",
  ariaLabel = "色を選ぶ",
  className,
}: ColorPaletteProps) {
  const colors = getColors(colorMode);

  return (
    <fieldset className={cn("min-w-0", className)} disabled={disabled}>
      <legend className="mb-2 text-sm font-extrabold text-foreground">
        {ariaLabel}
      </legend>
      <div className={cn("grid gap-2", LAYOUT_CLASSES[layout])}>
        {colors.map((color) => {
          const isSelected = value === color.id;

          return (
            <button
              aria-label={`色番号${color.id}、${color.name}${isSelected ? "、選択中" : "を選ぶ"}`}
              aria-pressed={isSelected}
              className={cn(
                "group flex min-h-14 min-w-11 items-center gap-2 rounded-xl border bg-card px-2.5 py-2 text-left text-card-foreground outline-none transition-[background-color,border-color,box-shadow,transform] focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
                isSelected
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                  : "border-border/80 hover:border-primary/30 hover:bg-accent/70",
              )}
              key={color.id}
              onClick={() => onValueChange(color.id)}
              type="button"
            >
              <span
                aria-hidden="true"
                className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-black/20 shadow-inner dark:border-white/30"
                style={{
                  backgroundColor: color.hex,
                  color: color.foreground,
                }}
              >
                {isSelected ? <Check className="size-5" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[0.68rem] font-black tabular-nums text-muted-foreground">
                  {color.id}
                </span>
                <span className="block truncate text-sm font-extrabold">
                  {color.name}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
