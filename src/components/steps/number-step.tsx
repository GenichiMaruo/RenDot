"use client";

import { ArrowRight, Binary, Grid3X3 } from "lucide-react";

import { PixelGrid } from "@/components/pixel-grid";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getColors, type ColorMode, type PixelGrid as PixelGridData } from "@/lib";

type NumberStepProps = {
  grid: PixelGridData;
  colorMode: ColorMode;
  selectedCellIndex: number | null;
  onCellSelect: (index: number) => void;
};

export function NumberStep({ grid, colorMode, selectedCellIndex, onCellSelect }: NumberStepProps) {
  const colors = getColors(colorMode);
  const selectedColor =
    selectedCellIndex === null ? null : grid.flat()[selectedCellIndex];

  return (
    <section className="step-enter">
      <StepHeading
        step={2}
        eyebrow="COLOR NUMBERS"
        title="絵を色番号に変換"
        description="各マスを0〜7の色番号で表します。"
        icon={Binary}
        trailing={
          selectedColor !== null ? (
            <Badge variant="secondary" className="h-8 px-3">
              選択中：{selectedColor}・{colors[selectedColor].name}
            </Badge>
          ) : null
        }
      />

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="size-5 text-primary" aria-hidden="true" />
              もとのドット絵
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-full max-w-[32rem]">
              <PixelGrid
                grid={grid}
                colorMode={colorMode}
                readOnly
                selectedCellIndex={selectedCellIndex ?? undefined}
                onCellSelect={onCellSelect}
                ariaLabel="もとのドット絵。マスを選ぶと対応する数字が分かります"
              />
            </div>
          </CardContent>
        </Card>

        <div className="hidden items-center justify-center lg:flex" aria-hidden="true">
          <div className="grid size-12 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <ArrowRight className="size-5" />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Binary className="size-5 text-primary" aria-hidden="true" />
              色番号のならび
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-full max-w-[32rem]">
              <PixelGrid
                grid={grid}
                colorMode={colorMode}
                readOnly
                showColorNumbers
                selectedCellIndex={selectedCellIndex ?? undefined}
                onCellSelect={onCellSelect}
                ariaLabel="色番号で表した8かける8のドット絵"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card/70 p-3 sm:grid-cols-8">
        {colors.map((color) => (
          <div key={color.id} className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2">
            <span
              className="size-5 shrink-0 rounded-md border border-black/15 shadow-sm dark:border-white/30"
              style={{ backgroundColor: color.hex }}
              aria-hidden="true"
            />
            <span className="min-w-0 text-xs font-bold">
              <span className="block text-sm">{color.id}</span>
              <span className="block truncate text-muted-foreground">{color.name}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
