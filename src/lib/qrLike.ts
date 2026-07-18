import { assertBinaryString, decodeLength, toFixedBinary } from "./binary";
import { DataValidationError } from "./errors";
import { encodeEntry, ENCODED_ENTRY_BIT_COUNT, inspectEncodedEntry } from "./parity";
import { assertRunLengthTotal, PIXEL_COUNT } from "./runLength";
import type {
  EncodedEntryInspection,
  ParityBlockKey,
  QrLikeCellInfo,
  QrLikeData,
  QrLikeHeader,
  QrLikeMarkerColor,
  RunLengthEntry,
} from "./types";

export const QR_LIKE_MAGIC_BITS = "0101001001000100";
export const QR_LIKE_RUN_COUNT_BITS = 6;
export const QR_LIKE_PAYLOAD_LENGTH_BITS = 10;
export const QR_LIKE_CHECKSUM_BITS = 8;
export const QR_LIKE_HEADER_LENGTH = 40;
export const QR_LIKE_PAYLOAD_WIDTH = 16;
export const QR_LIKE_PAYLOAD_HEIGHT = 32;
export const QR_LIKE_PAYLOAD_CAPACITY = 512;
export const QR_LIKE_DEFAULT_WIDTH = 25;
export const QR_LIKE_HEIGHT = 25;
export const QR_LIKE_TIMING_ROW = 3;
export const QR_LIKE_TIMING_COLUMN = 3;
export const QR_LIKE_MARKER_SIZE = 3;

export type ParsedQrLikeData = {
  header: QrLikeHeader;
  payloadBits: string;
  entryBits: string[];
};

export type QrLikeInspection = ParsedQrLikeData & {
  entries: EncodedEntryInspection[];
  isParityValid: boolean;
  invalidEntryIndices: number[];
  parityIssues: Array<{
    entryIndex: number;
    block: ParityBlockKey;
  }>;
  decodedPixelCount: number;
};

export function calculateCrc8(bits: string): number {
  assertBinaryString(bits);
  if (bits.length % 8 !== 0) {
    throw new DataValidationError("INVALID_HEADER", "CRC input must contain complete bytes.");
  }
  let crc = 0;
  for (let offset = 0; offset < bits.length; offset += 8) {
    crc ^= Number.parseInt(bits.slice(offset, offset + 8), 2);
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc;
}

export function buildQrLikeHeader(runCount: number, payloadLength: number): QrLikeHeader {
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > PIXEL_COUNT) {
    throw new DataValidationError("INVALID_RUN_COUNT", "Run count must be from 1 through 64.");
  }
  if (payloadLength !== runCount * ENCODED_ENTRY_BIT_COUNT) {
    throw new DataValidationError("INVALID_PAYLOAD_LENGTH", "Payload length does not match run count.");
  }
  const storedRunCount = runCount - 1;
  const prefix =
    QR_LIKE_MAGIC_BITS +
    toFixedBinary(storedRunCount, QR_LIKE_RUN_COUNT_BITS) +
    toFixedBinary(payloadLength, QR_LIKE_PAYLOAD_LENGTH_BITS);
  const checksum = calculateCrc8(prefix);
  const checksumBits = toFixedBinary(checksum, QR_LIKE_CHECKSUM_BITS);
  return {
    magicBits: QR_LIKE_MAGIC_BITS,
    runCount,
    storedRunCount,
    payloadLength,
    checksum,
    checksumBits,
    bits: prefix + checksumBits,
  };
}

