"use client";

import * as React from "react";

import { getColor } from "@/lib/colors";
import type { ColorId, ColorMode, PixelGrid as PixelGridData } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PixelGridCommit = {
  /** Snapshot before this paint gesture. Useful for undo history. */
  previousGrid: PixelGridData;
  /** Complete 8x8 grid after this paint gesture. */
  grid: PixelGridData;
  /** Flattened, zero-based cell indexes changed by the gesture. */
  changedIndices: number[];
  color: ColorId;
  inputType: "pointer" | "keyboard";
};

export type PixelGridProps = {
  grid: PixelGridData;
  colorMode?: ColorMode;
  /** Required together with onCommit to make the grid paintable. */
  selectedColor?: ColorId;
  /** Called once on pointer release, not once per cell crossed. */
  onCommit?: (commit: PixelGridCommit) => void;
  readOnly?: boolean;
  /** Useful in number/RLE screens that need cell-to-entry selection. */
  onCellSelect?: (cellIndex: number) => void;
  selectedCellIndex?: number | null;
  highlightedIndices?: readonly number[];
  showColorNumbers?: boolean;
  showCellBorders?: boolean;
  ariaLabel?: string;
  className?: string;
};

type PaintGesture = {
  pointerId: number;
  previousGrid: PixelGridData;
  grid: PixelGridData;
  changedIndices: Set<number>;
  color: ColorId;
  lastCellIndex: number;
};

function cloneGrid(grid: PixelGridData): PixelGridData {
  return grid.map((row) => [...row]);
}

function getCellIndexAtPoint(
  container: HTMLDivElement,
  clientX: number,
  clientY: number,
): number | null {
  const element = document.elementFromPoint(clientX, clientY);
  const cell = element?.closest<HTMLElement>("[data-pixel-index]");
  if (!cell || !container.contains(cell)) return null;

  const index = Number(cell.dataset.pixelIndex);
  return Number.isInteger(index) ? index : null;
}

