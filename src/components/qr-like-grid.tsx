"use client";

import * as React from "react";

import { getQrLikeCellInfo } from "@/lib/qrLike";
import type { QrLikeCellInfo, QrLikeData, QrLikeMarkerColor } from "@/lib/types";
import { cn } from "@/lib/utils";

const MARKER_COLORS: Record<QrLikeMarkerColor, string> = {
  red: "#ef4444",
  blue: "#2563eb",
  green: "#22c55e",
  orange: "#f97316",
};

const REGION_LABELS = {
  header: "ヘッダー",
  payload: "データ",
  dummy: "ダミー",
  timing: "タイミング",
  marker: "位置マーカー",
} as const;

export type QrLikeGridProps = {
  data: QrLikeData;
  showGrid?: boolean;
  showNumbers?: boolean;
  showPlacement?: boolean;
  showRegionHatching?: boolean;
  highlightLengthCells?: boolean;
  highlightParityCells?: boolean;
  modifiedIndices?: readonly number[] | ReadonlySet<number>;
  selectedIndex?: number | null;
  onCellClick?: (index: number, cell: QrLikeCellInfo) => void;
  onCellFocus?: (index: number, cell: QrLikeCellInfo) => void;
  className?: string;
  fullscreen?: boolean;
  fullscreenSize?: number;
};