export function parseQrLikeHeader(bits: string): QrLikeHeader {
  assertBinaryString(bits, QR_LIKE_HEADER_LENGTH);
  const magicEnd = QR_LIKE_MAGIC_BITS.length;
  const runCountEnd = magicEnd + QR_LIKE_RUN_COUNT_BITS;
  const payloadLengthEnd = runCountEnd + QR_LIKE_PAYLOAD_LENGTH_BITS;
  const magicBits = bits.slice(0, magicEnd);
  const storedRunCount = Number.parseInt(bits.slice(magicEnd, runCountEnd), 2);
  const payloadLength = Number.parseInt(bits.slice(runCountEnd, payloadLengthEnd), 2);
  const checksumBits = bits.slice(payloadLengthEnd);
  const checksum = Number.parseInt(checksumBits, 2);
  const expectedChecksum = calculateCrc8(bits.slice(0, payloadLengthEnd));
  if (magicBits !== QR_LIKE_MAGIC_BITS) {
    throw new DataValidationError("INVALID_HEADER_MAGIC", "QR-like magic bits do not match.");
  }
  if (checksum !== expectedChecksum) {
    throw new DataValidationError("INVALID_HEADER_CHECKSUM", "QR-like header checksum does not match.");
  }
  const runCount = storedRunCount + 1;
  if (runCount < 1 || runCount > PIXEL_COUNT) {
    throw new DataValidationError("INVALID_RUN_COUNT", "Header run count is invalid.");
  }
  if (payloadLength !== runCount * ENCODED_ENTRY_BIT_COUNT || payloadLength > QR_LIKE_PAYLOAD_CAPACITY) {
    throw new DataValidationError("INVALID_PAYLOAD_LENGTH", "Header fields disagree about payload length.");
  }
  return { magicBits, runCount, storedRunCount, payloadLength, checksum, checksumBits, bits };
}

export function getQrLikeMarkerColor(column: number, row: number): QrLikeMarkerColor | null {
  const far = QR_LIKE_DEFAULT_WIDTH - QR_LIKE_MARKER_SIZE;
  if (column < 3 && row < 3) return "red";
  if (column >= far && row < 3) return "blue";
  if (column >= far && row >= far) return "green";
  if (column < 3 && row >= far) return "orange";
  return null;
}

export function isQrLikeTimingCell(column: number, row: number): boolean {
  const end = QR_LIKE_DEFAULT_WIDTH - QR_LIKE_MARKER_SIZE - 1;
  return (
    (row === QR_LIKE_TIMING_ROW && column >= 3 && column <= end) ||
    (column === QR_LIKE_TIMING_COLUMN && row >= 3 && row <= end)
  );
}

function timingBit(column: number, row: number): "0" | "1" {
  const offset = row === QR_LIKE_TIMING_ROW ? column - 3 : row - 3;
  return offset % 2 === 0 ? "1" : "0";
}

/** QR-style: start bottom-right, use two-column stripes, alternating upward/downward. */
export function getQrLikePlacementOrder(): number[] {
  const order: number[] = [];
  let upward = true;
  for (let right = QR_LIKE_DEFAULT_WIDTH - 1; right >= 0; right -= 2) {
    for (let step = 0; step < QR_LIKE_HEIGHT; step += 1) {
      const row = upward ? QR_LIKE_HEIGHT - 1 - step : step;
      for (const column of [right, right - 1]) {
        if (column < 0) continue;
        if (getQrLikeMarkerColor(column, row) || isQrLikeTimingCell(column, row)) continue;
        order.push(row * QR_LIKE_DEFAULT_WIDTH + column);
      }
    }
    upward = !upward;
  }
  if (order.length !== QR_LIKE_HEADER_LENGTH + QR_LIKE_PAYLOAD_CAPACITY) {
    throw new DataValidationError("INVALID_QR_DIMENSIONS", "QR placement map is incomplete.");
  }
  return order;
}

const PLACEMENT_ORDER = getQrLikePlacementOrder();
const PLACEMENT_INDEX = new Map(PLACEMENT_ORDER.map((cell, index) => [cell, index]));

