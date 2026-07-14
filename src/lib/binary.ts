import { assertColorId } from "./colors";
import { DataValidationError } from "./errors";
import { validateRunLengthEntry } from "./runLength";
import type { BinaryRunLengthEntry, ColorId, RunLengthEntry } from "./types";

export const LENGTH_BIT_COUNT = 3;
export const COLOR_BIT_COUNT = 3;
export const UNPROTECTED_ENTRY_BIT_COUNT = LENGTH_BIT_COUNT + COLOR_BIT_COUNT;

export function assertBinaryString(
  bits: unknown,
  expectedLength?: number,
): asserts bits is string {
  if (
    typeof bits !== "string" ||
    bits.length === 0 ||
    !/^[01]+$/.test(bits)
  ) {
    throw new DataValidationError(
      "INVALID_BINARY",
      "A binary value may only contain zeroes and ones.",
      { bits },
    );
  }
  if (expectedLength !== undefined && bits.length !== expectedLength) {
    throw new DataValidationError(
      "INVALID_BINARY",
      `Expected ${expectedLength} bits; received ${bits.length}.`,
      { expectedLength, actualLength: bits.length },
    );
  }
}

export function toFixedBinary(value: number, bitLength: number): string {
  if (!Number.isInteger(bitLength) || bitLength < 1 || bitLength > 52) {
    throw new DataValidationError(
      "VALUE_OUT_OF_RANGE",
      "Bit length must be an integer from 1 through 52.",
      { bitLength },
    );
  }
  const maximum = 2 ** bitLength - 1;
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new DataValidationError(
      "VALUE_OUT_OF_RANGE",
      `Value must be an integer from 0 through ${maximum}.`,
      { value, bitLength },
    );
  }
  return value.toString(2).padStart(bitLength, "0");
}

export function encodeLength(length: number): string {
  if (!Number.isInteger(length) || length < 1 || length > 8) {
    throw new DataValidationError(
      "INVALID_RUN_LENGTH",
      "A run length must be an integer from 1 through 8.",
      { length },
    );
  }
  return length === 8 ? "000" : toFixedBinary(length, LENGTH_BIT_COUNT);
}

export function decodeLength(bits: string): number {
  assertBinaryString(bits, LENGTH_BIT_COUNT);
  const value = Number.parseInt(bits, 2);
  return value === 0 ? 8 : value;
}

export function encodeColor(color: ColorId): string {
  assertColorId(color);
  return toFixedBinary(color, COLOR_BIT_COUNT);
}

export function decodeColor(bits: string): ColorId {
  assertBinaryString(bits, COLOR_BIT_COUNT);
  const color = Number.parseInt(bits, 2);
  assertColorId(color);
  return color;
}

export function toBinaryRunLengthEntry(
  entry: RunLengthEntry,
): BinaryRunLengthEntry {
  validateRunLengthEntry(entry);
  return {
    originalLength: entry.length,
    storedLength: entry.length === 8 ? 0 : entry.length,
    lengthBits: encodeLength(entry.length),
    colorBits: encodeColor(entry.color),
  };
}
