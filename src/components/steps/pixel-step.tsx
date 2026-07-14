"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Eraser, History, MoveDiagonal2, Redo2, Sparkles, Undo2 } from "lucide-react";

import { ColorPalette } from "@/components/color-palette";
import { PixelGrid, type PixelGridCommit } from "@/components/pixel-grid";
import { SavedArtworkGallery } from "@/components/saved-artwork-gallery";
import { StepHeading } from "@/components/step-heading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLORS, type ColorId, type PixelGrid as PixelGridData, type SavedArtwork, SAMPLES } from "@/lib";
import { cn } from "@/lib/utils";

type PixelStepProps = {
  grid: PixelGridData;
  selectedColor: ColorId;
  onSelectedColorChange: (color: ColorId) => void;
  onGridCommit: (commit: PixelGridCommit) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onLoadSample: (grid: PixelGridData, sampleName: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  savedArtworks: readonly SavedArtwork[];
  currentSavedArtworkId: string | null;
  onSaveArtwork: () => void;
  onLoadArtwork: (artwork: SavedArtwork) => void;
  onDeleteArtwork: (id: string) => void;
};

const COMPRESSION_LABEL = {
  easy: { text: "まとまりやすい", variant: "success" as const },
  medium: { text: "ほどよく変化", variant: "warning" as const },
  hard: { text: "ばらばら", variant: "danger" as const },
};

const MIN_CANVAS_SIZE = 320;
const MAX_CANVAS_SIZE = 760;
const DEFAULT_CANVAS_SIZE = 640;

function SamplePreview({ grid }: { grid: PixelGridData }) {
  return (
    <div className="grid aspect-square w-16 shrink-0 grid-cols-8 overflow-hidden rounded-lg border border-border bg-white shadow-sm sm:w-[4.5rem]">
      {grid.flat().map((color, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{ backgroundColor: COLORS[color].hex }}
        />
      ))}
    </div>
  );
}