function composeQrLikeData(headerBits: string, payloadBits: string): QrLikeData {
  assertBinaryString(headerBits, QR_LIKE_HEADER_LENGTH);
  assertBinaryString(payloadBits, QR_LIKE_PAYLOAD_CAPACITY);
  const cells = Array<string>(QR_LIKE_DEFAULT_WIDTH * QR_LIKE_HEIGHT).fill("0");
  for (let row = 0; row < QR_LIKE_HEIGHT; row += 1) {
    for (let column = 0; column < QR_LIKE_DEFAULT_WIDTH; column += 1) {
      if (isQrLikeTimingCell(column, row)) {
        cells[row * QR_LIKE_DEFAULT_WIDTH + column] = timingBit(column, row);
      }
    }
  }
  const encoded = headerBits + payloadBits;
  PLACEMENT_ORDER.forEach((cellIndex, bitIndex) => {
    cells[cellIndex] = encoded[bitIndex];
  });
  return {
    headerBits,
    payloadBits,
    fullBits: encoded,
    width: QR_LIKE_DEFAULT_WIDTH,
    height: QR_LIKE_HEIGHT,
    displayBits: cells.join(""),
  };
}

export function buildQrLikeData(entries: RunLengthEntry[]): QrLikeData {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > PIXEL_COUNT) {
    throw new DataValidationError("INVALID_RUN_COUNT", "QR-like data needs from 1 through 64 runs.");
  }
  assertRunLengthTotal(entries);
  const actualPayload = entries.map((entry) => encodeEntry(entry).bits).join("");
  const payloadBits = Array.from({ length: QR_LIKE_PAYLOAD_CAPACITY }, (_, index) => {
    if (index < actualPayload.length) return actualPayload[index];
    const cellIndex = PLACEMENT_ORDER[QR_LIKE_HEADER_LENGTH + index];
    const row = Math.floor(cellIndex / QR_LIKE_DEFAULT_WIDTH);
    const column = cellIndex % QR_LIKE_DEFAULT_WIDTH;
    return (row + column) % 2 === 0 ? "1" : "0";
  }).join("");
  return composeQrLikeData(buildQrLikeHeader(entries.length, actualPayload.length).bits, payloadBits);
}

export function qrLikeDataFromDisplayBits(displayBits: string): QrLikeData {
  assertBinaryString(displayBits, QR_LIKE_DEFAULT_WIDTH * QR_LIKE_HEIGHT);
  let timingErrors = 0;
  for (let row = 0; row < QR_LIKE_HEIGHT; row += 1) {
    for (let column = 0; column < QR_LIKE_DEFAULT_WIDTH; column += 1) {
      if (!isQrLikeTimingCell(column, row)) continue;
      if (displayBits[row * QR_LIKE_DEFAULT_WIDTH + column] !== timingBit(column, row)) timingErrors += 1;
    }
  }
  if (timingErrors > 4) {
    throw new DataValidationError("INVALID_QR_DATA", "Timing pattern could not be verified.");
  }
  const encoded = PLACEMENT_ORDER.map((index) => displayBits[index]).join("");
  const headerBits = encoded.slice(0, QR_LIKE_HEADER_LENGTH);
  parseQrLikeHeader(headerBits);
  return composeQrLikeData(headerBits, encoded.slice(QR_LIKE_HEADER_LENGTH));
}

export function parseQrLikeData(data: QrLikeData): ParsedQrLikeData {
  if (!data || data.width !== QR_LIKE_DEFAULT_WIDTH || data.height !== QR_LIKE_HEIGHT) {
    throw new DataValidationError("INVALID_QR_DIMENSIONS", "QR-like matrix must be 25 x 25.");
  }
  const header = parseQrLikeHeader(data.headerBits);
  assertBinaryString(data.payloadBits, QR_LIKE_PAYLOAD_CAPACITY);
  if (data.fullBits !== data.headerBits + data.payloadBits) {
    throw new DataValidationError("INVALID_QR_DATA", "QR-like fields are inconsistent.");
  }
  const actualPayload = data.payloadBits.slice(0, header.payloadLength);
  const entryBits = Array.from({ length: header.runCount }, (_, index) =>
    actualPayload.slice(index * ENCODED_ENTRY_BIT_COUNT, (index + 1) * ENCODED_ENTRY_BIT_COUNT),
  );
  return { header, payloadBits: actualPayload, entryBits };
}

