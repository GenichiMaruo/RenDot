import { DataValidationError } from "./errors";
import { decodeEntry, type DecodeEntryOptions } from "./parity";
import { parseQrLikeData } from "./qrLike";
import {
  decodeRunLength,
  PIXEL_COUNT,
  pixelsToGrid,
  validateGrid,
} from "./runLength";
import type { PixelGrid, QrLikeData, RunLengthEntry } from "./types";

export type DecodeQrLikeOptions = DecodeEntryOptions;

export function decodeQrLikeData(
  data: QrLikeData,
  options: DecodeQrLikeOptions = {},
): RunLengthEntry[] {
  const parsed = parseQrLikeData(data);
  const entries = parsed.entryBits.map((bits) => decodeEntry(bits, options));
  const pixels = decodeRunLength(entries);
  if (pixels.length !== PIXEL_COUNT) {
    throw new DataValidationError(
      "INVALID_PIXEL_COUNT",
      `Decoded QR-like data contains ${pixels.length} pixels instead of ${PIXEL_COUNT}.`,
      { actual: pixels.length, expected: PIXEL_COUNT },
    );
  }
  return entries;
}

export function restorePixelGrid(
  data: QrLikeData,
  options: DecodeQrLikeOptions = {},
): PixelGrid {
  return pixelsToGrid(decodeRunLength(decodeQrLikeData(data, options)));
}

export function gridsAreEqual(left: PixelGrid, right: PixelGrid): boolean {
  validateGrid(left);
  validateGrid(right);
  return left.every((row, rowIndex) =>
    row.every((color, columnIndex) => color === right[rowIndex][columnIndex]),
  );
}
