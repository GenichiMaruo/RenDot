import { assertColorId } from "./colors";
import { DataValidationError } from "./errors";
import type { ColorId, PixelGrid, RunLengthEntry } from "./types";

export const GRID_SIZE = 8;
export const PIXEL_COUNT = GRID_SIZE * GRID_SIZE;
export const MAX_RUN_LENGTH = 8;

export function validateGrid(grid: unknown): asserts grid is PixelGrid {
  if (!Array.isArray(grid) || grid.length !== GRID_SIZE) {
    throw new DataValidationError(
      "INVALID_GRID",
      `A pixel grid must contain ${GRID_SIZE} rows.`,
    );
  }

  for (const [rowIndex, row] of grid.entries()) {
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      throw new DataValidationError(
        "INVALID_GRID",
        `Row ${rowIndex} must contain ${GRID_SIZE} pixels.`,
        { rowIndex },
      );
    }
    row.forEach(assertColorId);
  }
}

export function createEmptyGrid(color: ColorId = 0): PixelGrid {
  assertColorId(color);
  return Array.from({ length: GRID_SIZE }, () =>
    Array<ColorId>(GRID_SIZE).fill(color),
  );
}

export function cloneGrid(grid: PixelGrid): PixelGrid {
  validateGrid(grid);
  return grid.map((row) => [...row]);
}

export function flattenGrid(grid: PixelGrid): ColorId[] {
  validateGrid(grid);
  return grid.flat();
}

export function pixelsToGrid(pixels: ColorId[]): PixelGrid {
  if (!Array.isArray(pixels) || pixels.length !== PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `An image must contain exactly ${PIXEL_COUNT} pixels.`,
      { actual: Array.isArray(pixels) ? pixels.length : null },
    );
  }
  pixels.forEach(assertColorId);

  return Array.from({ length: GRID_SIZE }, (_, row) =>
    pixels.slice(row * GRID_SIZE, (row + 1) * GRID_SIZE),
  );
}

export function validateRunLengthEntry(
  entry: unknown,
  index?: number,
): asserts entry is RunLengthEntry {
  if (typeof entry !== "object" || entry === null) {
    throw new DataValidationError(
      "INVALID_RUN_LENGTH",
      `Run ${String(index ?? "unknown")} is not an object.`,
      { index },
    );
  }

  const candidate = entry as Partial<RunLengthEntry>;
  if (
    !Number.isInteger(candidate.length) ||
    candidate.length === undefined ||
    candidate.length < 1 ||
    candidate.length > MAX_RUN_LENGTH
  ) {
    throw new DataValidationError(
      "INVALID_RUN_LENGTH",
      `Run length must be an integer from 1 through ${MAX_RUN_LENGTH}.`,
      { index, length: candidate.length },
    );
  }
  assertColorId(candidate.color);
}

export function encodeRunLength(pixels: ColorId[]): RunLengthEntry[] {
  if (!Array.isArray(pixels) || pixels.length > PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `At most ${PIXEL_COUNT} pixels can be encoded.`,
      { actual: Array.isArray(pixels) ? pixels.length : null },
    );
  }
  pixels.forEach(assertColorId);
  if (pixels.length === 0) return [];

  const entries: RunLengthEntry[] = [];
  let color = pixels[0];
  let length = 1;

  for (let index = 1; index < pixels.length; index += 1) {
    if (pixels[index] === color && length < MAX_RUN_LENGTH) {
      length += 1;
    } else {
      entries.push({ length, color });
      color = pixels[index];
      length = 1;
    }
  }
  entries.push({ length, color });
  return entries;
}

export function decodeRunLength(entries: RunLengthEntry[]): ColorId[] {
  if (!Array.isArray(entries)) {
    throw new DataValidationError(
      "INVALID_RUN_COUNT",
      "Run-length data must be an array.",
    );
  }

  const pixels: ColorId[] = [];
  entries.forEach((entry, index) => {
    validateRunLengthEntry(entry, index);
    if (pixels.length + entry.length > PIXEL_COUNT) {
      throw new DataValidationError(
        "INVALID_PIXEL_COUNT",
        `Decoded data exceeds ${PIXEL_COUNT} pixels.`,
        { index, decodedLength: pixels.length + entry.length },
      );
    }
    pixels.push(...Array<ColorId>(entry.length).fill(entry.color));
  });
  return pixels;
}

export function assertRunLengthTotal(
  entries: RunLengthEntry[],
  expected = PIXEL_COUNT,
): void {
  const actual = decodeRunLength(entries).length;
  if (actual !== expected) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `Decoded data must contain ${expected} pixels; received ${actual}.`,
      { expected, actual },
    );
  }
}

export function getRunIndexAtPixel(
  entries: RunLengthEntry[],
  pixelIndex: number,
): number {
  if (!Number.isInteger(pixelIndex) || pixelIndex < 0 || pixelIndex >= PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      "Pixel index is outside the 8 by 8 image.",
      { pixelIndex },
    );
  }

  let offset = 0;
  for (let index = 0; index < entries.length; index += 1) {
    validateRunLengthEntry(entries[index], index);
    offset += entries[index].length;
    if (pixelIndex < offset) return index;
  }

  throw new DataValidationError(
    "INVALID_PIXEL_COUNT",
    "No run contains the requested pixel.",
    { pixelIndex },
  );
}

export function getPixelRangeForRun(
  entries: RunLengthEntry[],
  runIndex: number,
): { start: number; end: number } {
  if (!Number.isInteger(runIndex) || runIndex < 0 || runIndex >= entries.length) {
    throw new DataValidationError("INVALID_RUN_COUNT", "Run index is out of range.", {
      runIndex,
    });
  }
  entries.forEach((entry, index) => validateRunLengthEntry(entry, index));
  const start = entries
    .slice(0, runIndex)
    .reduce((total, entry) => total + entry.length, 0);
  return { start, end: start + entries[runIndex].length - 1 };
}