export function inspectQrLikeData(data: QrLikeData): QrLikeInspection {
  const parsed = parseQrLikeData(data);
  const entries = parsed.entryBits.map(inspectEncodedEntry);
  const invalidEntryIndices = entries.flatMap((entry, index) => (entry.isValid ? [] : [index]));
  const parityIssues = entries.flatMap((entry, entryIndex) =>
    entry.invalidBlocks.map((block) => ({ entryIndex, block })),
  );
  const decodedPixelCount = entries.reduce(
    (total, entry) => total + decodeLength(entry.entry.length.dataBits),
    0,
  );
  return {
    ...parsed,
    entries,
    isParityValid: parityIssues.length === 0,
    invalidEntryIndices,
    parityIssues,
    decodedPixelCount,
  };
}

function getPayloadBitDetails(entryBitIndex: number): {
  block: ParityBlockKey;
  bitRole: "data" | "parity";
} {
  if (entryBitIndex <= 3) return { block: "length", bitRole: entryBitIndex === 3 ? "parity" : "data" };
  return { block: "color", bitRole: entryBitIndex === 7 ? "parity" : "data" };
}

export function getQrLikeCellInfo(data: QrLikeData, index: number): QrLikeCellInfo {
  if (!Number.isInteger(index) || index < 0 || index >= data.width * data.height) {
    throw new DataValidationError("VALUE_OUT_OF_RANGE", "Cell index is out of range.");
  }
  const row = Math.floor(index / data.width);
  const column = index % data.width;
  const markerColor = getQrLikeMarkerColor(column, row);
  if (markerColor) return { index, row, column, region: "marker", bit: null, markerColor };
  const bit = Number(data.displayBits[index]) as 0 | 1;
  if (isQrLikeTimingCell(column, row)) return { index, row, column, region: "timing", bit };
  const placementIndex = PLACEMENT_INDEX.get(index);
  if (placementIndex === undefined) {
    throw new DataValidationError("INVALID_QR_DATA", "Cell has no placement assignment.");
  }
  if (placementIndex < QR_LIKE_HEADER_LENGTH) {
    return { index, row, column, region: "header", bit, placementNumber: placementIndex + 1 };
  }
  const payloadIndex = placementIndex - QR_LIKE_HEADER_LENGTH;
  let actualPayloadLength = QR_LIKE_PAYLOAD_CAPACITY;
  try {
    actualPayloadLength = parseQrLikeHeader(data.headerBits).payloadLength;
  } catch {
    // A damaged header cannot reliably identify the dummy boundary.
  }
  if (payloadIndex >= actualPayloadLength) {
    return {
      index,
      row,
      column,
      region: "dummy",
      bit,
      placementNumber: placementIndex + 1,
      payloadIndex,
    };
  }
  const entryBitIndex = payloadIndex % ENCODED_ENTRY_BIT_COUNT;
  return {
    index,
    row,
    column,
    region: "payload",
    bit,
    entryIndex: Math.floor(payloadIndex / ENCODED_ENTRY_BIT_COUNT),
    entryBitIndex,
    placementNumber: placementIndex + 1,
    payloadIndex,
    ...getPayloadBitDetails(entryBitIndex),
  };
}

export function flipQrLikeBit(data: QrLikeData, index: number): QrLikeData {
  const cell = getQrLikeCellInfo(data, index);
  if (cell.region === "marker" || cell.region === "timing") {
    throw new DataValidationError("VALUE_OUT_OF_RANGE", "Marker and timing cells cannot be flipped.");
  }
  const placementIndex = PLACEMENT_INDEX.get(index)!;
  const replacement = data.fullBits[placementIndex] === "0" ? "1" : "0";
  const encoded = data.fullBits.slice(0, placementIndex) + replacement + data.fullBits.slice(placementIndex + 1);
  return composeQrLikeData(encoded.slice(0, QR_LIKE_HEADER_LENGTH), encoded.slice(QR_LIKE_HEADER_LENGTH));
}