export function PixelStep({
  grid,
  selectedColor,
  onSelectedColorChange,
  onGridCommit,
  onUndo,
  onRedo,
  onClear,
  onLoadSample,
  canUndo,
  canRedo,
  savedArtworks,
  currentSavedArtworkId,
  onSaveArtwork,
  onLoadArtwork,
  onDeleteArtwork,
}: PixelStepProps) {
  const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS_SIZE);
  const canvasFrameRef = useRef<HTMLDivElement>(null);
  const resizeGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startSize: number;
  } | null>(null);

  const canvasBounds = () => {
    const available = canvasFrameRef.current?.parentElement?.clientWidth ?? MAX_CANVAS_SIZE;
    const maximum = Math.max(240, Math.min(MAX_CANVAS_SIZE, available));
    return { minimum: Math.min(MIN_CANVAS_SIZE, maximum), maximum };
  };

  const updateCanvasSize = (nextSize: number) => {
    const { minimum, maximum } = canvasBounds();
    setCanvasSize(Math.round(Math.min(maximum, Math.max(minimum, nextSize))));
  };

  const startCanvasResize = (event: PointerEvent<HTMLButtonElement>) => {
    const frame = canvasFrameRef.current;
    if (!frame) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startSize: frame.getBoundingClientRect().width,
    };
  };

  const moveCanvasResize = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = resizeGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
    updateCanvasSize(gesture.startSize + delta);
  };

  const finishCanvasResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (resizeGestureRef.current?.pointerId !== event.pointerId) return;
    resizeGestureRef.current = null;
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      updateCanvasSize(canvasSize + 32);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      updateCanvasSize(canvasSize - 32);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateCanvasSize(MIN_CANVAS_SIZE);
    } else if (event.key === "End") {
      event.preventDefault();
      updateCanvasSize(MAX_CANVAS_SIZE);
    }
  };

  return (
    <section className="step-enter">
      <StepHeading
        step={1}
        eyebrow="PIXEL ART"
        title="ドット絵を描く"
        description="色を選び、タップまたはドラッグで描画します。"
        icon={Sparkles}
        trailing={
          <Badge variant="outline" className="h-8 px-3">
            8 × 8 ・ 64マス
          </Badge>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-3 pb-4">
            <div>
              <CardTitle>キャンバス</CardTitle>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-bold">
              <span
                className="size-4 rounded-sm border border-black/15 dark:border-white/30"
                style={{ backgroundColor: COLORS[selectedColor].hex }}
                aria-hidden="true"
              />
              {selectedColor}・{COLORS[selectedColor].name}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-full p-3">
              <div
                ref={canvasFrameRef}
                data-resizable-canvas="true"
                className="paint-canvas relative mx-auto w-full max-w-full"
                style={{ width: `${canvasSize}px` }}
              >
                <PixelGrid
                  grid={grid}
                  selectedColor={selectedColor}
                  onCommit={onGridCommit}
                  ariaLabel="ドット絵を描く8かける8のキャンバス"
                />
                <button
                  type="button"
                  role="slider"
                  aria-label="キャンバスの表示サイズ"
                  aria-valuemin={MIN_CANVAS_SIZE}
                  aria-valuemax={MAX_CANVAS_SIZE}
                  aria-valuenow={canvasSize}
                  title="ドラッグしてキャンバスを拡大・縮小"
                  className="absolute -bottom-3 -right-3 z-20 grid size-11 touch-none place-items-center rounded-xl border-2 border-primary/40 bg-card text-primary shadow-lg outline-none cursor-nwse-resize focus-visible:ring-4 focus-visible:ring-ring/25"
                  onKeyDown={resizeWithKeyboard}
                  onLostPointerCapture={finishCanvasResize}
                  onPointerCancel={finishCanvasResize}
                  onPointerDown={startCanvasResize}
                  onPointerMove={moveCanvasResize}
                  onPointerUp={finishCanvasResize}
                >
                  <MoveDiagonal2 aria-hidden="true" />
                </button>
              </div>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
              <MoveDiagonal2 className="size-3.5" aria-hidden="true" />
              右下のつまみをドラッグして表示サイズを変更
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle>8色のパレット</CardTitle>
            </CardHeader>
            <CardContent>
              <ColorPalette value={selectedColor} onValueChange={onSelectedColorChange} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <History className="size-5 text-primary" aria-hidden="true" />
                描きなおす
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onUndo} disabled={!canUndo}>
                <Undo2 aria-hidden="true" />
                元に戻す
              </Button>
              <Button variant="secondary" onClick={onRedo} disabled={!canRedo}>
                <Redo2 aria-hidden="true" />
                やり直す
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="danger" className="col-span-2">
                    <Eraser aria-hidden="true" />
                    全部消す
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>ドット絵を全部消しますか？</AlertDialogTitle>
                    <AlertDialogDescription>
                      すべて白いマスに戻します。この操作も「元に戻す」で取り消せます。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>やめる</AlertDialogCancel>
                    <AlertDialogAction onClick={onClear}>全部消す</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>

      <SavedArtworkGallery
        artworks={savedArtworks}
        currentSavedId={currentSavedArtworkId}
        onSave={onSaveArtwork}
        onLoad={onLoadArtwork}
        onDelete={onDeleteArtwork}
      />

      <Card className="mt-4">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>サンプルから始める</CardTitle>
            </div>
            <Badge variant="secondary">選ぶと今の絵と入れかわります</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SAMPLES.map((sample) => {
              const label = COMPRESSION_LABEL[sample.compression];
              return (
                <button
                  type="button"
                  key={sample.id}
                  onClick={() => onLoadSample(sample.grid, sample.name)}
                  className={cn(
                    "group flex min-h-24 items-center gap-3 rounded-2xl border border-border bg-background/55 p-3 text-left outline-none transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-accent/60 hover:shadow-md focus-visible:ring-4 focus-visible:ring-ring/25",
                  )}
                  aria-label={`${sample.name}のサンプルを読み込む。${sample.description}`}
                >
                  <SamplePreview grid={sample.grid} />
                  <span className="min-w-0">
                    <span className="block font-extrabold">{sample.name}</span>
                    <Badge variant={label.variant} className="my-1.5">
                      {label.text}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
