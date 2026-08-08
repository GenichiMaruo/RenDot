import { DataValidationError } from "./errors";
import { decodeEntry, type DecodeEntryOptions } from "./parity";
import { parseQrLikeData } from "./qrLike";
import {
  decodeRunLength,
  PIXEL_COUNT,
  pixelsToGrid,
  validateGrid,
} from "./runLength";
import type { ColorMode, PixelGrid, QrLikeData, RunLengthEntry } from "./types";

export type DecodeQrLikeOptions = DecodeEntryOptions;

export type RestorePixelGridOptions = DecodeQrLikeOptions & {
  /** Keep the first 64 decoded pixels when damaged length bits produce extras. */
  truncateOverflow?: boolean;
};

export type RestoredQrLikeArtwork = {
  grid: PixelGrid;
  colorMode: ColorMode;
};

function decodeQrLikeEntries(
  data: QrLikeData,
  options: DecodeQrLikeOptions,
): RunLengthEntry[] {
  const parsed = parseQrLikeData(data);
  return parsed.entryBits.map((bits) => decodeEntry(bits, options));
}

function expandEntries(entries: RunLengthEntry[]): PixelGrid[number] {
  return entries.flatMap((entry) =>
    Array.from({ length: entry.length }, () => entry.color),
  );
}

function requireExactPixelCount(entries: RunLengthEntry[]): void {
  const actual = entries.reduce((total, entry) => total + entry.length, 0);
  if (actual !== PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `Decoded QR-like data contains ${actual} pixels instead of ${PIXEL_COUNT}.`,
      { actual, expected: PIXEL_COUNT },
    );
  }
}

export function decodeQrLikeData(
  data: QrLikeData,
  options: DecodeQrLikeOptions = {},
): RunLengthEntry[] {
  const entries = decodeQrLikeEntries(data, options);
  requireExactPixelCount(entries);
  decodeRunLength(entries);
  return entries;
}

export function restorePixelGrid(
  data: QrLikeData,
  options: RestorePixelGridOptions = {},
): PixelGrid {
  const entries = decodeQrLikeEntries(data, options);
  if (!options.truncateOverflow) {
    requireExactPixelCount(entries);
    return pixelsToGrid(decodeRunLength(entries));
  }

  const pixels = expandEntries(entries);
  if (pixels.length < PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `Decoded QR-like data contains only ${pixels.length} pixels instead of ${PIXEL_COUNT}.`,
      {
        actual: pixels.length,
        expected: PIXEL_COUNT,
        missing: PIXEL_COUNT - pixels.length,
      },
    );
  }
  return pixelsToGrid(pixels.slice(0, PIXEL_COUNT));
}

/** Restores both the color-number grid and the palette carried by its header. */
export function restoreQrLikeArtwork(
  data: QrLikeData,
  options: RestorePixelGridOptions = {},
): RestoredQrLikeArtwork {
  const colorMode = parseQrLikeData(data).header.colorMode;
  return {
    grid: restorePixelGrid(data, options),
    colorMode,
  };
}

export function gridsAreEqual(left: PixelGrid, right: PixelGrid): boolean {
  validateGrid(left);
  validateGrid(right);
  return left.every((row, rowIndex) =>
    row.every((color, columnIndex) => color === right[rowIndex][columnIndex]),
  );
}