export function QrLikeGrid({
  data,
  showGrid = true,
  showNumbers = false,
  showPlacement = false,
  showRegionHatching = false,
  highlightLengthCells = false,
  highlightParityCells = false,
  modifiedIndices = [],
  selectedIndex = null,
  onCellClick,
  onCellFocus,
  className,
  fullscreen = false,
  fullscreenSize,
}: QrLikeGridProps) {
  const displayGrid = showGrid && !fullscreen;
  const modified = React.useMemo(() => new Set(modifiedIndices), [modifiedIndices]);
  const cells = React.useMemo(
    () => Array.from({ length: data.displayBits.length }, (_, index) => getQrLikeCellInfo(data, index)),
    [data],
  );
  const firstEditableIndex = cells.find((cell) => cell.region === "header" || cell.region === "payload")?.index;

  return (
    <figure
      className={cn("mx-auto w-full", fullscreen ? "qr-fullscreen-symbol max-w-none" : "max-w-[38rem]", className)}
      style={fullscreen && fullscreenSize ? { width: `${fullscreenSize}px` } : undefined}
    >
      <div
        role="grid"
        aria-label="25列25行。四隅の色マーカー、縦横タイミング、ヘッダー40bit、データ512bitを含むQRライクデータ"
        className="grid aspect-square w-full overflow-hidden bg-white shadow-2xl"
        style={{ gridTemplateColumns: `repeat(${data.width}, minmax(0, 1fr))` }}
      >
        {cells.map((cell) => {
          const editable = cell.region === "header" || cell.region === "payload";
          const lengthHighlighted = highlightLengthCells && cell.region === "payload" && cell.block === "length";
          const parityHighlighted = highlightParityCells && cell.region === "payload" && cell.bitRole === "parity";
          const label = cell.region === "marker"
            ? `${REGION_LABELS.marker}、${cell.markerColor}`
            : `${REGION_LABELS[cell.region]}、行${cell.row + 1}列${cell.column + 1}、${cell.bit}`;
          const hatchColor =
            cell.region === "header"
              ? "rgba(245,158,11,.9)"
              : cell.region === "timing"
                ? "rgba(6,182,212,.9)"
                : cell.region === "dummy"
                  ? "rgba(139,92,246,.9)"
                  : null;
          return (
            <button
              key={cell.index}
              type="button"
              role="gridcell"
              aria-label={label}
              aria-selected={selectedIndex === cell.index}
              disabled={!editable || !onCellClick}
              tabIndex={editable && onCellClick && (selectedIndex === cell.index || selectedIndex === null && cell.index === firstEditableIndex) ? 0 : -1}
              title={label}
              onClick={() => onCellClick?.(cell.index, cell)}
              onFocus={() => onCellFocus?.(cell.index, cell)}
              className={cn(
                "relative min-w-0 overflow-hidden p-0 outline-none",
                cell.bit === 1 ? "bg-black text-white" : "bg-white text-black",
                displayGrid && cell.region !== "marker" && "ring-1 ring-inset ring-slate-400/30",
                cell.region === "header" && displayGrid && "ring-1 ring-inset ring-amber-500",
                cell.region === "timing" && displayGrid && "ring-1 ring-inset ring-cyan-500",
                cell.region === "dummy" && displayGrid && "ring-1 ring-inset ring-violet-500/70",
                modified.has(cell.index) && "z-10 ring-2 ring-inset ring-red-500",
                selectedIndex === cell.index && "z-20 ring-2 ring-inset ring-fuchsia-500",
                editable && onCellClick && "cursor-pointer hover:opacity-75 focus-visible:ring-2 focus-visible:ring-fuchsia-500",
              )}
              style={{
                ...(cell.markerColor ? { backgroundColor: MARKER_COLORS[cell.markerColor] } : {}),
                ...(showRegionHatching && hatchColor
                  ? {
                      backgroundImage: `repeating-linear-gradient(135deg, transparent 0, transparent 4px, ${hatchColor} 4px, ${hatchColor} 6px)`,
                    }
                  : {}),
              }}
              data-region={cell.region}
              data-marker={cell.markerColor}
              data-entry-index={cell.entryIndex}
              data-entry-bit-index={cell.entryBitIndex}
              data-block={cell.block}
              data-bit-role={cell.bitRole}
              data-placement-number={cell.placementNumber}
              data-payload-index={cell.payloadIndex}
              data-modified={modified.has(cell.index) || undefined}
              data-hatched={showRegionHatching && Boolean(hatchColor) || undefined}
              data-length-highlighted={lengthHighlighted || undefined}
              data-parity-highlighted={parityHighlighted || undefined}
            >
              {lengthHighlighted ? (
                <span
                  aria-hidden="true"
                  data-length-highlight-pattern="true"
                  className="pointer-events-none absolute inset-0 z-10 border-2 border-fuchsia-500 shadow-[inset_0_0_0_1px_rgba(255,255,255,.55)]"
                  style={{
                    backgroundImage: "repeating-linear-gradient(135deg, transparent 0, transparent 3px, rgba(217,70,239,.78) 3px, rgba(217,70,239,.78) 5px)",
                  }}
                />
              ) : null}
              {parityHighlighted ? (
                <span
                  aria-hidden="true"
                  data-parity-highlight-pattern="true"
                  className="pointer-events-none absolute inset-0 z-[15] border-2 border-cyan-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,.7)]"
                  style={{
                    backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 3px, rgba(34,211,238,.88) 3px, rgba(34,211,238,.88) 5px)",
                  }}
                />
              ) : null}
              {showPlacement && cell.placementNumber ? (
                <span className="absolute inset-0 z-20 grid place-items-center font-mono text-[clamp(4px,0.68vw,8px)] font-black leading-none">
                  {cell.placementNumber}
                </span>
              ) : showNumbers && editable ? (
                <span className="absolute inset-0 z-20 grid place-items-center font-mono text-[clamp(4px,0.7vw,8px)] font-black leading-none">
                  {cell.index}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!fullscreen ? (
        <figcaption className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><b className="text-amber-600">黄枠</b> ヘッダー</span>
          <span><b className="text-cyan-600">十字</b> タイミング</span>
          <span><b className="text-violet-600">紫枠</b> ダミー</span>
          {highlightLengthCells ? <span><b className="text-fuchsia-600">桃色斜線</b> 個数3bit + P</span> : null}
          {highlightParityCells ? <span><b className="text-cyan-600">水色斜線</b> パリティbit</span> : null}
          <span><b>右下から</b> 2列ジグザグ</span>
        </figcaption>
      ) : null}
    </figure>
  );
}