/** Returns every 8x8 cell crossed by a straight line, including both ends. */
function getCellLine(startIndex: number, endIndex: number): number[] {
  let x = startIndex % 8;
  let y = Math.floor(startIndex / 8);
  const endX = endIndex % 8;
  const endY = Math.floor(endIndex / 8);
  const deltaX = Math.abs(endX - x);
  const deltaY = Math.abs(endY - y);
  const stepX = x < endX ? 1 : -1;
  const stepY = y < endY ? 1 : -1;
  let error = deltaX - deltaY;
  const indices: number[] = [];

  while (true) {
    indices.push(y * 8 + x);
    if (x === endX && y === endY) break;

    const doubledError = error * 2;
    if (doubledError > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubledError < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }

  return indices;
}

/**
 * An accessible 8x8 grid that supports mouse, touch and Apple Pencil through
 * Pointer Events. A whole drag is emitted as one commit for predictable undo.
 */
export function PixelGrid({
  grid,
  colorMode = "colorful",
  selectedColor,
  onCommit,
  readOnly = false,
  onCellSelect,
  selectedCellIndex = null,
  highlightedIndices = [],
  showColorNumbers = false,
  showCellBorders = true,
  ariaLabel = "8かける8のドット絵",
  className,
}: PixelGridProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cellRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const gestureRef = React.useRef<PaintGesture | null>(null);
  const [draftGrid, setDraftGrid] = React.useState<PixelGridData | null>(null);
  const [focusedCellIndex, setFocusedCellIndex] = React.useState(
    selectedCellIndex ?? 0,
  );

  const displayGrid = draftGrid ?? grid;
  const highlighted = new Set(highlightedIndices);
  const canPaint = !readOnly && selectedColor !== undefined && Boolean(onCommit);
  const isInteractive = canPaint || Boolean(onCellSelect);

  const paintCell = React.useCallback((cellIndex: number) => {
    const gesture = gestureRef.current;
    if (!gesture || cellIndex < 0 || cellIndex >= 64) return;

    const row = Math.floor(cellIndex / 8);
    const column = cellIndex % 8;
    if (gesture.grid[row]?.[column] === gesture.color) return;

    gesture.grid[row][column] = gesture.color;
    gesture.changedIndices.add(cellIndex);
    setDraftGrid(cloneGrid(gesture.grid));
  }, []);

  const paintThroughCell = React.useCallback(
    (cellIndex: number) => {
      const gesture = gestureRef.current;
      if (!gesture || cellIndex < 0 || cellIndex >= 64) return;

      getCellLine(gesture.lastCellIndex, cellIndex).forEach(paintCell);
      gesture.lastCellIndex = cellIndex;
    },
    [paintCell],
  );

  const finishGesture = React.useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    gestureRef.current = null;
    setDraftGrid(null);

    if (gesture.changedIndices.size === 0) return;

    onCommit?.({
      previousGrid: cloneGrid(gesture.previousGrid),
      grid: cloneGrid(gesture.grid),
      changedIndices: [...gesture.changedIndices].sort((a, b) => a - b),
      color: gesture.color,
      inputType: "pointer",
    });
  }, [onCommit]);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const cellIndex = getCellIndexAtPoint(
        container,
        event.clientX,
        event.clientY,
      );
      if (cellIndex === null) return;

      setFocusedCellIndex(cellIndex);

      if (!canPaint || selectedColor === undefined) return;
      if (gestureRef.current) return;

      event.preventDefault();
      cellRefs.current[cellIndex]?.focus({ preventScroll: true });
      onCellSelect?.(cellIndex);
      container.setPointerCapture(event.pointerId);

      const previousGrid = cloneGrid(grid);
      gestureRef.current = {
        pointerId: event.pointerId,
        previousGrid,
        grid: cloneGrid(previousGrid),
        changedIndices: new Set<number>(),
        color: selectedColor,
        lastCellIndex: cellIndex,
      };
      paintCell(cellIndex);
    },
    [canPaint, grid, onCellSelect, paintCell, selectedColor],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      const gesture = gestureRef.current;
      if (!container || !gesture || gesture.pointerId !== event.pointerId) return;

      event.preventDefault();
      const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? [];
      for (const sample of [...coalescedEvents, event.nativeEvent]) {
        const cellIndex = getCellIndexAtPoint(
          container,
          sample.clientX,
          sample.clientY,
        );
        if (cellIndex !== null) paintThroughCell(cellIndex);
      }
    },
    [paintThroughCell],
  );

  const handlePointerEnd = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      finishGesture();
    },
    [finishGesture],
  );

  const commitSingleCell = React.useCallback(
    (cellIndex: number) => {
      setFocusedCellIndex(cellIndex);
      onCellSelect?.(cellIndex);
      if (!canPaint || selectedColor === undefined) return;

      const row = Math.floor(cellIndex / 8);
      const column = cellIndex % 8;
      if (grid[row]?.[column] === selectedColor) return;

      const previousGrid = cloneGrid(grid);
      const nextGrid = cloneGrid(grid);
      nextGrid[row][column] = selectedColor;
      onCommit?.({
        previousGrid,
        grid: nextGrid,
        changedIndices: [cellIndex],
        color: selectedColor,
        inputType: "keyboard",
      });
    },
    [canPaint, grid, onCellSelect, onCommit, selectedColor],
  );

  const moveKeyboardFocus = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, cellIndex: number) => {
      let nextIndex = cellIndex;

      switch (event.key) {
        case "ArrowLeft":
          nextIndex = cellIndex % 8 === 0 ? cellIndex : cellIndex - 1;
          break;
        case "ArrowRight":
          nextIndex = cellIndex % 8 === 7 ? cellIndex : cellIndex + 1;
          break;
        case "ArrowUp":
          nextIndex = Math.max(0, cellIndex - 8);
          break;
        case "ArrowDown":
          nextIndex = Math.min(63, cellIndex + 8);
          break;
        case "Home":
          nextIndex = Math.floor(cellIndex / 8) * 8;
          break;
        case "End":
          nextIndex = Math.floor(cellIndex / 8) * 8 + 7;
          break;
        default:
          return;
      }

      event.preventDefault();
      setFocusedCellIndex(nextIndex);
      cellRefs.current[nextIndex]?.focus();
    },
    [],
  );

  return (
    <div
      aria-colcount={8}
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      aria-rowcount={8}
      className={cn(
        "grid w-full overflow-hidden rounded-2xl border-2 bg-border p-1 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.65)]",
        showCellBorders ? "gap-px" : "gap-0 p-0",
        canPaint && "touch-none select-none",
        className,
      )}
      onContextMenu={canPaint ? (event) => event.preventDefault() : undefined}
      onDragStart={canPaint ? (event) => event.preventDefault() : undefined}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={containerRef}
      role="grid"
    >
      {displayGrid.map((row, rowIndex) => (
        <div
          className={cn("grid grid-cols-8", showCellBorders ? "gap-px" : "gap-0")}
          key={rowIndex}
          role="row"
        >
          {row.map((colorId, columnIndex) => {
            const cellIndex = rowIndex * 8 + columnIndex;
            const color = getColor(colorId, colorMode);
            const isSelected = selectedCellIndex === cellIndex;
            const isHighlighted = highlighted.has(cellIndex);

            return (
              <button
                aria-label={`${rowIndex + 1}行${columnIndex + 1}列、色番号${color.id}、${color.name}`}
                aria-selected={isSelected || undefined}
                className={cn(
                  "relative grid aspect-square min-w-0 place-items-center overflow-hidden outline-none transition-[filter,box-shadow,transform] focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-inset",
                  isInteractive
                    ? "cursor-pointer active:z-10 active:scale-[0.96]"
                    : "cursor-default",
                  isHighlighted &&
                    "z-[1] ring-4 ring-cyan-400 ring-inset dark:ring-cyan-300",
                  isSelected && "z-[2] ring-4 ring-primary ring-inset",
                )}
                data-pixel-index={cellIndex}
                key={columnIndex}
                onClick={(event) => {
                  // Pointer input is handled as a gesture. detail=0 covers keyboard
                  // and assistive-technology activation without double commits.
                  if (event.detail === 0) {
                    commitSingleCell(cellIndex);
                  } else if (!canPaint) {
                    setFocusedCellIndex(cellIndex);
                    onCellSelect?.(cellIndex);
                  }
                }}
                onFocus={() => setFocusedCellIndex(cellIndex)}
                onKeyDown={(event) => moveKeyboardFocus(event, cellIndex)}
                ref={(node) => {
                  cellRefs.current[cellIndex] = node;
                }}
                role="gridcell"
                style={{
                  backgroundColor: color.hex,
                  color: color.foreground,
                }}
                tabIndex={isInteractive && focusedCellIndex === cellIndex ? 0 : -1}
                type="button"
              >
                {showColorNumbers ? (
                  <span className="grid size-[48%] min-h-5 min-w-5 place-items-center rounded-md bg-black/12 font-mono text-[clamp(0.7rem,2.4vw,1.1rem)] font-black tabular-nums backdrop-blur-[1px]">
                    {color.id}
                  </span>
                ) : null}
                {isSelected ? (
                  <span className="sr-only">選択中</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
